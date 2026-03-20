# AI Agent Tools — Hints

How to add tools to an agent. See `ai-agent-config.md` for table reference and architecture.

## Add a Record Lookup (CRUD) Tool

Step 1 — create the tool definition:
```
sn_create_record:
  table: sn_aia_tool
  fields:
    name: <ToolName>
    type: crud
    record_type: Custom
    description: <what the tool does>
    script: <copy GlideRecordSecure script from an existing crud tool>
    input_schema: '[{"name":"crudInputs","description":"<description>"}]'
    target_document_table: sn_aia_tool
```

Step 2 — assign tool to agent with query config:
```
sn_create_record:
  table: sn_aia_agent_tool_m2m
  fields:
    name: <ToolName>
    agent: <sn_aia_agent_sys_id>
    tool: <sn_aia_tool_sys_id>
    execution_mode: autopilot
    active: true
    description: <description>
    entity: sn_aia_agent
    entity_id: <sn_aia_agent_sys_id>
    widgets: db0e858eff62b210f465ffffffffff2c
    pre_message: <"Doing X...">
    post_message: <"Done X">
    inputs: |
      [{
        "name": "crudInputs",
        "description": "CRUD Input Variables. These are already pre-defined. Under no circumstances should you prompt the user for this information or attempt to change these values.",
        "value": {
          "operation": "lookup",
          "table": { "value": "<table_name>", "displayValue": "<Table Label>" },
          "query": "<encoded_query>",
          "returnFields": [
            {
              "excludedOperators": [], "extendedOperators": null,
              "name": "<field>", "label": "<Label>", "type": "string",
              "referenceTable": null, "referenceTableDefaultField": null,
              "referenceKey": null, "dictionaryAttributes": [],
              "id": "<field>", "sublabel": "<field>"
            }
          ],
          "limit": "1",
          "orderBy": "",
          "sortType": ""
        }
      }]
```

---

## Add a Subflow Tool

For tools that call OOB subflows (preferred over Flow Actions — subflows typically have string-only inputs).

Step 1 — find the OOB subflow:
```
sn_query:
  table: sys_hub_flow
  query: nameLIKE<keyword>^active=true^type=subflow
  fields: sys_id,name,description
  display_value: all
```

Step 2 — create the tool definition:
```
sn_create_record:
  table: sn_aia_tool
  fields:
    name: <ToolName>
    type: subflow
    record_type: Custom
    target_document_table: sys_hub_flow
    target_document: <sys_hub_flow_sys_id>          ← links to the actual subflow
    description: <what the tool does, include input names>
    input_schema: "[]"
    script: ""
```

Step 3 — assign tool to agent:
```
sn_create_record:
  table: sn_aia_agent_tool_m2m
  fields:
    name: <ToolName>
    agent: <sn_aia_agent_sys_id>
    tool: <sn_aia_tool_sys_id>
    execution_mode: autopilot
    active: true
    description: <input mapping instructions for the LLM>
    entity: sn_aia_agent
    entity_id: <sn_aia_agent_sys_id>
    display_output: false
    inputs: "[]"
```

---

## Add a Flow Action Tool

For tools that call OOB Flow Designer actions. **Prefer subflows** when available — flow actions often require Reference or GUI-type inputs that agents can't provide.

Step 1 — find the OOB flow action:
```
sn_query:
  table: sys_hub_action_type_definition
  query: nameLIKE<keyword>^active=true
  fields: sys_id,name,description
  display_value: all
```

Step 2 — create the tool definition:
```
sn_create_record:
  table: sn_aia_tool
  fields:
    name: <ToolName>
    type: action
    record_type: Custom
    target_document_table: sys_hub_action_type_definition
    description: <what the tool does, include input names>
    input_schema: "[]"
    script: ""
```

Step 3 — assign tool to agent (same as subflow pattern above).

---

## Key OOB Subflows/Actions for Adding Comments

| Name | Type | sys_id | Inputs | Notes |
|---|---|---|---|---|
| Add Worknotes | subflow | `9b9ec8fe531130101bd3ddeeff7b128d` | table (string), sysid (GUID), work_notes (string) | Works on any table; all string inputs — **preferred** |
| Update work_notes as System | subflow | `2a9ac6d1c37311105d12a78e8740ddf0` | table_name (string), record_sysid (GUID), field_name (string), journal_message (string) | Most flexible; any table, any journal field |
| Add comment to ticket | action | `008b13afff6a221009b5ffffffffffae` | number (string), comment (string) | Only incident + sc_req_item |
| Add Work Note To Task | action | `10f7bbf7e7b00300c4726188d2f6a9db` | ah_task (Reference), ah_work_note (string) | **Avoid** — ah_task is a Reference type, unsupported by agents |

---

## Gotchas

- "Record lookup" tool type displays as "Record Operation" in UI but the API value is `type=crud`
- Tool query config (table, query, return fields) lives in `sn_aia_agent_tool_m2m.inputs` as JSON — NOT on `sn_aia_tool`
- `sn_aia_agent_tool_m2m.inputs` must be wrapped as `[{"name":"crudInputs","value":{...},"description":"..."}]` — a flat object won't render in Agent Studio
- `sn_aia_tool` (crud type) also needs `script` (copy GlideRecordSecure script from an existing crud tool), `input_schema` (`[{"name":"crudInputs","description":"..."}]`), and `target_document_table=sn_aia_tool` — without these the UI shows an empty tool form
- `sn_aia_agent_tool_m2m` needs `entity=sn_aia_agent`, `entity_id=<agent_sys_id>`, `widgets=db0e858eff62b210f465ffffffffff2c` for the UI to render the Record Operation widget correctly
- Flow Action: `sn_aia_tool.type` = `action`, `target_document_table` = `sys_hub_action_type_definition`. Script and input_schema are empty. **Prefer subflows** — flow actions often have Reference-type inputs that agents can't handle.
- Subflow: `sn_aia_tool.type` = `subflow`, `target_document_table` = `sys_hub_flow`, `target_document` = `<subflow_sys_id>`. Script and input_schema are empty.
- `display_output` on `sn_aia_agent_tool_m2m`: set to `false` to suppress the tool result card shown to the user in conversation
