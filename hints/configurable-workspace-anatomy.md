# Configurable Workspace Anatomy — Tables, Wire-Up, Build Agent Gotchas

How a Configurable Workspace (the `/now/<path>/...` URL family) is assembled in the database, how the list-menu dropdown is populated, and what Build Agent tends to break when it "rebuilds" one.

Companion to:
- [workspace-dropdown-source.md](workspace-dropdown-source.md) — what makes a workspace appear in the unified-nav **Workspaces** dropdown (top-level discoverability)
- [workspace-fluent-sync-errors.md](workspace-fluent-sync-errors.md) — Fluent sync TS errors after creating a workspace
- [nowsdk-ui-page-apps.md](nowsdk-ui-page-apps.md) — for the build-agent SPA app variant

This file is about what lives **inside** a workspace once it's discoverable.

## Source of truth

Workspaces are now defined in Fluent (NowSDK), not built record-by-record in UI Builder. The Fluent `Workspace` object compiles down to a fixed set of platform tables. Public reference doc (Australia branch):

```
https://github.com/ServiceNow/ServiceNowDocs/blob/australia/markdown/application-development/servicenow-sdk/fluent-workspace-api.md
```

The doc explicitly lists the tables a `Workspace({...})` block produces — use this as your map when investigating.

## Table map

### Outer shell (one set per workspace)

| Table | Role |
|---|---|
| `sys_ux_page_registry` | The workspace itself. `path` = URL segment (e.g. `myworkspaceadmin`). `root_macroponent` = the App Shell. `admin_panel` → the app config. **Title appears in the Workspaces dropdown** (see [workspace-dropdown-source.md](workspace-dropdown-source.md)). |
| `sys_ux_app_config` | The app's configuration record. Routes hang off this. |
| `sys_ux_app_route` | One per URL route inside the workspace (`home`, `list`, `record`, `search`, `kb`, `dashboards`, `analytics-center`, `kpi-details`, `visualization-designer`, `notification-tray`, …). Each links a route name to a `screen_type` and the parent `app_config`. |
| `sys_ux_screen_type` / `sys_ux_screen` | The page templates the routes render. |
| `sys_ux_macroponent` | The component tree rendered inside a screen. |
| `sys_ux_page_property` | Per-page config values keyed by `name` (e.g. `listConfigId`, `routeConfigId`, `ribbonConfigId`, `chrome_header`, `chrome_toolbar`, `featureRoutes`, `globalSearchDataConfigId`, `actionConfigId`, `wbApplicabilityConfigId`). `page` = the registry sys_id. **This is where most "why doesn't X show up" problems hide.** |
| `sys_ux_registry_m2m_category` | M2M linking the registry to a Workspaces-dropdown category. |

### List menu (the left-nav with categories and lists)

| Table | Role |
|---|---|
| `sys_ux_list_menu_config` | The container ("Workspace List Configuration"). Referenced from the workspace via the `listConfigId` page property on `sys_ux_page_registry`. |
| `sys_ux_list_category` | A heading in the menu (e.g. "Open Items", "Recently Closed"). `configuration` → menu config. `order` controls display order. |
| `sys_ux_list` | An individual list entry under a category (e.g. "All", "Open"). `category` → list category. `table` = the table being listed. `condition` = encoded query. `columns` = comma-separated field list. |
| `sys_ux_applicability` | Optional role/audience gate per list. |

```
sys_ux_page_registry  ──(listConfigId page property)──►  sys_ux_list_menu_config
                                                              │
                                                              ▼
                                                       sys_ux_list_category  (Open Items, Recently Closed, …)
                                                              │
                                                              ▼
                                                       sys_ux_list  (All, Open, …)
```

## URL anatomy

```
/now/<path>/<route>/params/list-id/<sys_ux_list sys_id>/tiny-id/<short>
        │       │                       │
        │       │                       └── sys_id from sys_ux_list — if stale, the deep-link is dead but the dropdown still works
        │       └── sys_ux_app_route.route (e.g. "list", "record", "home")
        └── sys_ux_page_registry.path
```

## Discovery queries

### Find the workspace registry for a path

```bash
simon api "/api/now/table/sys_ux_page_registry?sysparm_query=path=<path>&sysparm_fields=sys_id,title,active,admin_panel,root_macroponent,sys_updated_on,sys_updated_by&sysparm_display_value=all" -i <instance>
```

If multiple rows come back with the same `path`, **that is a problem on its own** — see "Build Agent gotchas" below.

### Find the list menu config wired to a workspace

