# OOB Flow Designer Actions & Subflows — Hints

## How to Search

### Subflows (preferred for AI agents — usually have string-only inputs)
```bash
simon query sys_hub_flow \
  --query "nameLIKE<keyword>^active=true^type=subflow" \
  --fields "sys_id,name,description" \
  --display-value all --limit 20
```

### Flow Actions
```bash
simon query sys_hub_action_type_definition \
  --query "nameLIKE<keyword>^active=true" \
  --fields "sys_id,name,description,state,accessible_from" \
  --display-value all --limit 20
```

To check inputs for either, see [flow-designer-action-inputs-outputs.md](flow-designer-action-inputs-outputs.md).

## Commonly Useful OOB Subflows & Actions for Comments

| Name | Type | sys_id | Inputs | Notes |
|---|---|---|---|---|
| **Add Worknotes** | subflow | `9b9ec8fe531130101bd3ddeeff7b128d` | table (string), sysid (GUID), work_notes (string) | Works on any table; all string inputs — **preferred for AI agents** |
| **Update work_notes as System** | subflow | `2a9ac6d1c37311105d12a78e8740ddf0` | table_name (string), record_sysid (GUID), field_name (string), journal_message (string) | Most flexible; any table, any journal field |
| Add comment to ticket | action | `008b13afff6a221009b5ffffffffffae` | number (string), comment (string) | Customer-visible comment; limited to incident + sc_req_item |
| Add Work Note To Task | action | `10f7bbf7e7b00300c4726188d2f6a9db` | ah_task (Reference→task), ah_work_note (string) | **Avoid for AI agents** — ah_task is a Reference type |

## Using as AI Agent Tools

See [ai-agent-config.md](ai-agent-config.md) for full patterns:
- Subflows → "Add a Subflow tool to an agent"
- Flow Actions → "Add a Flow Action tool to an agent"

Key differences:
| | Subflow tool | Flow Action tool |
|---|---|---|
| `sn_aia_tool.type` | `subflow` | `action` |
| `target_document_table` | `sys_hub_flow` | `sys_hub_action_type_definition` |
| `target_document` | subflow sys_id | _(not always used)_ |
| Script / input_schema | empty | empty |

## Gotchas

- **Prefer subflows over flow actions for AI agents** — flow actions often require Reference or GUI-type inputs that agents can't provide
- Prefer subflows/actions over CRUD tools when an OOB option exists (e.g. "Add Worknotes" subflow instead of a CRUD update on work_notes_list)
- "Add comment to ticket" is scoped to Now Assist and only supports incident + sc_req_item
- "Add Work Note To Task" has a Reference-type input (`ah_task`) — agents can't populate this; use the "Add Worknotes" subflow instead
