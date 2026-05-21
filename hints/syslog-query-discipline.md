# Syslog Query Discipline — Hints

## Why This Hint Exists

`syslog` is one of the largest tables on any ServiceNow instance and grows fast. The `message` column is not well-indexed for `LIKE` scans. A naive query without a time bound — especially with multiple `OR messageLIKE…` clauses — triggers a full-table scan that can run for tens of seconds and contributes meaningfully to instance load. On a busy instance the query may time out and get cancelled, wasting the round-trip entirely.

## Rules

### 1. Always bound by time first

Every `syslog` query must include a `sys_created_on` window. No exceptions.

```bash
# Good — bounded to last 15 minutes
simon query syslog -i <instance> \
  --query "sys_created_on>javascript:gs.minutesAgoStart(15)^source=oauth_credentials" \
  --fields "sys_created_on,level,source,message" \
  --order-by sys_created_on --order-dir desc --limit 50
```

Useful relative-time anchors:
- `javascript:gs.minutesAgoStart(15)` — last 15 minutes
- `javascript:gs.hoursAgoStart(1)` — last hour
- `javascript:gs.beginningOfToday()` — since midnight

### 2. Prefer indexed columns over `messageLIKE`

`source`, `level`, and `created_by` are indexed. `message` is not. Filter on indexed columns first to narrow the rowset, then optionally `messageLIKE` to refine.

```bash
# Good — narrow by source first
--query "sys_created_on>javascript:gs.hoursAgoStart(1)^source=oauth_credentials^messageLIKEclient_credentials"

# Bad — messageLIKE alone scans everything in the time window
--query "sys_created_on>javascript:gs.hoursAgoStart(1)^messageLIKEclient_credentials"
```

### 3. Never OR multiple `messageLIKE` patterns in one query

Each `OR messageLIKE` term forces a separate substring scan over the full row set. Three OR-LIKE terms = three full scans on the same rows. Issue separate narrow queries instead and merge locally if needed.

```bash
# Bad — three full scans, no time bound
--query "messageLIKE55b793d8^ORmessageLIKEoauth_token^ORmessageLIKEclient_credentials"

# Good — narrow time + indexed source, then one LIKE
--query "sys_created_on>javascript:gs.hoursAgoStart(1)^source=oauth_credentials^messageLIKEclient_credentials"
```

### 4. Always sort by `sys_created_on DESC` and `--limit`

You almost always want the most recent entries. Capping the result keeps the response tiny.

```bash
--order-by sys_created_on --order-dir desc --limit 50
```

### 5. If you don't know what you're looking for, look at job structure first

Don't grep `syslog` to figure out what's slow — check `syslog_transaction` (which has `response_time` and is much smaller). See [instance-performance-tuning.md](instance-performance-tuning.md).

## Quick Reference Template

```bash
simon query syslog -i <instance> \
  --query "sys_created_on>javascript:gs.hoursAgoStart(1)^<indexed_filter>^<optional messageLIKE>" \
  --fields "sys_created_on,level,source,message" \
  --order-by sys_created_on --order-dir desc --limit 50
```

## Gotchas

- **`messageLIKE` is case-sensitive on most DBs.** If unsure, use `messageCONTAINS` instead — same scan cost but case-insensitive.
- **A 60-second cancelled query still cost the instance the work it did before cancellation.** Don't assume "it was killed, no harm done."
- **`syslog_transaction` is not the same as `syslog`** — different table, much smaller, has `response_time` and `url`. Use it for performance investigations, not `syslog`.
- **`sys_created_on>=YYYY-MM-DD` form works too** but the JavaScript helpers are easier to keep correct across timezones.
