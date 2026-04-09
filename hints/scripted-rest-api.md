# Scripted REST API — Hints

> **Permission rule:** Always ask the user for explicit confirmation before creating, modifying, or deleting custom API endpoints on any instance. These are shared infrastructure changes.

## Key Tables
| Table | Purpose |
|---|---|
| `sys_ws_definition` | Scripted REST API service (the top-level service record) |
| `sys_ws_operation` | Individual resources/operations within a service |

> **Do NOT confuse with `sys_web_service`** — that is the legacy SOAP web service table. Querying it will return results but they are SOAP services, not Scripted REST APIs.

## Creating a Scripted REST API Service (`sys_ws_definition`)

Required fields:
| Field | Notes |
|---|---|
| `name` | Display name |
| `service_id` | URL slug (e.g. `simon_kb_publisher`) — becomes part of the base URI |
| `namespace` | Typically `x_<shortname>` (e.g. `x_simon`). Must match namespace format — avoid hyphens or `kb` suffixes that may fail validation |
| `is_active` / `active` | Set to `true` |
| `web_service_version` | Can be left empty for unversioned services |

Base URI pattern: `/api/<namespace>/<service_id>`

Example: namespace=`x_simon`, service_id=`simon_kb_publisher` → `/api/x_simon/simon_kb_publisher`

## Creating a Resource (`sys_ws_operation`)

Required fields:
| Field | Notes |
|---|---|
| `web_service_definition` | sys_id of the parent `sys_ws_definition` record |
| `name` | Display name |
| `http_method` | GET, POST, PUT, PATCH, DELETE |
| `relative_path` | e.g. `/publish/{article_sys_id}` — path params are available via `request.pathParams` |
| `operation_script` | Server-side JS; use `request`, `response` objects |
| `requires_authentication` | Typically `true` |
| `requires_acl_authorization` | Typically `true` |

## Example Script (KB Publisher)

```javascript
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
  var articleSysId = request.pathParams.article_sys_id;
  var gr = new GlideRecord('kb_knowledge');
  if (gr.get(articleSysId)) {
    gr.setValue('workflow_state', 'published');
    gr.setValue('published', gs.nowDateTime());
    gr.update();
    response.setStatus(200);
    response.setBody({ status: 'published', sys_id: articleSysId });
  } else {
    response.setStatus(404);
    response.setBody({ error: 'Article not found' });
  }
})(request, response);
```

## Calling the API

Use `simon api` with method POST and the full path:

Example:
```bash
simon api "/api/x_simon/simon_kb_publisher/publish/<article_sys_id>" -X POST
```

## Cleanup — Removing a Scripted REST Service

To remove a service created by mistake or during testing:
1. Query `sys_ws_definition` for records matching the namespace/service_id to find the sys_id
2. Delete all child `sys_ws_operation` records first (query by `web_service_definition=<parent_sys_id>`)
3. Delete the `sys_ws_definition` record

> **Always ask for explicit user confirmation before deleting records on any instance.**

## Gotchas
- Namespace format matters — `x_simon_kb` may fail; use a simple `x_<shortname>` form.
- `web_service_version` appears required in schema but can be empty for unversioned services.
- Server-side GlideRecord updates in Scripted REST scripts bypass business rules that target REST API writes (important for KB publishing on v3 KBs).
- **Do not store instance names, sys_ids, or any instance-specific data in hint files.** Hints document patterns, not live data.
