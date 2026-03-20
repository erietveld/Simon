# Custom Subflow as AI Agent Tool — Hints

## Key Tables

| Table | Purpose |
|---|---|
| `sys_hub_flow` | Subflow definitions (custom and OOB); inspect via `label_cache` field |
| `sn_aia_tool` | AI agent tool definitions — `type=subflow` links to a `sys_hub_flow` record |
| `sn_aia_agent_tool_m2m` | Assigns a tool to an agent |

---

## How to Find a Custom Subflow

Custom subflows live in a scoped app. Query by `type=subflow` and filter by scope or name:

```
sn_query:
  table: sys_hub_flow
  query: type=subflow^nameLIKE<keyword>^sys_scope.scope=<app_scope>
  fields: sys_id,name,internal_name,active,status,generation_source,sys_scope
  display_value: all
```

- `generation_source=text2flow` means it was AI-generated via Flow Designer's natural-language feature
- `status=published` means it is active and callable
- Use `sys_scope.scope` to filter to a custom app (e.g. `x_myapp`)

---

## How to Inspect a Subflow's Inputs (Without UI)

The `label_cache` field on `sys_hub_flow` contains a JSON array of all variables and how they are wired internally. This is the fastest way to discover a subflow's inputs and what they map to.

```
sn_rest_api:
  GET /api/now/table/sys_hub_flow/<sys_id>
```

Then parse `label_cache`. Look for entries where `name` starts with `subflow.` — these are the subflow inputs:

```json
{ "name": "subflow.demand_number", "label": "Input➛demand number", "type": "string", ... }
{ "name": "subflow.text_note",     "label": "Input➛text note",      "type": "string", ... }
```

The `usedInstances` block on each variable shows which step GUIDs use it and which field they map to.

**Do NOT rely on:**
- `sys_hub_flow_input` — filter by `flow=` doesn't scope correctly
- `sys_hub_action_instance` — `model_id=` filter doesn't scope correctly either
- `sys_hub_flow_snapshot` — ACL-restricted, typically 404

---

## Creating a Custom Subflow

Subflows **cannot be created via the table REST API** — the Flow Designer uses a proprietary internal format. Options:

1. **Flow Designer UI** — build manually at `/now/flow-designer`
2. **text2flow (AI generation)** — available in the Flow Designer UI; describe the flow in natural language. The `generation_source=text2flow` flag confirms this origin.
3. **Update Set import** — export from another instance and import via `hints/update-set-import.md`

Once a subflow exists and is published, proceed to wire it as an agent tool.

---

## Wiring a Custom Subflow as an AI Agent Tool

> Full pattern with field details is in `ai-agent-config.md` → "Add a Subflow tool to an agent"

### Step 1 — Get the subflow sys_id
```
sn_query:
  table: sys_hub_flow
  query: name=<SubflowName>^type=subflow^status=published
  fields: sys_id,name
```

### Step 2 — Create the tool definition
```
sn_create_record:
  table: sn_aia_tool
  fields:
    name: <ToolName>
    type: subflow
    record_type: Custom
    target_document_table: sys_hub_flow
    target_document: <sys_hub_flow_sys_id>
    description: <tell the agent what this does and what inputs it takes>
    input_schema: "[]"
    script: ""
```

### Step 3 — Assign tool to agent
```
sn_create_record:
  table: sn_aia_agent_tool_m2m
  fields:
    name: <ToolName>
    agent: <sn_aia_agent_sys_id>
    tool: <sn_aia_tool_sys_id>
    execution_mode: autopilot
    active: true
    description: <input mapping instructions — name each input and what to pass>
    entity: sn_aia_agent
    entity_id: <sn_aia_agent_sys_id>
    display_output: false
    inputs: "[]"
```

**Key gotchas:**
- The subflow inputs are passed by the agent based on the `description` field on `sn_aia_agent_tool_m2m` — write it clearly (e.g. "Pass `demand_number` as the demand number string, `text_note` as the work note text")
- All subflow inputs must be string or GUID type — agents cannot pass Reference-type inputs (use subflows over flow actions for this reason)
- `display_output: false` suppresses the tool result card in the conversation UI
- `inputs: "[]"` is correct for subflow tools (unlike CRUD tools which embed a full `crudInputs` JSON blob)
