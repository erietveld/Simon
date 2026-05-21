# AI Agent Tools — Hints

How to add tools to an agent. See `ai-agent-config.md` for table reference and architecture.

## Add a Record Lookup (CRUD) Tool

Step 1 — create the tool definition:
```bash
simon create sn_aia_tool --body - <<'EOF'
{
  "name": "<ToolName>",
  "type": "crud",
  "record_type": "Custom",
  "description": "<what the tool does>",
  "script": "<copy GlideRecordSecure script from an existing crud tool>",
  "input_schema": "[{\"name\":\"crudInputs\",\"description\":\"<description>\"}]",
  "target_document_table": "sn_aia_tool"
}
EOF
```

Step 2 — assign tool to agent with query config:
```bash
simon create sn_aia_agent_tool_m2m --body - <<'EOF'
{
  "name": "<ToolName>",
  "agent": "<sn_aia_agent_sys_id>",
  "tool": "<sn_aia_tool_sys_id>",
  "execution_mode": "autopilot",
  "active": "true",
  "description": "<description>",
  "entity": "sn_aia_agent",
  "entity_id": "<sn_aia_agent_sys_id>",
  "widgets": "db0e858eff62b210f465ffffffffff2c",
  "pre_message": "<Doing X...>",
  "post_message": "<Done X>",
  "inputs": "[{\"name\":\"crudInputs\",\"description\":\"CRUD Input Variables. These are already pre-defined. Under no circumstances should you prompt the user for this information or attempt to change these values.\",\"value\":{\"operation\":\"lookup\",\"table\":{\"value\":\"<table_name>\",\"displayValue\":\"<Table Label>\"},\"query\":\"<encoded_query>\",\"returnFields\":[{\"excludedOperators\":[],\"extendedOperators\":null,\"name\":\"<field>\",\"label\":\"<Label>\",\"type\":\"string\",\"referenceTable\":null,\"referenceTableDefaultField\":null,\"referenceKey\":null,\"dictionaryAttributes\":[],\"id\":\"<field>\",\"sublabel\":\"<field>\"}],\"limit\":\"1\",\"orderBy\":\"\",\"sortType\":\"\"}}]"
}
EOF
```

---

## Add a Subflow Tool

For tools that call OOB subflows (preferred over Flow Actions — subflows typically have string-only inputs).

Step 1 — find the OOB subflow:
```bash
simon query sys_hub_flow \
  --query "nameLIKE<keyword>^active=true^type=subflow" \
  --fields "sys_id,name,description" \
  --display-value all
```

Step 2 — create the tool definition:
```bash
# target_document links to the actual subflow
simon create sn_aia_tool --body - <<'EOF'
{
  "name": "<ToolName>",
  "type": "subflow",
  "record_type": "Custom",
  "target_document_table": "sys_hub_flow",
  "target_document": "<sys_hub_flow_sys_id>",
  "description": "<what the tool does, include input names>",
  "input_schema": "[]",
  "script": ""
}
EOF
```

Step 3 — assign tool to agent:
```bash
simon create sn_aia_agent_tool_m2m --body - <<'EOF'
{
  "name": "<ToolName>",
  "agent": "<sn_aia_agent_sys_id>",
  "tool": "<sn_aia_tool_sys_id>",
  "execution_mode": "autopilot",
  "active": "true",
  "description": "<input mapping instructions for the LLM>",
  "entity": "sn_aia_agent",
  "entity_id": "<sn_aia_agent_sys_id>",
  "display_output": "false",
  "inputs": "[]"
}
EOF
```

---

## Add a Flow Action Tool

For tools that call OOB Flow Designer actions. **Prefer subflows** when available — flow actions often require Reference or GUI-type inputs that agents can't provide.

Step 1 — find the OOB flow action:
```bash
simon query sys_hub_action_type_definition \
  --query "nameLIKE<keyword>^active=true" \
  --fields "sys_id,name,description" \
  --display-value all
```

