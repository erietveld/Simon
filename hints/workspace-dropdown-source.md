# Workspaces Dropdown — What Populates It

The **Workspaces** dropdown in the unified navigation header (next to All / Favorites / History / Admin) is sourced from **Configurable Workspace** records, *not* from the legacy Agent Workspace table.

## The Query

The dropdown lists `sys_ux_page_registry` records matching:

```
root_macroponent=c276387cc331101080d6d3658940ddd2^active=true
```

Where `c276387cc331101080d6d3658940ddd2` is the **Workspace App Shell** macroponent. Reference implementation: `CrWFSideBarHelper` script include (`checkWSInApplication`).

For an entry to actually appear, it also needs a matching row in `sys_ux_registry_m2m_category` linking the page_registry to a `sys_ux_experience_category` (typically `afb4e3e173322010f0ca1e666bf6a726` — "Workspace").

## Anatomy of a Workspace

A working Configurable Workspace needs **three** linked records:

| Table | Role |
|-------|------|
| `sys_ux_app_config` | Settings record (name, landing_path, scope) |
| `sys_ux_page_registry` | Route/title; `parent_app` = Unified Navigation app shell, `root_macroponent` = Workspace App Shell, `admin_panel` → the app_config sys_id |
| `sys_ux_registry_m2m_category` | Links page_registry → experience_category for dropdown visibility |

Studio's "Create workspace" flow creates all three automatically.

## Common Pitfalls / Diagnosis

- **"My new workspace doesn't appear"** — first check whether the user simply didn't scroll. The dropdown is alphabetical with a filter box; if the workspace name starts with T or W, A-only entries dominate the visible list. Tell them to type the name in the Filter input.
- **Hard reload may be needed** — unified nav caches the list per session.
- **Dead ends to skip:**
  - `sys_aw_master_config` — only the legacy "Agent Workspace" record lives here (typically one row total). NOT the dropdown source.
  - `sys_polaris_configurable_menu_item` / `sys_polaris_menu_config` — feeds All / Admin / Favorites menus, not the Workspaces dropdown.
  - `sys_app_application` / `sys_app_module` — feeds the All menu, not Workspaces.

## Diagnostic Query

To list everything that *should* appear in a user's Workspaces dropdown on an instance:

```bash
simon query sys_ux_page_registry \
  -q "root_macroponent=c276387cc331101080d6d3658940ddd2^active=true" \
  -f "title,sys_id,sys_scope" -l 200 -i <instance>
```

To check why a specific workspace is missing:

```bash
# 1. Page registry exists + matches macroponent?
simon query sys_ux_page_registry -q "titleLIKE<name>" \
  -f "title,active,root_macroponent,parent_app,admin_panel" -i <instance>

# 2. Category m2m link exists?
simon query sys_ux_registry_m2m_category -q "page_registry=<page_registry_sys_id>" -i <instance>
```

If both queries return active rows and the user still doesn't see the entry, it's a UI cache — hard reload.
