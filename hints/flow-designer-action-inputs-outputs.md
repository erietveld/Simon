# Flow Designer Action Inputs/Outputs — Hints

## Key Tables
| Table | Purpose |
|---|---|
| `sys_hub_action_type_definition` | The action itself (name, description, scope, state) |
| `sys_hub_action_input` | Input variable definitions for an action |
| `sys_hub_action_output` | Output variable definitions for an action |

## Efficient Approach

Use `model_id` — **NOT** `action_type_definition` — when querying inputs/outputs:

```bash
simon query sys_hub_action_input \
  --query "model_id=<action_sys_id>" \
  --fields "sys_id,element,label,internal_type,mandatory,default_value,hint,order,attributes" \
  --order-by order

simon query sys_hub_action_output \
  --query "model_id=<action_sys_id>" \
  --fields "sys_id,element,label,internal_type,order,attributes" \
  --order-by order
```

- `element` = programmatic name (e.g. `chat_id`, `credential_alias`)
- `label` = display label shown in Flow Designer
- `attributes` = UI type info (e.g. `uiType=string`, `uiType=reference`, `uiType=document_id`)

## Gotchas
- `action_type_definition` as a query filter does NOT work correctly — returns the entire table. Always use `model_id=<sys_id>` instead.
- `type` field is not populated at the API level; use `internal_type` and `attributes` instead.
- Credential Alias inputs have type `document_id` with `staticDependent=sys_alias` in attributes (reference `sys_alias` table, not `sys_hub_credential_alias`).