Step 2 — create the tool definition:
```bash
simon create sn_aia_tool --body - <<'EOF'
{
  "name": "<ToolName>",
  "type": "action",
  "record_type": "Custom",
  "target_document_table": "sys_hub_action_type_definition",
  "description": "<what the tool does, include input names>",
  "input_schema": "[]",
  "script": ""
}
EOF
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

## CRUD Update tool reports success but nothing changes

Symptom: an `update` Record Operations tool consistently returns
`"1 out of 1 record updated in the <table> table."` but the target field never moves. `sys_mod_count` increments and `sys_updated_by` becomes the agent's run-as user, but the audit/history shows no field change. Easy to misdiagnose as an ACL/role problem.

Cause: the tool's `crudInputs` on `sn_aia_agent_tool_m2m.inputs` is missing the `fieldValues` array. The OOB CRUD script does:
```js
var fieldValues = inputs.crudInputs.fieldValues ? inputs.crudInputs.fieldValues : [];
```
With no `fieldValues`, the loop runs zero `gr.setValue()` calls, then calls `gr.update()` — a no-op write that bumps mod_count. The tool's success message is based on the returned sys_id, so it lies cheerfully.

How to confirm:
```bash
# pull the tool task and look at metadata.inputs.crudInputs — fieldValues will be missing
simon get sn_aia_execution_task <tool_task_sys_id> -i <instance> --output stdout \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['metadata']['value'])"
```

Fix: in AI Agent Studio open the tool's Record Operation config and add an "Inputs to update" row mapping each field to a template (e.g. `state` → `{{new_state}}`). The script's `parseValue` resolves `{{var}}` against the input bag, including choice-label matching. In the JSON on `sn_aia_agent_tool_m2m.inputs`, this lands as:
```json
"fieldValues":[{"field":{"id":"state","type":"choice"},"value":{"fieldValue":"{{new_state}}"}}]
```

## Duplicate tool m2m rows (Build Agent side effect)

Symptom: an agent gets "stuck" mid-run — `sn_aia_execution_plan.state=in_progress`, the agent task is `ongoing`, and a few gen_ai/tool tasks fire then silence. Often the run actually does have a tool failure that's not loud.

Likely cause when the agent was edited via Build Agent: a duplicate `sn_aia_agent_tool_m2m` row pointing at the **same** underlying `sn_aia_tool`. Build Agent re-adds tools when it edits an agent, and existing rows aren't always deduped — you end up with two entries with the same `tool` reference but different m2m sys_ids and creation timestamps.

How to detect:
```bash
simon query sn_aia_agent_tool_m2m \
  --query "agent=<agent_sys_id>" \
  --fields "sys_id,name,tool,active,sys_created_on,sys_created_by"
```
Group by `tool.value` — any tool sys_id appearing more than once is a duplicate. The earlier row is usually the legitimate one; the later one is the unwanted clone.

Fix: delete (or deactivate) the later-created m2m row. Don't touch `sn_aia_tool` itself.

Note: `sys_created_by` will show your user even when Build Agent is the actual creator — Build Agent acts under your identity, so audit alone can't distinguish manual vs Build-Agent creates. Use timestamp clustering and your session memory instead.

Related: a duplicate Search/RAG tool is especially painful because the agent's instructions may mandate "Search before write" — every Create blocks on a Search call, and if both Search rows are misconfigured (e.g. missing `search_profile`) the agent loops without progress until the run times out.

## Gotchas

- "Record lookup" tool type displays as "Record Operation" in UI but the API value is `type=crud`
- Tool query config (table, query, return fields) lives in `sn_aia_agent_tool_m2m.inputs` as JSON — NOT on `sn_aia_tool`
- `sn_aia_agent_tool_m2m.inputs` must be wrapped as `[{"name":"crudInputs","value":{...},"description":"..."}]` — a flat object won't render in Agent Studio
- `sn_aia_tool` (crud type) also needs `script` (copy GlideRecordSecure script from an existing crud tool), `input_schema` (`[{"name":"crudInputs","description":"..."}]`), and `target_document_table=sn_aia_tool` — without these the UI shows an empty tool form
- `sn_aia_agent_tool_m2m` needs `entity=sn_aia_agent`, `entity_id=<agent_sys_id>`, `widgets=db0e858eff62b210f465ffffffffff2c` for the UI to render the Record Operation widget correctly
- Flow Action: `sn_aia_tool.type` = `action`, `target_document_table` = `sys_hub_action_type_definition`. Script and input_schema are empty. **Prefer subflows** — flow actions often have Reference-type inputs that agents can't handle.
- Subflow: `sn_aia_tool.type` = `subflow`, `target_document_table` = `sys_hub_flow`, `target_document` = `<subflow_sys_id>`. Script and input_schema are empty.
- `display_output` on `sn_aia_agent_tool_m2m`: set to `false` to suppress the tool result card shown to the user in conversation
