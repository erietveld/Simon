import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Redirect console.log → console.error BEFORE importing CJS modules.
// stdout is the MCP protocol channel — any stray console.log would corrupt it.
console.log = (...args) => console.error(...args);

const snClient = require('./sn-client.js');
const snAuth = require('./sn-auth.js');

const log = (...args) => console.error('[MCP]', ...args);

// --- Response helpers ---

const MAX_RESPONSE_CHARS = 20_000;

function cappedText(text) {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return text.slice(0, MAX_RESPONSE_CHARS)
    + `\n\n[Response truncated at ${MAX_RESPONSE_CHARS} chars. `
    + `Use the 'fields' parameter to request fewer fields, reduce 'limit', or increase 'offset' to paginate.]`;
}

// Compact serialisation: pretty-print up to 5 records, one-record-per-line beyond that
function serializeRecords(records) {
  if (records.length <= 5) return JSON.stringify(records, null, 2);
  return '[\n' + records.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n]';
}

// Return only key identifiers from a write response
function writeConfirmation(verb, record) {
  const keys = ['sys_id', 'number', 'short_description', 'name', 'title', 'state'];
  const summary = {};
  for (const k of keys) {
    const v = record?.[k];
    if (v !== undefined && v !== null && v !== '') summary[k] = v;
  }
  return `Record ${verb} successfully.\n\n${JSON.stringify(summary, null, 2)}`;
}

// --- Create MCP server ---

const server = new McpServer({
  name: 'servicenow',
  version: '1.0.0',
});

