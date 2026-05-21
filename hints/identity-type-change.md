---
name: sys_user identity_type change
description: How to change sys_user.identity_type to/from ai_agent — the "Handle Identity type change" BR blocks it
type: reference
---

# Changing `sys_user.identity_type` to/from `ai_agent`

## The block

The before-update business rule **`Handle Identity type change`** (`sys_script`, look up by name; sys_id varies per instance) hard-aborts any update where `previous.identity_type == ai_agent` OR `current.identity_type == ai_agent`. Error:

```
Operation against file 'sys_user' was aborted by Business Rule 'Handle Identity type change'
```

`isNewRecord()` skips the rule, so creating a fresh user with `identity_type=ai_agent` works fine — the block is purely on transitions of existing users.

## Workaround

Disable BR → update user → re-enable BR:

```bash
# 1. Disable BR (look up sys_id by name=Handle Identity type change, table=sys_user)
simon update sys_script <br_sys_id> -i <inst> --body - <<<'{"active":"false"}'

# 2. Flip the user
simon update sys_user <user_sys_id> -i <inst> --body - <<<'{"identity_type":"ai_agent","web_service_access_only":"false"}'

# 3. Re-enable BR
simon update sys_script <br_sys_id> -i <inst> --body - <<<'{"active":"true"}'
```

The BR also auto-syncs `web_service_access_only` based on identity_type, so set it explicitly when bypassing.

## What "AI User" means in the UI

The "AI" badge / filter in the user list comes from `identity_type=ai_agent`. No other flag needed. Roles are agent-specific (e.g. `sn_notif_agents.email_generator` for the email generator user) and must be granted separately based on what the AI user does.
