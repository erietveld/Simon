# Plugin / Store App Sync — Hints

## Key Tables / Properties

| Resource | Purpose |
|----------|---------|
| `sys_properties` | Holds `sn_appclient.apps_last_sync_time` — the authoritative last sync timestamp |
| `sys_trigger` | Scheduled jobs: "Collect Store Application Information" (weekly, Monday) |
| `sys_store_app` | Installed store apps — ACL-blocked via REST API for non-admin callers |

## How to Find Last Sync Time

Query `sys_properties` for the key property:
```bash
simon query sys_properties \
  --query "name=sn_appclient.apps_last_sync_time" \
  --fields "name,value,sys_id"
```
Returns the UTC timestamp of the last successful App Manager sync with the ServiceNow store.

## How to Perform a Live Store Sync

### Step 1 — Trigger the sync

```bash
simon api '/api/sn_appclient/appmanager/sync_apps?request_type=trigger_apps_sync' -i <instance>
```
Returns `{ "result": { "trackerId": "<sys_id>" } }`.

Note: This endpoint is **GET**, not POST (POST returns 405).

### Step 2 — Poll for completion

```bash
simon api '/api/sn_appclient/appmanager/sync_apps?request_type=get_apps_sync_status&tracker_id=<trackerId>' -i <instance>
```
Returns `{ "result": { "isComplete": false, "appsSyncProgress": "3.0", ... } }`.
Poll every ~5 seconds until `isComplete` is `true`. The `appsSyncProgress` field shows percentage (0–100).
Once complete, `apps_last_sync_time` in `sys_properties` will be updated.

### Querying cached catalog data (does NOT trigger a sync)

```
POST /api/sn_appclient/appmanager/apps?tab_context=updates
Body: {}
```
Returns array of apps with `version`, `latest_version`, `update_available` fields.
Other valid `tab_context` values: `installed`, `allApps`.

Note: GET on this endpoint returns 405 — must be POST.
Note: `/api/sn_appclient/appmanager/` root returns 400 — full path required.

## Scheduler Jobs

"Collect Store Application Information" (sys_id: `28272d8477040010bf05d4082b10611f`) runs weekly on Mondays. Re-queries store app data.

To force run: set `next_action` to a past timestamp via PATCH on the sys_trigger record, then wait for the scheduler tick.

## Useful sys_properties (sn_appclient namespace)

- `sn_appclient.apps_last_sync_time` — last sync UTC timestamp
- `sn_appclient.apps_sync_progress` — sync progress (0.0 = idle/complete)
- `sn_appclient.auto_update` — whether auto-update is enabled
- `sn_appclient.process.delta.apps.only` — delta sync vs full sync
- `sn_appclient.repository_base_url` — store endpoint (https://apprepo.service-now.com/)

## Gotchas

- `sys_store_app_refresh` table does NOT exist on current platform versions
- `sys_store_app` direct REST query is ACL-blocked (403) for non-admin OAuth callers
- `last_action` on `sys_trigger` is not reliably populated — use `next_action` to infer last run
- `sysevent` does not record plugin/store refresh events
- syslog LIKE queries on message content time out — avoid
