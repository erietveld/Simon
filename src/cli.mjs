#!/usr/bin/env node
import { parseArgs } from 'util';
import { createRequire } from 'module';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Redirect console.log → console.error BEFORE loading CJS modules.
// Their debug output must not corrupt stdout (our output channel).
console.log = (...args) => console.error(...args);

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_FILE = join(__dirname, '..', 'logs.ndjson');

const require = createRequire(import.meta.url);
const snClient = require('./sn-client.js');
const snAuth = require('./sn-auth.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_STDOUT_LINES = 148;
const PREVIEW_LINES = 3;

function emitOutput(text, { forceStdout = false } = {}) {
  const lines = text.split('\n');
  if (forceStdout || lines.length <= MAX_STDOUT_LINES) {
    process.stdout.write(text + '\n');
    return;
  }
  const ts = Date.now();
  const filePath = `/tmp/simon-${ts}.json`;
  fs.writeFileSync(filePath, text + '\n');
  const preview = lines.slice(0, PREVIEW_LINES).join('\n');
  process.stdout.write(
    `${preview}\n\n` +
    `[${lines.length} lines — full response written to ${filePath}]\n`
  );
}

function serializeRecords(records) {
  if (records.length <= 5) return JSON.stringify(records, null, 2);
  return '[\n' + records.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n]';
}

function writeConfirmation(verb, record) {
  const keys = ['sys_id', 'number', 'short_description', 'name', 'title', 'state'];
  const summary = {};
  for (const k of keys) {
    const v = record?.[k];
    if (v !== undefined && v !== null && v !== '') summary[k] = v;
  }
  return JSON.stringify({ status: verb, ...summary }, null, 2);
}

function resolveInstance(input) {
  const { instances } = snAuth.getInstances();

  if (!input) {
    if (instances.length === 0) return { inst: null, empty: true };
    return { inst: instances[0], corrected: false };
  }

  const byId = instances.find(i => i.id === input);
  if (byId) return { inst: byId, corrected: false };

  const lower = input.toLowerCase();
  const byExactName = instances.filter(i => i.name.toLowerCase() === lower);
  if (byExactName.length === 1) return { inst: byExactName[0], corrected: false };

  const byFuzzy = instances.filter(i =>
    i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase())
  );
  if (byFuzzy.length === 1) {
    return {
      inst: byFuzzy[0], corrected: true,
      correctionNote: `Instance fuzzy-matched: "${input}" → "${byFuzzy[0].name}" (${byFuzzy[0].id}). Use instance_id="${byFuzzy[0].id}" in subsequent calls.`,
    };
  }

  return { inst: null, ambiguous: true, instances };
}

function instanceListText(instances) {
  let text = 'Could not uniquely resolve the instance. Registered instances:\n\n';
  for (const inst of instances) {
    const status = snAuth.isLoggedIn(inst) ? 'logged in' : (inst.authType === 'oauth' ? 'not logged in' : 'basic auth');
    text += `  [${inst.id}] ${inst.name} — ${inst.url} (${inst.authType}, ${status})\n`;
  }
  return text;
}

function logToFile(entry) {
  const line = JSON.stringify({ id: Date.now() + Math.random(), ...entry }) + '\n';
  fs.appendFile(LOGS_FILE, line, () => {});
}

// ─── Exit + instance helpers ──────────────────────────────────────────────────

function die(msg, code = 1) {
  process.stderr.write(msg + '\n');
  process.exit(code);
}

function getInst(instanceFlag) {
  const resolution = resolveInstance(instanceFlag || null);
  if (resolution.empty) die('No ServiceNow instances configured. Add one via http://localhost:3001', 5);
  if (resolution.ambiguous) die(instanceListText(resolution.instances), 2);
  if (resolution.corrected) process.stderr.write(`Note: ${resolution.correctionNote}\n`);
  return resolution.inst;
}

// ─── stdin reader ─────────────────────────────────────────────────────────────