```bash
# Step 1: find the listConfigId page property for that registry
simon api "/api/now/table/sys_ux_page_property?sysparm_query=page=<registry_sys_id>^name=listConfigId&sysparm_fields=sys_id,value,sys_updated_on,sys_updated_by&sysparm_display_value=all" -i <instance>

# Step 2: the value is the sys_ux_list_menu_config sys_id
simon get sys_ux_list_menu_config <value> -i <instance>
```

### Enumerate categories and lists under a menu config

```bash
simon api "/api/now/table/sys_ux_list_category?sysparm_query=configuration=<menu_config_sys_id>^ORDERBYorder&sysparm_fields=sys_id,title,active,order&sysparm_display_value=all" -i <instance>

simon api "/api/now/table/sys_ux_list?sysparm_query=configuration=<menu_config_sys_id>^ORDERBYorder&sysparm_fields=sys_id,title,table,category,active&sysparm_display_value=all" -i <instance>
```

### List all routes a workspace exposes

```bash
simon api "/api/now/table/sys_ux_app_route?sysparm_query=app_config=<app_config_sys_id>&sysparm_fields=sys_id,name,route,route_type,screen_type,optional_parameters&sysparm_display_value=all" -i <instance>
```

## Diagnosing "no lists in the dropdown"

Check in this order:

1. **Is the `listConfigId` page property present and pointing somewhere real?**
   - `sys_ux_page_property` row with `page=<registry sys_id>` and `name=listConfigId` exists?
   - Its `value` resolves to an existing `sys_ux_list_menu_config`? (A 404 here = dangling pointer = empty dropdown.)
2. **Does the menu config have active categories?** (`sys_ux_list_category` rows pointing at it, `active=true`.)
3. **Do those categories have active lists?** (`sys_ux_list` rows with matching `category`, `active=true`.)
4. **Are there duplicate `sys_ux_page_registry` rows for the same `path`?** Whichever resolves first wins; the others' settings won't apply.

## Build Agent gotchas

Observed (2026-05-12) on a custom admin workspace. Build Agent ran a "rebuild" of the workspace and:

- **Created a second `sys_ux_page_registry` with the same `path`** as the original. Two rows, both `active=true`, same title. Only one resolves when navigating.
- **Created a parallel `sys_ux_app_config` + 16 fresh page properties + 11 app routes** under the new registry. The duplicate was actually *more complete* than the original (added `KB`, `Search`, `Home`, `KPI Details`, `Analytics Center`, `Visualization Designer`, `Notification tray`) — so deleting the duplicate would have *lost* features.
- **The new `listConfigId` page property pointed to a `sys_ux_list_menu_config` sys_id that doesn't exist** — the menu config it intended to reference was never created. Result: workspace renders but the lists dropdown is empty.

### Fix recipe (preferred — minimal)

Repoint the dangling `listConfigId` to the existing working menu config:

```bash
simon update sys_ux_page_property <listConfigId_prop_sys_id> -i <instance> --body - <<'EOF'
{ "value": "<real_menu_config_sys_id>" }
EOF
```

### Fix recipe (destructive — avoid unless you've checked the diff)

Delete the duplicate registry, its app_config, its page properties, and its app_routes. **Do this only after confirming the duplicate's route set is a strict subset of the original** — otherwise you lose workspace features. Compare routes with the query above before deleting anything.

### Why this happens

Speculation, not confirmed: Build Agent appears to regenerate the workspace from a fresh Fluent template rather than diff-and-patch the existing records. When the original list menu config sys_id doesn't match what the new template hashes to, the new template's `listConfigId` ends up referencing a sys_id that the same run was supposed to create but didn't (likely because the original `sys_ux_list_menu_config` blocked it as a duplicate on a unique key, but the page property was written anyway).

Don't trust Build Agent to leave existing workspace structure intact — diff `sys_ux_page_registry` / `sys_ux_app_config` / `sys_ux_page_property` row counts before and after a Build Agent rebuild, in the affected scope.

## Cross-reference table

When you see the URL token, jump to:

| URL fragment | Table | Field |
|---|---|---|
| `/now/<path>/` | `sys_ux_page_registry` | `path` |
| `/<route>/` | `sys_ux_app_route` | `route` (joined via `app_config` → `sys_ux_page_registry.admin_panel`) |
| `list-id/<id>` | `sys_ux_list` | `sys_id` |
| `config-id/<id>` | `sys_ux_list_menu_config` | `sys_id` |
| `tiny-id/<short>` | Tiny URL cache (not a config record — short URL service) | — |
