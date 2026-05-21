# MFA Enforcement — Hints

## Key Tables

| Table | Purpose |
|-------|---------|
| `sys_properties` | MFA global toggle: `glide.authenticate.multifactor`. Disabling also requires `glide.authenticate.multifactor.disable.reason` to be set first. |
| `sys_authentication_policy` | **AP1+ enforcer.** Policy `Enforce MFA for non-SSO logins` (sys_id `653209367f730210674d91fadc8665d3`) is the new MFA gate. Per-user enforcement_info no longer fully exempts a user. |
| `sys_mfa_policy_context` | Default MFA context (sys_id `c4895d9373512010616ca9843cf6a79f`) references the active step-up auth policy. The `RestrictDisablingMFAProp` BR reads this. |
| `sys_user_mfa_enforcement_info` | Per-user enforcement status (tracking / enforced / not_applicable). Setting `not_applicable` is **necessary but no longer sufficient** post-AP1 — the auth policy gate runs independently. |
| `multi_factor_role` | Role-based MFA trigger — roles listed here force MFA regardless of group exemptions |
| `sys_user_group` (name LIKE mfa) | "MFA Exempted User Group" — membership bypasses MFA (when role-based rules don't override) |
| `sys_user_multi_factor_setup` | Registered authenticator devices per user — ACL-blocked from REST API for read; delete ACL has `admin_overrides=true` but unusable without sys_ids |

## How It Works

MFA enforcement uses layered rules — role-based rules (`multi_factor_role`) take **precedence over** group exemptions. A user in the MFA Exempted User Group can still be enforced if they hold a role listed in `multi_factor_role` (e.g. `admin`, `user_admin`, `security_admin`).

Per-user enforcement state lives in `sys_user_mfa_enforcement_info.status`:
- `tracking` → being monitored, not yet enforced
- `enforced` → MFA is required on login
- `not_applicable` → exempted

## Nuclear Option — Fully Disable MFA on a Demo Instance (AP1+)

Use this when the user just wants MFA off everywhere on a demo. **Three things must change**, in this order — the order matters because of two layered BRs that block direct toggling:

```bash
# 1. Deactivate the auth policy gate (AP1+ enforcer).
#    Required first: the BR 'RestrictDisablingMFAProp' aborts the global-toggle
#    update if this policy is still active.
simon update sys_authentication_policy 653209367f730210674d91fadc8665d3 -i <inst> --body - <<'EOF'
{ "active": "false" }
EOF

# 2. Set the disable-reason property.
#    Required: the BR 'Discourage turning off MFA' aborts the toggle update
#    when 'glide.authenticate.multifactor.disable.reason' is empty.
simon query sys_properties --query "name=glide.authenticate.multifactor.disable.reason" --fields "sys_id" -i <inst>
simon update sys_properties <reason_sys_id> -i <inst> --body - <<'EOF'
{ "value": "Demo instance — MFA disabled for development access" }
EOF

# 3. Flip the global toggle.
simon query sys_properties --query "name=glide.authenticate.multifactor" --fields "sys_id" -i <inst>
simon update sys_properties <toggle_sys_id> -i <inst> --body - <<'EOF'
{ "value": "false" }
EOF
```

All three steps use plain Bearer-auth Table API — no `xmlhttp.do/JSValidator` web-session trickery needed.

**Why this is the correct approach for AP1**: pre-AP1 the legacy mechanism (`multi_factor_role` + `sys_user_mfa_enforcement_info`) was the whole story. Post-AP1, the auth policy `Enforce MFA for non-SSO logins` runs as an independent gate — even with a per-user `not_applicable` enforcement record, the policy still prompts MFA. The original 'set status to not_applicable' procedure (still documented below) is correct for the legacy layer but is **no longer enough on its own**.

## Efficient Approach

### Check current enforcement state for a user
```bash
simon query sys_user_mfa_enforcement_info \
  --query "user=<user_sys_id>" \
  --fields "status,category,user"
```

### Find MFA exemption group sys_id
```bash
simon query sys_user_group \
  --query "nameLIKEmfa" \
  --fields "name,sys_id,description"
```

### Add user to MFA exemption group
```bash
# use sys_user_grmember, NOT sys_group_has_roles
simon create sys_user_grmember --body - <<'EOF'
{
  "group": "<mfa_group_sys_id>",
  "user": "<user_sys_id>"
}
EOF
```

### Remove role-based MFA trigger for admin role
```bash
# query first: simon query multi_factor_role --query "roleSTARTSWITHadmin"
simon delete multi_factor_role <record_sys_id>
```

### Changing status from "enforced" to "not_applicable"
The business rule `RestrictStatusChangeToEnforceOnly` (sys_id `dd769a897f011210f16f91fadc866583`) blocks transitions away from `enforced`. To work around it via Table API: temporarily set the BR `active=false`, PATCH the enforcement record's `status` to `not_applicable`, then set the BR back to `active=true`. All three steps are plain Bearer-auth Table API calls.

## Gotchas

- **AP1 added a second enforcement layer** — `sys_authentication_policy` "Enforce MFA for non-SSO logins" runs even when `sys_user_mfa_enforcement_info.status=not_applicable`. Setting the per-user record alone is insufficient on AP1+ instances. Use the Nuclear Option above for full disable.
- **Two BRs block disabling the global toggle** in order: `RestrictDisablingMFAProp` (checks the auth policy is inactive) and `Discourage turning off MFA` (checks the disable-reason property is non-empty). Both must be satisfied; deactivate the policy first, set the reason second, then flip the toggle.
- **Role-based MFA overrides group exemption** — always check `multi_factor_role` for the user's roles, not just group membership
- **`sys_user_multi_factor_setup`** (registered authenticator devices) is **ACL-blocked** from REST API entirely — must be cleared via UI: `https://<instance>.service-now.com/sys_user_multi_factor_setup_list.do`
- **`RestrictStatusChangeToEnforceOnly`** BR blocks all transitions away from `enforced` — toggle the BR's `active` flag off via Table API, update the enforcement record, then turn the BR back on.
- **Delete ACLs on `sys_user_mfa_enforcement_info` have `admin_overrides: false`** — the record cannot be deleted via REST; update to `not_applicable` is the only path.
- Tables `sys_user_mfa_enrollment`, `sn_auth_mfa_enrollment`, `sys_user_auth_context`, `glide_user_session` do **not exist** on standard instances (searched for MFA device/session cleanup).
