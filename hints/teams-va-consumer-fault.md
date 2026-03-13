# Teams VA Consumer Fault — "Technical Issues" Error

## Symptom
User gets "I'm having technical issues and won't be able to continue this conversation" when sending a Teams message to trigger a VA/AI Agent workflow. Another user on the same instance works fine. Conversations show `state=Faulted` in `sys_cs_conversation`.

## Key Tables

| Table | Purpose |
|---|---|
| `sys_cs_conversation` | VA conversation records — check `state` and `topic_definition_name` |
| `sys_cs_consumer` | Consumer identity records — check `inactive` flag |
| `sys_cs_consumer_account` | Links external identity to consumer — check `consumer` pointer |
| `sys_cs_channel_user_profile` | Per-channel identity profile for a user |
| `sn_aia_execution_plan` | Agent runs — check `state_reason` for `no_activity` or `security_violation` |

## Efficient Diagnostic Approach

### Step 1 — Find the user's failing conversations
```
sn_query:
  table: sys_cs_conversation
  query: sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()
  fields: sys_id, name, device_type, topic_definition_name, state, consumer, sys_created_on
  order_by: sys_created_on
  order_dir: desc
  display_value: all
```
Look for `state=Faulted` + `device_type=Teams`.

### Step 2 — Check the consumer records for the affected user
```
sn_query:
  table: sys_cs_consumer
  query: user_id=<sys_user_sys_id>
  fields: sys_id, name, inactive, consumer_account, sys_created_on, sys_created_by, sys_updated_on, sys_updated_by
  display_value: all
```
**Red flag:** Multiple records, newer ones have `inactive=true`, set by `system` ~31 minutes after creation by `guest`.

### Step 3 — Check the consumer_account pointer
```
sn_query:
  table: sys_cs_consumer_account
  query: consumer=<any_of_the_consumer_sys_ids>
  fields: sys_id, consumer, vendor_user_id, provider_application, sys_updated_on, sys_updated_by
  display_value: all
```
**Red flag:** `consumer` field points to an **inactive** consumer record.

## Root Cause

When a user sends a Teams message, the VA framework creates a new `sys_cs_consumer` record under the `guest` session. This happens when the `sys_cs_consumer_account.consumer` pointer is stale — it points to a previously-created (now inactive) duplicate rather than the user's canonical consumer.

A ServiceNow platform cleanup job fires approximately every 31 minutes and deactivates duplicate consumer records (those created by `guest` for users who already have a canonical consumer). If this job fires mid-conversation, the session is orphaned and faults.

The result: the `consumer_account.consumer` pointer gets updated to each new duplicate, the duplicate gets deactivated, next session creates yet another duplicate — a repeating cycle.

## Fix

**The REST Table API silently ignores writes to `sys_cs_consumer` and `sys_cs_consumer_account`** — `sn_update_record` returns success but the record does not change. No ACLs or business rules block it; it is a Java-layer platform protection. Use a background script instead.

Run the following at `https://<instance>.service-now.com/sys.scripts.do`:

```javascript
// Fix Teams consumer identity chain for a user
var CONSUMER_ACCOUNT_SYS_ID   = '<sys_cs_consumer_account sys_id>';
var CANONICAL_CONSUMER_SYS_ID = '<sys_cs_consumer sys_id>';  // created by the user, not guest
var TEAMS_EXTERNAL_USER_ID    = '<vendor_user_id from sys_cs_channel_user_profile>';

// Fix consumer_account: correct consumer pointer and vendor_user_id
var ca = new GlideRecord('sys_cs_consumer_account');
if (ca.get(CONSUMER_ACCOUNT_SYS_ID)) {
    ca.setValue('consumer', CANONICAL_CONSUMER_SYS_ID);
    ca.setValue('vendor_user_id', TEAMS_EXTERNAL_USER_ID);
    ca.update();
    ca.get(CONSUMER_ACCOUNT_SYS_ID);
    gs.info('[1] consumer = ' + ca.getValue('consumer'));
    gs.info('[1] vendor_user_id = ' + ca.getValue('vendor_user_id'));
} else {
    gs.error('[1] consumer_account NOT FOUND');
}
gs.info('Done.');
```

**How to find the values needed:**
- `CONSUMER_ACCOUNT_SYS_ID`: from Step 3 above
- `CANONICAL_CONSUMER_SYS_ID`: the `sys_cs_consumer` record where `sys_created_by = <username>` (not `guest`) and `inactive = false`
- `TEAMS_EXTERNAL_USER_ID`: from `sys_cs_channel_user_profile` where `channel = Teams` for the user — query the `vendor_user_id` field (it's a long Azure AD token string like `1tXvmyQrQ...`)

## Gotchas

- `sys_audit` does not capture changes to `sys_cs_consumer.inactive` — no audit trail
- No business rules on `sys_cs_consumer` — the cleanup is a platform-level scheduled job, not visible in `sys_script` or `sys_trigger`
- The cleanup job fires at ~31 minutes — conversations shorter than that may succeed, masking the issue
- `sys_cs_consumer_account.vendor_user_id` may incorrectly hold a consumer sys_id instead of the external Teams user ID — fix it via background script (see above)
- The `sys_cs_channel_user_profile` for Teams may show no `consumer` or `consumer_account` fields — these fields are not writable and the consumer link goes through `consumer_account` by `vendor_user_id` lookup, not via the profile directly
- **REST API writes to `sys_cs_consumer` and `sys_cs_consumer_account` silently fail** — always use a background script for these tables
- After fixing, tell the user to start a **fresh** Teams conversation — replying into a previously-faulted thread will keep faulting that specific conversation, even if the underlying consumer is now correct
- Affected users tend to be those who have **used VA before** (have a canonical consumer). First-time users don't have a canonical record to conflict with, so they don't hit this
- Execution plans created during faulted sessions may show `state_reason=no_activity` — this is a consequence of the consumer fault, not the root cause
