# KB Article Publishing — Query Hints

## Key Tables
| Table | Purpose |
|---|---|
| `kb_knowledge` | The article record (`workflow_state`, `published` fields) |
| `kb_knowledge_base` | KB configuration — check `kb_version` before attempting publish |
| `sys_hub_flow` | Flow Designer flows, e.g. "Knowledge - Instant Publish" |

## How Publishing Works

Behaviour depends on `kb_knowledge_base.kb_version`:

### kb_version = 2
Set both fields via API — `workflow_state` alone is not enough (the `published` date must also be stamped):
```json
PATCH kb_knowledge/{sys_id}
{ "workflow_state": "published", "published": "YYYY-MM-DD" }
```

### kb_version = 3 + publish workflow configured
A business rule reverts `workflow_state` back to `draft` on any direct write.
Publishing must go through `KnowledgeUIAction().publish()` server-side.

**What works:**
- UI → Publish button (triggers the workflow/flow server-side)
- Manually running the "Knowledge - Instant Publish" flow from Flow Designer UI

**What does NOT work via REST API:**
- Direct PATCH of `workflow_state` → reverted by business rule
- Creating `wf_context` record → ACL 403
- `POST /api/sn_fd/...` → 400, not a registered REST namespace
- Remote trigger ID on `sys_hub_flow` → also not routable externally
- The flow has `callable_by_client_api: false` — it is record-triggered, not callable

**Permanent fix:** Create a Scripted REST API on the instance that calls
`new global.KnowledgeUIAction().publishArticleById("kb_knowledge", articleSysId)`

## Efficient Query to Check KB Version
```
sn_get_record:
  table: kb_knowledge_base
  sys_id: <kb_knowledge_base sys_id from article>
  fields: title, kb_version, workflow, kb_publish_flow
```
