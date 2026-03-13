# AI Agent — Runtime & Execution Data — Hints

These tables are mostly read-only and useful for debugging agent runs.

## Key Tables

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_execution_task` | Execution Task | One agent run / task instance — top-level entry point |
| `sn_aia_execution_plan` | Execution Plan | The reasoning plan generated for a task |
| `sn_aia_tools_execution` | Tools Execution | Record of individual tool calls within an execution |
| `sn_aia_message` | Message | Messages exchanged in an agent conversation |
| `sn_aia_memory` | AI Agent Memory | Short-term memory records written during a run |
| `sn_aia_memory_execution_m2m` | Memory Execution M2M | Links a memory record to an execution |
| `sn_aia_version_execution_m2m` | Version Execution Plan M2M | Links agent version to an execution plan |
| `sn_aia_execution_metric` | Execution Metric | Token/latency metrics per execution |
| `sn_aia_execution_feedback` | Execution Feedback | User thumbs up/down feedback on a run |
| `sn_aia_perf_event` | AI Agent Performance Event | Low-level performance events |
| `sn_aia_report_metric` | Report Metrics | Aggregated metrics for reporting |

## Useful Debug Queries

### Find all runs for an agent
```
sn_query:
  table: sn_aia_execution_plan          ← use this, NOT sn_aia_execution_task (no agent field)
  query: agent=<sn_aia_agent_sys_id>
  fields: sys_id,state,state_reason,objective,sys_created_on
  order_by: sys_created_on
  order_dir: desc
  limit: 5
  display_value: all
```
> `sn_aia_execution_task` does NOT have an `agent` field — querying it by agent causes a 403.
> `sn_aia_execution_plan` has the `agent` reference and is the correct entry point.
> Timestamps are stored in UTC — the instance may be in a different timezone.

### Find tool calls within a run
```
sn_query:
  table: sn_aia_tools_execution
  query: execution_task=<sn_aia_execution_task_sys_id>
  fields: sys_id,tool,status,input,output,sys_created_on
  order_by: sys_created_on
```

### Find messages in a run
```
sn_query:
  table: sn_aia_message
  query: execution_plan=<sn_aia_execution_plan_sys_id>
  fields: sys_id,role,content,sys_created_on
  order_by: sys_created_on
```

---

## "Security Violation" / isAccessAllowed: false

When a run terminates immediately with `state_reason=security_violation`, the cause is an **Access Verification** pre-check that runs before any tool executes.

### How to diagnose
```
sn_query:
  table: sn_aia_execution_task
  query: execution_plan=<execution_plan_sys_id>
  fields: sys_id,type,status,output,sys_created_on
  display_value: all
```
Look for `type=access_verification`. The `output` field is JSON listing every resource (agent + tools) with an `isAccessAllowed` boolean per item.

Example output:
```json
{
  "resources": [{
    "resourceType": "agent", "resourceName": "Jimmy", "isAccessAllowed": true,
    "childResources": [
      { "resourceType": "tool", "resourceName": "Load KB review guidelines", "isAccessAllowed": true },
      { "resourceType": "tool", "resourceName": "Email Notification", "isAccessAllowed": false }
    ]
  }]
}
```

### Fix: subflow tool access denied
For subflow-type tools, `isAccessAllowed: false` means the run_as_user lacks a role required by the subflow's ACL.

1. Find the subflow sys_id: it's in `sn_aia_tool.target_document` (table: `sys_hub_flow`)
2. Open the subflow in Flow Designer and check its Access Control / roles
3. Add the required role to the agent's run_as_user via `sys_user_has_role`

Common roles needed for subflow tools:
- `flow_operator` — general subflow execution via Flow Designer API
- `sn_conv_fa.csa_email_write` — required by the "Send Email" conversational subflow
