# Store App Install / Upgrade — Hints

## Key Tables / APIs

| API / Table | Purpose |
|-------------|---------|
| `sys_scope` | Check installed app versions — query `scope=<scope_name>`, returns `version` |
| `sys_app_version` | Check available versions in the store repo — returns all versions across all apps |
| `v_plugin` | Platform plugins only (NOT store apps) — query by `name` or `id` |
| `/api/sn_appclient/appmanager/app/{sys_id}` | Full app details: installed version, latest version, suite siblings, `can_install_or_upgrade`, `block_install` |
| `/api/sn_appclient/appmanager/app_info_from_store/{sys_id}/{version}` | Store-side metadata for a specific version — returns a different `sys_id` (store record ID, not scope ID) |
| `/api/sn_appclient/appmanager/` (operations) | Internal App Manager API — lists available ops via `sys_ws_operation` query on `web_service_definition.name=AppManager(Internal API)` |
| `/api/sn_cicd/app_repo/install` | **Primary install/upgrade API** — bypasses suite UI |
| `/api/sn_cicd/progress/{trackerId}` | Poll install progress — **may return 401 on some instances** (ACL issue); use `sys_execution_tracker` table instead |
| `sys_execution_tracker` | **Preferred progress poll** — query by `sys_id=<trackerId>`; fields: `state`, `percent_complete`, `message` |

---

## How to Check If an App Is Installed and What Version

```bash
simon query sys_scope \
  --query "scope=<scope_name>" \
  --fields "name,scope,version"
```

To find the latest available version:
```bash
simon query sys_app_version \
  --query "scope=<scope_name>" \
  --fields "name,scope,version" \
  --order-by version --order-dir desc --limit 1
```

Or use the App Manager API which returns both at once:
```
GET /api/sn_appclient/appmanager/app/<scope_sys_id>
```
Key response fields: `version` (installed), `latest_version`, `can_install_or_upgrade`, `block_install`, `dependencies`, `suiteData.siblings`.

---

## Efficient Approach: Bypass Suite to Install/Upgrade a Single App

The Plugin Manager UI groups some store apps into "Suites". If sibling apps in the suite are blocked (e.g. due to missing product entitlement), the UI prevents the whole suite from installing — even if the target app itself is not blocked.

**Workaround: use the CI/CD REST API directly.**

```
POST /api/sn_cicd/app_repo/install
     ?sys_id=<scope_record_sys_id>
     &version=<target_version>
     &auto_upgrade_base_app=true
```

- `sys_id` = the `sys_id` from `sys_scope` for the app (NOT the version-specific store record ID)
- `version` = target version string (e.g. `8.0.5`)
- `auto_upgrade_base_app=true` = allows auto-upgrading dependency apps that are out of date

**Fire install via simon CLI:**
```bash
simon api "/api/sn_cicd/app_repo/install?sys_id=<sys_id>&version=<version>&auto_upgrade_base_app=true" \
  -i <instance> -X POST
```
Tracker ID is in the response at `result.links.progress.id`.

**Poll progress (preferred — use table API):**
```bash
simon query sys_execution_tracker -i <instance> \
  --query "sys_id=<trackerId>" \
  --fields "name,state,percent_complete,message"
```
States: `0`=Pending, `1`=Running, `2`=Successful, `3`=Failed.

Poll multiple trackers at once:
```bash
simon query sys_execution_tracker -i <instance> \
  --query "sys_idIN<id1>,<id2>,<id3>" \
  --fields "sys_id,name,state,percent_complete,message" --limit 50
```

**Alternative (may 401):**
```
GET /api/sn_cicd/progress/<trackerId>
```
The `/api/sn_cicd/progress/` REST endpoint returns 401 on some instances due to ACL restrictions, even when the install POST succeeded. Use `sys_execution_tracker` instead.

The `sys_scope` version field updates to the new version before the tracker reaches state 2 — verify success by checking `sys_scope`, not just the tracker. The tracker may stick at 98% for several minutes while post-install scripts run.

---

## Now Assist Skill Kit (`sn_skill_builder`) — Specific Info

| Field | Value |
|-------|-------|
| Scope | `sn_skill_builder` |
| sys_id (scope record) | `3c4af9c2cbb27fe5ddfa33fe34444568` |
| Suite name | "Now assist" (v28.7.0) |

The suite includes `sn_skills_int` (Skills foundation) and `sn_skills_int_ws` (Skills Workspace) — these are **HR/WFO employee skills tracking apps**, unrelated to Now Assist AI skills. They are blocked on instances without the HR/WFO product entitlement. The Skill Kit itself does NOT depend on them.

---

## Gotchas

- **App Manager internal API is broken for upgrades:** Both `GET /api/sn_appclient/appmanager/app/update` and `GET /api/sn_appclient/appmanager/app/install` fail with "Unable to process schema and dependencies for id: null" — regardless of which sys_id you use (scope ID, version ID, store record ID). Use the CI/CD API instead.
- **`POST /api/sn_cicd/app_repo/install` requires query parameters**, not a JSON body. Body is silently ignored and causes "Missing parameter: sys_id or scope required".
- **`sys_store_app` and `sys_plugins` tables are ACL-blocked** for API users — use `sys_scope` and `sys_app_version` instead.
- **`v_plugin` only lists platform plugins**, not store apps. Store apps live in `sys_scope`.
- **Suite siblings ≠ dependencies.** The "Now Assist" suite bundles many unrelated apps together for the Store UI. The blocked siblings (`sn_skills_int`, `sn_skills_int_ws`) are not in the Skill Kit's `dependencies` field — they're just co-packaged in the suite. The CI/CD API only resolves real dependencies.
- **The App Manager `installations` endpoint** (`GET /api/sn_appclient/appmanager/installations`) throws a 500 Script Evaluation Exception — it's broken on this instance/version.
- **Tracker progress can stall at 98%** for several minutes during post-install script execution. Don't assume it failed — verify via `sys_scope` version instead.
- **`/api/sn_cicd/progress/<id>` can return 401** even when the install POST worked fine. Query `sys_execution_tracker` by `sys_id` instead — same data, no ACL issue.
