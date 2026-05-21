# Configurable Workspace — Fluent Sync Validation Errors

When a user creates a new **Configurable Workspace** in Studio, the auto-generated platform records sometimes fail Fluent TypeScript validation on the next sync. The records exist on the instance but contain values the Fluent type system rejects.

## Symptoms

Fluent sync log shows TS errors against files under `src/fluent/generated/`:

```
[error] sys_ui_view_<sys_id>.now.ts: error TS11: View name can only contain alphanumeric characters
[error] sys_security_acl_<sys_id>.now.ts: error TS2322: Type '""' is not assignable to type '"Existing" | "Local"'.
[error] sys_security_acl_<sys_id>.now.ts: error TS2322: Type '""' is not assignable to type '"allow" | "deny"'.
[warn]  sys_properties_<sys_id>.now.ts: warning TS11: Property names should begin with 'x_snc_<scope>.' to match the app scope
```

## Root cause

The Studio "Create workspace" flow creates these records with values that are valid in the platform but not in Fluent's stricter type model:

| Record | Bad value | Required |
|---|---|---|
| `sys_ui_view.name` | `workspace-<name>-0` (hyphens) | alphanumeric only |
| `sys_security_acl.local_or_existing` | `''` (empty) | `Local` or `Existing` |
| `sys_security_acl.decision_type` | `''` (empty) | `allow` or `deny` |
| `sys_properties.name` | `com.glide.<x>` (platform-style) | `x_snc_<scope>.<x>` (warning only) |

## Fix

1. **Rename the view** — strip hyphens via Table API:
   ```bash
   simon update sys_ui_view <sys_id> -i <instance> --body - <<'EOF'
   { "name": "workspace<scope>0" }
   EOF
   ```

2. **Set the ACL fields** — `Local` + `allow` for the standard "logged-in user" route ACL the workspace creates. **API update fails with 403 "ACL Exception Update Failed due to security constraints"** because writing to `sys_security_acl` needs elevated `security_admin`. Two paths:
   - **Deeplink + manual** (recommended for one-offs): `https://<instance>.service-now.com/sys_security_acl.do?sys_id=<sys_id>` → set fields → save.
   - Background script (if you have one wired up) — not via `simon` (no background-script command).

3. **Property scope warning** — purely informational; sync proceeds. If the property doesn't belong in your app scope (it's typically a platform property like `com.glide.hub.flow.disable_content_filtering` accidentally captured), delete it.

4. **Delete the stale generated `.ts` files** (in IDE or locally) so sync regenerates them from the now-clean instance state.

## Why `simon update sys_security_acl` fails

`sys_security_acl` writes require the user to elevate to `security_admin` — a session-level elevation, not just role assignment. Standard REST API auth doesn't carry that elevation, so even an admin user gets 403 on direct API writes. Background scripts run with elevated privileges.

## Verifying valid choice values

If the Fluent error gives you the allowed string union (e.g. `"Existing" | "Local"`), trust it — but you can also confirm via `sys_choice`:

```bash
simon api "/api/now/table/sys_choice?sysparm_query=name=sys_security_acl^element=local_or_existing^ORelement=decision_type&sysparm_fields=element,value,label" -i <instance>
```

Note: `local_or_existing` has both `Local` and `existing` (lowercase) as choice values on some instances due to localization rows — Fluent expects the **capitalized** `Local` / `Existing`.
