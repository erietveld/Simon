# Deleting Custom Applications — Query Hints

## Key Tables

| Table | Purpose |
|-------|---------|
| `sys_app` | Custom application records (extends `sys_scope`) |
| `sys_metadata` | All app artifacts (scripts, tables, UI actions, etc.) — linked via `sys_scope` field |

## Efficient Query

To find apps matching a creator or scope pattern:

```
sn_query:
  table: sys_app
  query: sys_created_byLIKEuser^ORscopeLIKEuser
  fields: name, scope, sys_created_by, version
```

To count artifacts an app contains before deleting:

```
sn_rest_api:
  path: /api/now/stats/sys_metadata?sysparm_query=sys_scope%3D<APP_SYS_ID>%5Esys_class_name%21%3Dsys_metadata_delete&sysparm_count=true
```

## How to Delete (with full cascade)

**There is no public REST API for cascade-deleting a custom app.**

The only reliable method that removes the app record AND all 100+ artifact records is a **background script** (`sys.scripts.do`):

```javascript
var gr = new GlideRecord('sys_app');
gr.get('<APP_SYS_ID>');
gr.deleteRecord();
```

For bulk deletion with a filter:

```javascript
var gr = new GlideRecord('sys_app');
var qc = gr.addQuery('sys_created_by', 'CONTAINS', 'user');
qc.addOrCondition('scope', 'CONTAINS', 'user');
gr.query();

var deleted = [];
var failed = [];

while (gr.next()) {
    var name = gr.getValue('name');
    var scope = gr.getValue('scope');
    var creator = gr.getValue('sys_created_by') || '(empty)';

    if (gr.deleteRecord()) {
        deleted.push(name + ' | ' + scope + ' | by: ' + creator);
    } else {
        failed.push(name + ' | ' + scope);
    }
}

gs.info('=== Deleted ' + deleted.length + ' apps ===');
for (var i = 0; i < deleted.length; i++) gs.info(deleted[i]);

if (failed.length > 0) {
    gs.info('=== Failed ' + failed.length + ' ===');
    for (var j = 0; j < failed.length; j++) gs.info(failed[j]);
}
```

## Gotchas

- **`sn_delete_record` (REST Table API) does NOT cascade** — it only removes the `sys_app` row, leaving all artifacts orphaned in `sys_metadata`.
- The UI delete button (`delete_app_dialog`) calls `gDeleteAppDialog.deleteApp()` — a compiled platform JS function, not exposed via REST.
- The `sn_cicd/app_repo/install` endpoint exists and accepts POST but has no uninstall/delete counterpart.
- The `sys_script_execution.do` processor exists but requires a browser session (CSRF token); it returns HTML when called via REST.
- Background script `deleteRecord()` on `sys_app` triggers platform-level cascade, removing all `sys_metadata` records scoped to that app.
- Navigate to background scripts at: `https://<instance>.service-now.com/sys.scripts.do`