// ============================================================
// Tool 1: sn_query — Query ServiceNow records
// ============================================================
server.registerTool(
  'sn_query',
  {
    description: 'Query records from a ServiceNow table using encoded query syntax. Returns JSON array of matching records.',
    inputSchema: {
      table: z.string().describe('Table name (e.g. incident, sys_user, change_request, cmdb_ci)'),
      query: z.string().optional().describe('Encoded query filter (e.g. active=true^priority=1^short_descriptionLIKEnetwork)'),
      fields: z.string().optional().describe('Comma-separated field names to return (e.g. number,short_description,state)'),
      limit: z.number().optional().default(20).describe('Max records to return (default: 20)'),
      offset: z.number().optional().describe('Record offset for pagination'),
      order_by: z.string().optional().describe('Field to order by (e.g. sys_created_on)'),
      order_dir: z.enum(['asc', 'desc']).optional().default('asc').describe('Sort direction'),
      display_value: z.enum(['true', 'false', 'all']).optional().describe('Return display values instead of sys_ids. "all" returns both.'),
    },
  },
  async ({ table, query, fields, limit, offset, order_by, order_dir, display_value }) => {
    try {
      const result = await snClient.queryRecords({
        table, query, fields, limit, offset,
        orderBy: order_by, orderDir: order_dir, displayValue: display_value,
      });

      if (result.status >= 400) {
        return {
          content: [{ type: 'text', text: `Error ${result.status}: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      const records = result.data?.result || [];
      return {
        content: [{
          type: 'text',
          text: cappedText(`Found ${records.length} record(s) in ${table}:\n\n${serializeRecords(records)}`),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 2: sn_get_record — Get single record by sys_id
// ============================================================
server.registerTool(
  'sn_get_record',
  {
    description: 'Get a single ServiceNow record by its sys_id.',
    inputSchema: {
      table: z.string().describe('Table name (e.g. incident, sys_user)'),
      sys_id: z.string().describe('The sys_id of the record'),
      fields: z.string().optional().describe('Comma-separated field names to return'),
      display_value: z.enum(['true', 'false', 'all']).optional().describe('Return display values'),
    },
  },
  async ({ table, sys_id, fields, display_value }) => {
    try {
      const result = await snClient.getRecord({
        table, sysId: sys_id, fields, displayValue: display_value,
      });

      if (result.status >= 400) {
        return {
          content: [{ type: 'text', text: `Error ${result.status}: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: cappedText(JSON.stringify(result.data?.result || result.data, null, 2)),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 3: sn_create_record — Create a new record
// ============================================================
server.registerTool(
  'sn_create_record',
  {
    description: 'Create a new record in a ServiceNow table. Returns the created record with its sys_id.',
    inputSchema: {
      table: z.string().describe('Table name (e.g. incident, change_request)'),
      fields: z.record(z.string(), z.any()).describe('Object of field name/value pairs to set on the new record'),
      transaction_scope: z.string().optional().describe('Scope sys_id to create within (sysparm_transaction_scope). Ensures artifact lands in the correct app scope. Get sys_id via sn_query on sys_scope table (e.g. query: scope=x_myapp).'),
    },
  },
  async ({ table, fields, transaction_scope }) => {
    try {
      const result = await snClient.createRecord({ table, fields, transactionScope: transaction_scope });

      if (result.status >= 400) {
        return {
          content: [{ type: 'text', text: `Error ${result.status}: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      const record = result.data?.result;
      return {
        content: [{ type: 'text', text: writeConfirmation('created', record) }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 4: sn_update_record — Update an existing record
// ============================================================
server.registerTool(
  'sn_update_record',
  {
    description: 'Update fields on an existing ServiceNow record using PATCH.',
    inputSchema: {
      table: z.string().describe('Table name'),
      sys_id: z.string().describe('The sys_id of the record to update'),
      fields: z.record(z.string(), z.any()).describe('Object of field name/value pairs to update'),
      transaction_scope: z.string().optional().describe('Scope sys_id to update within (sysparm_transaction_scope). Ensures change is captured in the correct app scope. Get sys_id via sn_query on sys_scope table (e.g. query: scope=x_myapp).'),
    },
  },
  async ({ table, sys_id, fields, transaction_scope }) => {
    try {
      const result = await snClient.updateRecord({ table, sysId: sys_id, fields, transactionScope: transaction_scope });

      if (result.status >= 400) {
        return {
          content: [{ type: 'text', text: `Error ${result.status}: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: writeConfirmation('updated', result.data?.result) }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 5: sn_delete_record — Delete a record
// ============================================================
server.registerTool(
  'sn_delete_record',
  {
    description: 'Delete a record from a ServiceNow table by sys_id.',
    inputSchema: {
      table: z.string().describe('Table name'),
      sys_id: z.string().describe('The sys_id of the record to delete'),
    },
  },
  async ({ table, sys_id }) => {
    try {
      const result = await snClient.deleteRecord({ table, sysId: sys_id });

      if (result.status >= 400) {
        return {
          content: [{ type: 'text', text: `Error ${result.status}: ${JSON.stringify(result.data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Record ${sys_id} deleted from ${table} (status: ${result.status}).` }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 6: sn_table_structure — Get table schema
// ============================================================
server.registerTool(
  'sn_table_structure',
  {
    description: 'Get the schema, columns, and relationships of a ServiceNow table. Useful for understanding table structure before querying.',
    inputSchema: {
      table: z.string().describe('Table name or label (e.g. incident, sys_user, Change Request)'),
    },
  },
  async ({ table }) => {
    try {
      const result = await snClient.getTableStructure(table);

      if (result.error) {
        return {
          content: [{ type: 'text', text: `Table not found: ${table}` }],
          isError: true,
        };
      }

      const cols = result.columns || [];
      const outRefs = result.references?.outgoing || [];
      const inRefs = result.references?.incoming || [];

      let text = `## Table: ${result.table.label} (${result.table.name})\n`;
      text += `sys_id: ${result.table.sys_id}\n`;
      if (result.table.super_class) {
        text += `Extends: ${result.table.super_class.name} (${result.table.super_class.label})\n`;
      }
      text += `\n### Columns (${cols.length}):\n`;
      for (const c of cols) {
        const ref = c.reference ? ` -> ${c.reference}` : '';
        const req = c.mandatory === 'true' ? ' [required]' : '';
        text += `- ${c.element} (${c.internal_type || 'unknown'}${ref})${req} — ${c.column_label || ''}\n`;
      }
      if (outRefs.length > 0) {
        text += `\n### Outgoing References (${outRefs.length}):\n`;
        for (const r of outRefs) {
          text += `- ${r.column} -> ${r.target_table} (${r.label})\n`;
        }
      }
      if (inRefs.length > 0) {
        text += `\n### Incoming References (${inRefs.length}):\n`;
        for (const r of inRefs) {
          text += `- ${r.source_table}.${r.column} (${r.label})\n`;
        }
      }
      if (result.suggestions) {
        text += `\n### Multiple matches found:\n`;
        for (const s of result.suggestions) {
          text += `- ${s.name} (${s.label})\n`;
        }
      }

      return { content: [{ type: 'text', text: cappedText(text) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 7: sn_script_include — Call ScriptInclude via GlideAjax
// ============================================================
server.registerTool(
  'sn_script_include',
  {
    description: 'Call a ServiceNow ScriptInclude method via GlideAjax (xmlhttp.do). Useful for invoking server-side logic.',
    inputSchema: {
      script_include: z.string().describe('ScriptInclude name (e.g. x_snc_etools.SystemVersionUtils)'),
      method: z.string().describe('Method name to call'),
      params: z.record(z.string(), z.string()).optional().describe('Additional parameters to pass as key-value pairs'),
    },
  },
  async ({ script_include, method, params }) => {
    try {
      const result = await snClient.callScriptInclude({
        scriptInclude: script_include, method, params,
      });

      // Try to parse the XML answer attribute for cleaner output
      let output = result.body;
      const answerMatch = result.body?.match(/answer="([^"]*)"/);
      if (answerMatch) {
        const decoded = answerMatch[1]
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        try {
          const obj = JSON.parse(decoded);
          output = JSON.stringify(obj, null, 2);
        } catch {
          output = decoded;
        }
      }

      if (result.body?.includes('invalid token')) {
        return {
          content: [{ type: 'text', text: 'Session expired or invalid token. The web session needs to be re-established. Try the call again.' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: cappedText(`Status: ${result.status}\n\n${output}`) }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 8: sn_rest_api — Generic REST API escape hatch
// ============================================================
server.registerTool(
  'sn_rest_api',
  {
    description: 'Make a generic REST API call to the ServiceNow instance. Use for APIs not covered by other tools (stats, aggregates, custom APIs, etc.).',
    inputSchema: {
      path: z.string().describe('API path starting with / (e.g. /api/now/table/incident, /api/now/stats/incident?sysparm_count=true)'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('GET').describe('HTTP method'),
      body: z.any().optional().describe('Request body object (for POST/PUT/PATCH)'),
    },
  },
  async ({ path, method, body }) => {
    try {
      const result = await snClient.restApiCall({ apiPath: path, httpMethod: method, body });

      if (result.status >= 400) {
        return {
          content: [{ type: 'text', text: `Error ${result.status}: ${JSON.stringify(result.data, null, 2)}` }],
          isError: true,
        };
      }

      const text = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      return { content: [{ type: 'text', text: cappedText(text) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 9: sn_instance_info — List all instances + active status
// ============================================================
server.registerTool(
  'sn_instance_info',
  {
    description: 'Get the current ServiceNow connection status, instance URL, auth method, and login state. Also lists all registered instances.',
  },
  async () => {
    try {
      const data = snAuth.getInstances();
      const active = snAuth.getActiveInstance();

      if (!active) {
        return {
          content: [{ type: 'text', text: 'No ServiceNow instance configured. Add one via http://localhost:3001' }],
          isError: true,
        };
      }

      let text = `Active instance: ${active.name} (${active.id})\n`;
      text += `URL:             ${active.url}\n`;
      text += `Auth:            ${active.authType}\n`;
      text += `Logged in:       ${snAuth.isLoggedIn(active)}\n`;

      if (data.instances.length > 1) {
        text += `\nAll instances (${data.instances.length}):\n`;
        for (const inst of data.instances) {
          const marker = inst.id === data.activeInstanceId ? '* ' : '  ';
          const status = snAuth.isLoggedIn(inst) ? 'logged in' : (inst.authType === 'oauth' ? 'not logged in' : 'basic auth');
          text += `${marker}[${inst.id}] ${inst.name} — ${inst.url} (${inst.authType}, ${status})\n`;
        }
        text += '\nUse sn_switch_instance to change the active instance.';
      }

      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 10: sn_switch_instance — Change the active instance
// ============================================================
server.registerTool(
  'sn_switch_instance',
  {
    description: 'Switch the active ServiceNow instance used for all API calls. Use sn_instance_info to see available instance IDs.',
    inputSchema: {
      instance_id: z.string().describe('The instance ID to activate (e.g. "inst_abc123"). Use sn_instance_info to list available IDs.'),
    },
  },
  async ({ instance_id }) => {
    try {
      const inst = snAuth.getInstance(instance_id);
      if (!inst) {
        const data = snAuth.getInstances();
        const ids = data.instances.map(i => `  [${i.id}] ${i.name} — ${i.url}`).join('\n');
        return {
          content: [{ type: 'text', text: `Instance "${instance_id}" not found.\n\nAvailable instances:\n${ids}` }],
          isError: true,
        };
      }

      snAuth.setActiveInstance(instance_id);
      const loggedIn = snAuth.isLoggedIn(inst);
      let text = `Switched to: ${inst.name} (${inst.url})\nAuth: ${inst.authType}\nLogged in: ${loggedIn}`;
      if (!loggedIn && inst.authType === 'oauth') {
        text += '\n\nNote: not logged in. Visit http://localhost:3001 to authenticate this instance.';
      }

      log(`Switched active instance to: ${inst.name} (${inst.url})`);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Tool 11: sn_switch_update_set — Switch the active update set
// ============================================================
server.registerTool(
  'sn_switch_update_set',
  {
    description: 'Switch the active update set for the authenticated user. Subsequent create/update operations will be captured in this update set. Provide either sys_id or name (name resolves only "in progress" update sets).',
    inputSchema: {
      sys_id: z.string().optional().describe('sys_id of the target update set'),
      name: z.string().optional().describe('Name of the update set (must be "in progress"). Used if sys_id is not provided.'),
    },
  },
  async ({ sys_id, name }) => {
    try {
      if (!sys_id && !name) {
        return {
          content: [{ type: 'text', text: 'Error: provide either sys_id or name.' }],
          isError: true,
        };
      }

      const result = await snClient.switchUpdateSet({ sys_id, name });

      if (result.status >= 400) {
        return {
          content: [{ type: 'text', text: `Error ${result.status}: ${JSON.stringify(result.data?.raw)}` }],
          isError: true,
        };
      }

      const { sys_id: usid, name: uname } = result.data;
      return {
        content: [{ type: 'text', text: `Active update set switched.\n\n${JSON.stringify({ sys_id: usid, name: uname }, null, 2)}` }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================================
// Start the MCP server on stdio
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const active = snAuth.getActiveInstance();
  log('ServiceNow MCP Server running on stdio');
  log(`Active instance: ${active ? `${active.name} (${active.url})` : '(none configured)'}`);
  log(`Auth: ${active?.authType || 'none'}`);
}

main().catch((error) => {
  console.error('Fatal MCP error:', error);
  process.exit(1);
});
