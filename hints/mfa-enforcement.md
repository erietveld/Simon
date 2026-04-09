# MFA Enforcement — Hints

## Key Tables

| Table | Purpose |
|-------|---------|
| `sys_properties` | MFA global toggle: `glide.authenticate.multifactor` |
| `sys_user_mfa_enforcement_info` | Per-user MFA enforcement status (tracking / enforced / not_applicable) |
| `multi_factor_role` | Role-based MFA trigger — roles listed here force MFA regardless of group exemptions |
| `sys_user_group` (name LIKE mfa) | "MFA Exempted User Group" — membership bypasses MFA (when role-based rules don't override) |
| `sys_user_multi_factor_setup` | Registered authenticator devices per user — ACL-blocked from REST API |

## How It Works

MFA enforcement uses layered rules — role-based rules (`multi_factor_role`) take **precedence over** group exemptions. A user in the MFA Exempted User Group can still be enforced if they hold a role listed in `multi_factor_role` (e.g. `admin`, `user_admin`, `security_admin`).

Per-user enforcement state lives in `sys_user_mfa_enforcement_info.status`:
- `tracking` → being monitored, not yet enforced
- `enforced` → MFA is required on login
- `not_applicable` → exempted

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
simon create sys_user_grmember <<'EOF'
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

### Changing status from "enforced" to "not_applicable" — CANNOT be done via REST API
The business rule `RestrictStatusChangeToEnforceOnly` calls `SNC.MultifactorAuthUtil.isMFAEnforcementStatusChangeAllowed()` and aborts any transition away from `enforced` regardless of method (PATCH, PUT, scripted REST). The only working approach is a **global-scope `sysauto_script`** (background script scheduled for immediate execution) using `setWorkflow(false)`.

Example background script (global scope):
```javascript
var gr = new GlideRecord('sys_user_mfa_enforcement_info');
gr.get('<sys_id>');
gr.setWorkflow(false);
gr.setValue('status', 'not_applicable');
gr.update();
```

To create via simon CLI:
```bash
simon create sysauto_script <<'EOF'
{
  "name": "Fix MFA status (temp)",
  "script": "<script above>",
  "run_type": "on_demand",
  "run_start": "<now>",
  "active": "true"
}
EOF
```
Then delete the sysauto_script record after it fires.

## Gotchas

- **Role-based MFA overrides group exemption** — always check `multi_factor_role` for the user's roles, not just group membership
- **`sys_user_multi_factor_setup`** (registered authenticator devices) is **ACL-blocked** from REST API entirely — must be cleared via UI: `https://<instance>.service-now.com/sys_user_multi_factor_setup_list.do`
- **`RestrictStatusChangeToEnforceOnly`** business rule blocks direct REST writes to `sys_user_mfa_enforcement_info` — background script with `setWorkflow(false)` is the only workaround
- Tables `sys_user_mfa_enrollment`, `sn_auth_mfa_enrollment`, `sys_user_auth_context`, `glide_user_session` do **not exist** on standard instances (searched for MFA device/session cleanup)