function isStdinPipe() {
  try {
    const stat = fs.fstatSync(0);
    return stat.isFIFO() || stat.isSocket();
  } catch {
    return false;
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY || !isStdinPipe()) { resolve(null); return; }
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

async function requireStdinJson(cmd) {
  const raw = await readStdin();
  if (!raw || !raw.trim()) {
    die(
      `Error: ${cmd} requires a JSON object on stdin.\n\n` +
      `Usage:\n  simon ${cmd} <table> [flags] <<'EOF'\n  { "field": "value" }\n  EOF`,
      3
    );
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    die(`Error: invalid JSON on stdin — ${err.message}`, 3);
  }
}

// ─── Table renderer ───────────────────────────────────────────────────────────

function renderTable(records) {
  if (!records.length) return '(no records)';
  const MAX_COL = 50;
  const keys = Object.keys(records[0]);
  const widths = keys.map(k => Math.min(MAX_COL, Math.max(
    k.length,
    ...records.map(r => { const v = r[k]; return String(v?.value ?? v ?? '').length; })
  )));
  const row = cells => cells.map((c, i) => String(c).slice(0, widths[i]).padEnd(widths[i])).join('  ');
  const sep = widths.map(w => '─'.repeat(w)).join('  ');
  return [
    row(keys),
    sep,
    ...records.map(r => row(keys.map(k => { const v = r[k]; return v?.value ?? v ?? ''; }))),
  ].join('\n');
}

// ─── Help texts ───────────────────────────────────────────────────────────────

const HELP_TOP = `\
simon — ServiceNow CLI

Usage:
  simon <command> [flags]

Commands:
  instances                  List registered instances
  query    <table>           Query records
  get      <table> <sys_id>  Fetch a single record
  create   <table>           Create a record (fields via stdin JSON)
  update   <table> <sys_id>  Update a record (fields via stdin JSON)
  delete   <table> <sys_id>  Delete a record
  schema   <table>           Show table structure and columns
  script   <include> <meth>  Call a ScriptInclude via GlideAjax
  api      <path>            Generic REST call (body via stdin JSON for writes)
  update-set <name|sys_id>   Switch active update set

Global flags:
  -i, --instance <name>      Target instance (default: first registered)
  --format json|table        Output format (default: json)
  --output stdout            Force full output to stdout (skip file offload)

Run \`simon <command> --help\` for flags and examples.`;

const HELP_MAP = {
  instances: `simon instances\n\nList all registered ServiceNow instances with connection status.`,

  query: `\
simon query <table>

Query records from a ServiceNow table.

Flags:
  -q, --query <encoded-query>    Encoded query (e.g. active=true^priority=1)
  -f, --fields <csv>             Fields to return (e.g. number,short_description)
  -l, --limit <n>                Max records (default: 20)
      --offset <n>               Pagination offset
      --order-by <field>         Sort field
      --order-dir asc|desc       Sort direction (default: asc)
      --display-value true|false|all
  -i, --instance <name-or-id>
      --format json|table
      --output stdout

Examples:
  simon query incident -q 'active=true^priority=1' -f number,short_description -l 5 -i myinstance
  simon query sys_user -q 'email=john@example.com' -i myinstance`,

  get: `\
simon get <table> <sys_id>

Fetch a single record by sys_id.

Flags:
  -f, --fields <csv>             Fields to return
      --display-value true|false|all
  -i, --instance <name-or-id>

Example:
  simon get incident abc123 -f number,short_description,state -i myinstance`,

  create: `\
simon create <table>

Create a new record. Pass field values as a JSON object on stdin.

Flags:
      --scope <scope-sys-id>   sysparm_transaction_scope
  -i, --instance <name-or-id>

Example:
  simon create incident -i myinstance <<'EOF'
  {
    "short_description": "Network down",
    "priority": "1"
  }
  EOF`,

  update: `\
simon update <table> <sys_id>

Update an existing record. Pass field values as a JSON object on stdin.

Flags:
      --scope <scope-sys-id>   sysparm_transaction_scope
  -i, --instance <name-or-id>

Example:
  simon update incident abc123 -i myinstance <<'EOF'
  {
    "state": "6",
    "close_code": "Solved (Permanently)"
  }
  EOF`,

  delete: `\
simon delete <table> <sys_id>

Delete a record.

Flags:
  -i, --instance <name-or-id>

Example:
  simon delete incident abc123 -i myinstance`,

  schema: `\
simon schema <table>

Show table structure: columns, types, and references.

Flags:
  -i, --instance <name-or-id>

Example:
  simon schema incident -i myinstance`,

  script: `\
simon script <include> <method>

Call a ServiceNow ScriptInclude method via GlideAjax.

Flags:
  -p, --param <key=value>      Additional GlideAjax params (repeatable)
  -i, --instance <name-or-id>

Examples:
  simon script x_myapp.MyUtils getVersion -i myinstance
  simon script x_myapp.MyUtils lookup -p id=12345 -i myinstance`,

  api: `\
simon api <path>

Make a generic REST API call. Pass body as JSON on stdin for write methods.

Flags:
  -X, --method GET|POST|PUT|PATCH|DELETE   HTTP method (default: GET)
  -i, --instance <name-or-id>

Examples:
  simon api '/api/now/stats/incident?sysparm_count=true' -i myinstance
  simon api /api/now/table/incident -X POST -i myinstance <<'EOF'
  { "short_description": "test" }
  EOF`,

  'update-set': `\
simon update-set <name-or-sys_id>

Switch the active update set. Pass name (must be "in progress") or sys_id with --sys-id.

Flags:
      --sys-id                 Treat argument as sys_id (skip name lookup)
  -i, --instance <name-or-id>

Examples:
  simon update-set "My Changes" -i myinstance
  simon update-set abc123def456 --sys-id -i myinstance`,
};

// ─── Arg option definitions ───────────────────────────────────────────────────

const GLOBAL_OPTS = {
  instance: { type: 'string', short: 'i' },
  format:   { type: 'string' },
  output:   { type: 'string' },
};

const OPTS_MAP = {
  instances:    {},
  query: {
    ...GLOBAL_OPTS,
    query:           { type: 'string', short: 'q' },
    fields:          { type: 'string', short: 'f' },
    limit:           { type: 'string', short: 'l' },
    offset:          { type: 'string' },
    'order-by':      { type: 'string' },
    'order-dir':     { type: 'string' },
    'display-value': { type: 'string' },
  },
  get: {
    ...GLOBAL_OPTS,
    fields:          { type: 'string', short: 'f' },
    'display-value': { type: 'string' },
  },
  create:       { ...GLOBAL_OPTS, scope: { type: 'string' } },
  update:       { ...GLOBAL_OPTS, scope: { type: 'string' } },
  delete:       { ...GLOBAL_OPTS },
  schema:       { ...GLOBAL_OPTS },
  script: {
    ...GLOBAL_OPTS,
    param: { type: 'string', short: 'p', multiple: true },
  },
  api: {
    ...GLOBAL_OPTS,
    method: { type: 'string', short: 'X' },
  },
  'update-set': {
    ...GLOBAL_OPTS,
    'sys-id': { type: 'boolean' },
  },
};

// ─── Command handlers ─────────────────────────────────────────────────────────

async function cmdInstances() {
  const startMs = Date.now();
  const data = snAuth.getInstances();
  if (!data.instances.length) {
    logToFile({ timestamp: new Date().toISOString(), command: 'instances', instance: null, durationMs: 0, isError: true });
    die('No ServiceNow instances configured. Add one via http://localhost:3001', 5);
  }

  let text = `Registered instances (${data.instances.length}):\n`;
  for (let i = 0; i < data.instances.length; i++) {
    const inst = data.instances[i];
    const status = snAuth.isLoggedIn(inst) ? 'logged in' : (inst.authType === 'oauth' ? 'not logged in' : 'basic auth');
    text += `${i === 0 ? '* ' : '  '}[${inst.id}] ${inst.name} — ${inst.url} (${inst.authType}, ${status})\n`;
  }
  text += '\n* = default instance';
  process.stdout.write(text + '\n');
  logToFile({ timestamp: new Date().toISOString(), command: 'instances', instance: null, durationMs: Date.now() - startMs, isError: false });
}

async function cmdQuery(positionals, flags) {
  const table = positionals[0];
  if (!table) die('Error: table name required.\n\n' + HELP_MAP.query, 4);

  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const result = await snClient.queryRecords({
    table,
    query: flags.query,
    fields: flags.fields,
    limit: flags.limit != null ? parseInt(flags.limit, 10) : 20,
    offset: flags.offset != null ? parseInt(flags.offset, 10) : undefined,
    orderBy: flags['order-by'],
    orderDir: flags['order-dir'],
    displayValue: flags['display-value'],
    inst,
  });

  logToFile({ timestamp: new Date().toISOString(), command: 'query', instance: { id: inst.id, name: inst.name }, request: { table, ...flags }, durationMs: Date.now() - startMs, isError: result.status >= 400 });
  if (result.status >= 400) die(`Error ${result.status}: ${JSON.stringify(result.data)}`, 1);

  const records = result.data?.result || [];
  const forceStdout = flags.output === 'stdout';
  if (flags.format === 'table') {
    emitOutput(renderTable(records), { forceStdout });
  } else {
    emitOutput(serializeRecords(records), { forceStdout });
  }
}

async function cmdGet(positionals, flags) {
  const [table, sysId] = positionals;
  if (!table) die('Error: table name required.\n\n' + HELP_MAP.get, 4);
  if (!sysId) die('Error: sys_id required.\n\n' + HELP_MAP.get, 4);

  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const result = await snClient.getRecord({ table, sysId, fields: flags.fields, displayValue: flags['display-value'], inst });

  logToFile({ timestamp: new Date().toISOString(), command: 'get', instance: { id: inst.id, name: inst.name }, request: { table, sysId, ...flags }, durationMs: Date.now() - startMs, isError: result.status >= 400 });
  if (result.status >= 400) die(`Error ${result.status}: ${JSON.stringify(result.data)}`, 1);

  emitOutput(JSON.stringify(result.data?.result || result.data, null, 2), { forceStdout: flags.output === 'stdout' });
}

async function cmdCreate(positionals, flags) {
  const table = positionals[0];
  if (!table) die('Error: table name required.\n\n' + HELP_MAP.create, 4);

  const fields = await requireStdinJson('create');
  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const result = await snClient.createRecord({ table, fields, transactionScope: flags.scope, inst });

  logToFile({ timestamp: new Date().toISOString(), command: 'create', instance: { id: inst.id, name: inst.name }, request: { table, scope: flags.scope }, durationMs: Date.now() - startMs, isError: result.status >= 400 });
  if (result.status >= 400) die(`Error ${result.status}: ${JSON.stringify(result.data)}`, 1);

  process.stdout.write(writeConfirmation('created', result.data?.result) + '\n');
}

async function cmdUpdate(positionals, flags) {
  const [table, sysId] = positionals;
  if (!table) die('Error: table name required.\n\n' + HELP_MAP.update, 4);
  if (!sysId) die('Error: sys_id required.\n\n' + HELP_MAP.update, 4);

  const fields = await requireStdinJson('update');
  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const result = await snClient.updateRecord({ table, sysId, fields, transactionScope: flags.scope, inst });

  logToFile({ timestamp: new Date().toISOString(), command: 'update', instance: { id: inst.id, name: inst.name }, request: { table, sysId, scope: flags.scope }, durationMs: Date.now() - startMs, isError: result.status >= 400 });
  if (result.status >= 400) die(`Error ${result.status}: ${JSON.stringify(result.data)}`, 1);

  process.stdout.write(writeConfirmation('updated', result.data?.result) + '\n');
}

async function cmdDelete(positionals, flags) {
  const [table, sysId] = positionals;
  if (!table) die('Error: table name required.\n\n' + HELP_MAP.delete, 4);
  if (!sysId) die('Error: sys_id required.\n\n' + HELP_MAP.delete, 4);

  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const result = await snClient.deleteRecord({ table, sysId, inst });

  logToFile({ timestamp: new Date().toISOString(), command: 'delete', instance: { id: inst.id, name: inst.name }, request: { table, sysId }, durationMs: Date.now() - startMs, isError: result.status >= 400 });
  if (result.status >= 400) die(`Error ${result.status}: ${JSON.stringify(result.data)}`, 1);

  process.stdout.write(JSON.stringify({ deleted: true, sys_id: sysId, table }, null, 2) + '\n');
}

async function cmdSchema(positionals, flags) {
  const table = positionals[0];
  if (!table) die('Error: table name required.\n\n' + HELP_MAP.schema, 4);

  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const result = await snClient.getTableStructure(table, inst);

  logToFile({ timestamp: new Date().toISOString(), command: 'schema', instance: { id: inst.id, name: inst.name }, request: { table }, durationMs: Date.now() - startMs, isError: !!result.error });
  if (result.error) die(`Table not found: ${table}`, 1);

  const cols = result.columns || [];
  const outRefs = result.references?.outgoing || [];
  const inRefs = result.references?.incoming || [];

  let text = `## Table: ${result.table.label} (${result.table.name})\n`;
  text += `sys_id: ${result.table.sys_id}\n`;
  if (result.table.super_class) text += `Extends: ${result.table.super_class.name} (${result.table.super_class.label})\n`;
  text += `\n### Columns (${cols.length}):\n`;
  for (const c of cols) {
    const ref = c.reference ? ` -> ${c.reference}` : '';
    const req = c.mandatory === 'true' ? ' [required]' : '';
    text += `- ${c.element} (${c.internal_type || 'unknown'}${ref})${req} — ${c.column_label || ''}\n`;
  }
  if (outRefs.length) {
    text += `\n### Outgoing References (${outRefs.length}):\n`;
    for (const r of outRefs) text += `- ${r.column} -> ${r.target_table} (${r.label})\n`;
  }
  if (inRefs.length) {
    text += `\n### Incoming References (${inRefs.length}):\n`;
    for (const r of inRefs) text += `- ${r.source_table}.${r.column} (${r.label})\n`;
  }
  if (result.suggestions) {
    text += `\n### Multiple matches found:\n`;
    for (const s of result.suggestions) text += `- ${s.name} (${s.label})\n`;
  }

  emitOutput(text, { forceStdout: flags.output === 'stdout' });
}

async function cmdScript(positionals, flags) {
  const [scriptInclude, method] = positionals;
  if (!scriptInclude) die('Error: ScriptInclude name required.\n\n' + HELP_MAP.script, 4);
  if (!method) die('Error: method name required.\n\n' + HELP_MAP.script, 4);

  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const params = {};
  for (const p of (flags.param || [])) {
    const idx = p.indexOf('=');
    if (idx === -1) die(`Error: --param must be key=value format, got: ${p}`, 4);
    params[p.slice(0, idx)] = p.slice(idx + 1);
  }

  const result = await snClient.callScriptInclude({
    scriptInclude, method,
    params: Object.keys(params).length ? params : undefined,
    inst,
  });

  logToFile({ timestamp: new Date().toISOString(), command: 'script', instance: { id: inst.id, name: inst.name }, request: { scriptInclude, method, params }, durationMs: Date.now() - startMs, isError: false });

  if (result.body?.includes('invalid token')) die('Session expired or invalid token. Try the call again.', 1);

  let output = result.body;
  const answerMatch = result.body?.match(/answer="([^"]*)"/);
  if (answerMatch) {
    const decoded = answerMatch[1]
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    try { output = JSON.stringify(JSON.parse(decoded), null, 2); } catch { output = decoded; }
  }

  emitOutput(`Status: ${result.status}\n\n${output}`, { forceStdout: flags.output === 'stdout' });
}

