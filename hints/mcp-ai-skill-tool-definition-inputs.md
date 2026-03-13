# MCP AI Skill Tool Definition — Inputs Hints

## Key Tables

| Table | Purpose |
|---|---|
| `sn_mcp_ai_skill_tool_definition` | AI Skill Tool Definition — extends `sn_mcp_tool_definition`. Has a `tool` field pointing to `sn_nowassist_skill_config`. |
| `sn_mcp_tool_definition` | Parent table. Has incoming reference from `sn_mcp_tool_input.tool_definition`. |
| `sn_mcp_tool_input` | Base input table. Has `tool_definition`, `description`, `enabled`, `static_value`, `default_value`, `value` fields. |
| `sn_mcp_ai_skill_tool_input` | Subclass of `sn_mcp_tool_input`. Adds `name` and `tool_input` (ref to `sys_one_extend_definition_attribute`). |
| `sn_nowassist_skill_config` | NASK skill config. Has `skill_id` field pointing to `sys_one_extend_capability`. |
| `sys_one_extend_capability` | OneExtend Capability record. |
| `sys_one_extend_definition_attribute` | Input/output attribute definitions for a capability. Has `type` field: "input" or "output". Query by `capability=<sys_id>`. |

## How It Works — Efficient Approach

Tool inputs for an AI Skill Tool Definition are NOT fields on the parent record.
They are **child records** in `sn_mcp_ai_skill_tool_input` linked by `tool_definition`.

### Step 1: Find the capability's input attributes

```
sn_query:
  table: sys_one_extend_definition_attribute
  query: capability=<capability_sys_id>^type=input
  fields: sys_id,name,label,description,data_type,mandatory,default_value
  display_value: all
```

Get the capability sys_id via: `sn_nowassist_skill_config.skill_id`

### Step 2: Check existing tool inputs

```
sn_query:
  table: sn_mcp_ai_skill_tool_input
  query: tool_definition=<tool_definition_sys_id>
  display_value: all
```

### Step 3: Create missing input records

```
sn_create_record:
  table: sn_mcp_ai_skill_tool_input
  fields:
    tool_definition: <sn_mcp_ai_skill_tool_definition sys_id>
    tool_input: <sys_one_extend_definition_attribute sys_id>
    name: <attribute name>
    description: <attribute description>
    enabled: true
    static_value: false
    default_value: ""
    value: ""
  transaction_scope: <app scope sys_id>
```

## Chain of References

```
sn_mcp_ai_skill_tool_definition
  .tool -> sn_nowassist_skill_config
              .skill_id -> sys_one_extend_capability
                              [sys_one_extend_definition_attribute.capability]

sn_mcp_ai_skill_tool_input
  .tool_definition -> sn_mcp_ai_skill_tool_definition
  .tool_input      -> sys_one_extend_definition_attribute
```

## Gotchas

- `sn_mcp_tool_input` does NOT have `inputs`, `input_schema`, or `parameters` fields — those do not exist.
- `sys_one_extend_capability_input` does NOT exist as a table — querying it returns HTTP 400.
- Only create tool inputs for attributes with `type=input`. Output attributes (`type=output`) do not need corresponding records.
- `sn_mcp_ai_skill_tool_input.name` stores the attribute name (e.g. `joke_topic`).
- Always create in the correct app scope via `transaction_scope`.
