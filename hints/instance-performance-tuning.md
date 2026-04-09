# Instance Performance Tuning — Hints

## Overview

POV/demo instances provisioned from real customer environments often carry heavy background job loads that were tuned for production scale. Disabling or throttling irrelevant jobs is usually the single highest-impact performance improvement you can make.

## Key Tables

| Table | Purpose |
|-------|---------|
| `sysauto` | All scheduled jobs (parent) |
| `sysauto_script` | Scheduled Script Executions (has the `script` field) |
| `sys_progress_worker` | Currently running background workers |
| `sys_trigger` | Currently executing triggers |
| `sys_flow_context` | Running flows |
| `syslog_transaction` | Transaction log with execution times — use `url` field (not `name`) for job names; format is `JOB: <name>` |

## Efficient Approach

### Step 1 — Find what's running

```bash
simon query sys_progress_worker \
  --query "state=running" \
  --fields "name,state,message,sys_created_by"

simon query sysauto \
  --query "active=true^run_typeLIKEperiodically^run_periodISNOTEMPTY" \
  --fields "name,run_period,run_type,sys_scope" \
  --order-by run_period --order-dir asc --limit 100
```

### Step 2 — Identify high-frequency jobs

Sort by `run_period` ascending. Flag anything under 1 minute as high-frequency. Key offenders to look for:
- Event Management batch jobs (5–30 sec each, there are ~70 of them)
- CMDB batch collectors (1 min each, ~10 of them)
- ITOM / Discovery / Service Mapping / Operational Intelligence jobs
- WM flat table event processors (30 sec, ~10 processes)
- Agent Client Collector jobs (Refresh/Republish Monitoring Policies)

### Step 3 — Measure execution time

```bash
simon query syslog_transaction \
  --query "urlLIKE<job name fragment>" \
  --fields "url,response_time,sys_created_on" \
  --order-by response_time --order-dir desc --limit 50
```

Note: the `name` field is empty in `syslog_transaction`. Use the `url` field instead — it contains `JOB: <name>`.

A job is problematic if its `response_time` (ms) regularly approaches or exceeds its run interval. This means executions are stacking.

### Step 4 — Throttle or disable

**Throttle** (set to 1 hour) if the job may be needed but is running too frequently:
```bash
simon update sysauto <sys_id> <<'EOF'
{ "run_period": "1970-01-01 01:00:00", "run_type": "periodically" }
EOF
```
Note: `run_period` uses epoch-based duration format. 1 hour = `1970-01-01 01:00:00`.

**Disable** if the feature is not part of the POV:
```bash
simon update sysauto <sys_id> <<'EOF'
{ "active": "false" }
EOF
```

## Standard POV Cleanup Playbook

For a Gen AI POV on a customer instance, these categories are almost always safe to **disable**:

| Category | Interval | Why safe to disable |
|----------|----------|-------------------|
| **Event Management** (~70 jobs) | 5–30s | EM is an ITOM product, not used in Gen AI POVs |
| **CMDB batch collectors** (~10 jobs) | 1 min | No active Discovery means no data to collect |
| **ITOM / Discovery / Service Mapping** (~70 jobs) | varies | Irrelevant if Discovery isn't part of the POV |
| **Operational Intelligence** (~15 jobs) | varies | ITOM Health product, not needed |
| **WM flat table processors** (jobs 0–7) | 30s | Part of ITOM metrics pipeline — use `nameCONTAINSWM flat table initial load` to catch all variants |
| **Agent Client Collector** (Refresh/Republish Monitoring Policies) | varies | ITOM monitoring agent |
| **Cloud Event Sorter** | 30s | ITOM cloud events pipeline |
| **Run Instance-side Probes** | 10s | Discovery probes — no MID server on POV |

These are usually safe to **throttle to 1 hour** (keep running, just less often):