async function cmdApi(positionals, flags) {
  const path = positionals[0];
  if (!path) die('Error: API path required.\n\n' + HELP_MAP.api, 4);

  const method = (flags.method || 'GET').toUpperCase();
  const inst = getInst(flags.instance);
  const startMs = Date.now();

  let body;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const raw = await readStdin();
    if (raw && raw.trim()) {
      try { body = JSON.parse(raw); } catch (err) { die(`Error: invalid JSON on stdin — ${err.message}`, 3); }
    }
  }

  const result = await snClient.restApiCall({ apiPath: path, httpMethod: method, body, inst });

  logToFile({ timestamp: new Date().toISOString(), command: 'api', instance: { id: inst.id, name: inst.name }, request: { path, method }, durationMs: Date.now() - startMs, isError: result.status >= 400 });
  if (result.status >= 400) die(`Error ${result.status}: ${JSON.stringify(result.data, null, 2)}`, 1);

  const text = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
  emitOutput(text, { forceStdout: flags.output === 'stdout' });
}

async function cmdUpdateSet(positionals, flags) {
  const nameOrId = positionals[0];
  if (!nameOrId) die('Error: update set name or sys_id required.\n\n' + HELP_MAP['update-set'], 4);

  const inst = getInst(flags.instance);
  const startMs = Date.now();

  const result = await snClient.switchUpdateSet({
    sys_id: flags['sys-id'] ? nameOrId : undefined,
    name: flags['sys-id'] ? undefined : nameOrId,
    inst,
  });

  logToFile({ timestamp: new Date().toISOString(), command: 'update-set', instance: { id: inst.id, name: inst.name }, request: { nameOrId, isSysId: !!flags['sys-id'] }, durationMs: Date.now() - startMs, isError: result.status >= 400 });
  if (result.status >= 400) die(`Error ${result.status}: ${JSON.stringify(result.data?.raw)}`, 1);

  const { sys_id, name } = result.data;
  process.stdout.write(`Active update set switched.\n\n${JSON.stringify({ sys_id, name }, null, 2)}\n`);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

const HANDLERS = {
  instances:    cmdInstances,
  query:        cmdQuery,
  get:          cmdGet,
  create:       cmdCreate,
  update:       cmdUpdate,
  delete:       cmdDelete,
  schema:       cmdSchema,
  script:       cmdScript,
  api:          cmdApi,
  'update-set': cmdUpdateSet,
};

const argv = process.argv.slice(2);
const cmd = argv[0];

if (!cmd || cmd === '--help' || cmd === '-h') {
  process.stdout.write(HELP_TOP + '\n');
  process.exit(0);
}

if (!HANDLERS[cmd]) {
  die(`Unknown command: ${cmd}\n\nRun \`simon --help\` for available commands.`);
}

if (argv.slice(1).includes('--help') || argv.slice(1).includes('-h')) {
  process.stdout.write((HELP_MAP[cmd] || '') + '\n');
  process.exit(0);
}

let values = {}, positionals = [];
if (cmd !== 'instances') {
  try {
    const parsed = parseArgs({ args: argv.slice(1), options: OPTS_MAP[cmd], allowPositionals: true, strict: true });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    die(`Error: ${err.message}\n\nRun \`simon ${cmd} --help\` for usage.`, 4);
  }
}

HANDLERS[cmd](positionals, values).catch(err => die(`Unexpected error: ${err.message}`, 1));
