---
name: Flow Designer — version history & revert
description: Where Flow Designer stores per-publish history of a flow, and how to roll back to a prior version when the visual builder gets wedged
type: reference
---

# Flow Designer — Version History & Revert

When a Flow Designer flow gets broken by an in-editor change, the right table to look at is **`sys_update_version`**. The revert itself is UI-only — there is no REST endpoint, no client-callable script include, no public `GlideUpdateManager2.revertVersion()` over the wire.

## Where history lives

| Table | What it has | Use it for |
|---|---|---|
| **`sys_update_version`** | Full version chain per `name`. `state=current` is the live record; `state=previous` are older publishes. Every Save in Flow Designer creates a row. Includes versions sourced from `sys_update_set`, `sys_upgrade_history`, and `sys_store_app`. | **Finding and reverting to a prior flow state.** |
| `sys_hub_flow_snapshot` | One row per flow (`parent_flow` reference). Gets **overwritten** on every publish — no history. | Reading the current compiled snapshot only. |
| `sys_audit` | Field-level change log if auditing is enabled on the table. Flow records typically aren't audited, so this returns nothing for flows. | Don't bother for flows. |
| `sys_update_xml` | Only the most recent update-set capture for the record. Not a history chain. | Don't bother for flow history — use `sys_update_version`. |

## Query the history

```bash
simon query sys_update_version \
  -q "name=sys_hub_flow_<flow_sys_id>^ORDERBYDESCsys_created_on" \
  -f sys_id,sys_created_on,sys_created_by,state,source_table \
  -l 50 -i <instance>
```

- `name` follows the pattern `<table>_<sys_id>` — for flows, that's `sys_hub_flow_<flow_sys_id>`.
- `source_table=sys_update_set` ⇒ user/developer save. `source_table=sys_upgrade_history` ⇒ platform upgrade preserved this version. `source_table=sys_store_app` ⇒ shipped with an app install.
- A single editing session typically writes several `sys_update_version` rows seconds apart — pick a save that pre-dates the editing burst.

> Component records of a flow (action instances, steps, triggers) have their **own** sys_update_version chains under different `name`s. Reverting the top-level `sys_hub_flow_<sys_id>` row alone usually pulls the linked components with it through the platform's revert logic, but if a flow stays partially broken after revert, check those component records.

## Triggering the revert

The "Revert to this version" UI action sits on the form view of a `sys_update_version` record. Backed by `GlideUpdateManager2` (Java), it pops a confirm modal and then re-applies the version's `payload`. No REST/scripted path exists, so handing the user a deep link is the fastest play:

```
https://<instance>.service-now.com/sys_update_version.do?sys_id=<version_sys_id>
```

Open → click **Revert to this version** → confirm → refresh Flow Designer.

## What we tried first (and why it doesn't work)

- `sys_hub_flow_snapshot` filtered by `flow=<id>` — wrong field name (it's `parent_flow`); even with the right field, only one row exists per flow.
- `sys_audit` on `tablename=sys_hub_flow` — empty (auditing not enabled).
- `sys_update_xml` on `name=sys_hub_flow_<id>` — single row, the most recent only.
- Searching `sys_ui_page` / `sys_processor` / `sys_script_include` for a revert endpoint — the UI action shows a modal (`revert_update_version_confirm`) that lives in the platform-built-in UI, not as a record we can call.

Skip those steps next time. Go straight to `sys_update_version`.

## Notes

- The "Default" update set on a dev instance still records flow versions — you do **not** need a named update set for history to accumulate.
- Reverting a customer-modified OOB flow can fall back to the upgrade-history version, which may erase intentional customizations. Inspect `source_table` on the candidate row before reverting.
- This pattern works for any artifact tracked by update sets — not just flows. The `name` field changes (`sys_script_include_<id>`, `sys_ui_action_<id>`, etc.).