| Category | Interval | Notes |
|----------|----------|-------|
| **Pick up throttled integration process** | 2s | Integration Framework — extremely aggressive default; throttle don't disable |
| **Confidentiality inheritance processor** | 5s | Content product — safe to slow down |
| **Process Queued Entities For Risk Score Calculator** | 20s | Vulnerability Response — keep alive, just slower |
| **SLO: Error Budget Batch Processor (Outages/Alerts)** | 30s | Two variants with different suffixes — throttle both |
| **FE SharePoint Connector** | 30s | Multiple variants (Process Notification, Ingest Files, Renew Subscription) |
| **Timeout For VA Chats Suspended on NLU Prediction** | 30s | VA platform job |
| **Timeout For VA-OneExtend Interactive Chats** | 30s | VA platform job |
| **Get Central Messages** | 30s | Note: actual job name may be "Get Central Messages Executer" |

**Do NOT disable:**
- Vulnerability Response jobs (separate product, may have data dependencies)
- Security jobs
- ITOM Licensing telemetry stores (ACL-protected anyway — they can't be disabled via REST)
- Platform jobs (sys_* cleanup, session management, etc.)

## Background Script for Bulk Cleanup

More efficient than individual `simon update` calls. Paste into `/sys.scripts.do`:

```javascript
var toDisable = [
    'Run Instance-side Probes',
    'WM flat table initial load event process',   // CONTAINS — catches all numbered variants
    'Event Management - Process records in em_extra_data_json',
    'Cloud Event Sorter',
];

var toThrottle = [
    'Pick up throttled integration process',
    'Confidentiality inheritance processor',
    'SLO: Error Budget Batch Processor (Outages)',
    'SLO: Error Budget Batch Processor (Alerts)',
    'AWA - Populate AWA Queue Capacity and Average Wait Time',
    'FE SharePoint Connector : Process Notification',
    'FE SharePoint Connector: Ingest Files',
    'Process Imported MITRE Collection Import  Queue Records',
    'Timeout For VA Chats Suspended on NLU Prediction',
    'Timeout For VA-OneExtend Interactive Chats',
    'Get Central Messages',
    'Process Queued Entities For Risk Score Calculator',
];

var ONE_HOUR = '1970-01-01 01:00:00';
var disabled = [], throttled = [], notFound = [];

function processJobs(names, action) {
    names.forEach(function(name) {
        var gr = new GlideRecord('sysauto');
        gr.addQuery('name', 'CONTAINS', name);
        gr.addQuery('active', true);
        gr.query();
        var found = false;
        while (gr.next()) {
            found = true;
            if (action === 'disable') {
                gr.setValue('active', false);
                disabled.push(gr.getValue('name'));
            } else {
                gr.setValue('run_period', ONE_HOUR);
                gr.setValue('run_type', 'periodically');
                throttled.push(gr.getValue('name'));
            }
            gr.update();
        }
        if (!found) notFound.push(name);
    });
}

processJobs(toDisable, 'disable');
processJobs(toThrottle, 'throttle');

gs.print('DISABLED: ' + disabled.join(', '));
gs.print('THROTTLED: ' + throttled.join(', '));
if (notFound.length) gs.print('NOT FOUND: ' + notFound.join(', '));
```

## Gotchas

- **ITOM Licensing store jobs** are ACL-protected in their scoped app — `simon update` returns 403. These are on-demand only (no `run_period`) so they don't contribute to load anyway.
- **run_period field format**: Duration is stored as a datetime string relative to epoch: `1970-01-01 00:01:00` = 1 minute, `1970-01-01 01:00:00` = 1 hour.
- **`run_type` field**: If a job's `run_type` is `daily` but you want it periodic, update both `run_type: "periodically"` and `run_period`.
- **syslog_transaction `name` field is empty** — always filter and read by `url` instead.
- **Stacking jobs**: If `response_time` > `run_period`, the scheduler launches a new instance before the previous one finishes. This compounds load exponentially under pressure.
- There may be more than 50 jobs matching a query — always paginate with `offset` to get the full picture.
- **WM flat table jobs are numbered 0–7** (not a fixed set) — always use `nameCONTAINS` rather than an exact name.
- **Job name variants exist** — e.g. "Get Central Messages" vs "Get Central Messages Executer", "FE SharePoint Connector : Process Notification" vs "FE SharePoint Connector: Ingest Files". Use `CONTAINS` with a short stem to catch both, then verify what was matched in the output.
- **Multiple instances of the same job name** are possible (different scopes) — the script above handles this correctly since it iterates all `gr.next()` matches.
