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
  table: sn_aia_execution_task
  query: agent=<sn_aia_agent_sys_id>
  fields: sys_id,agent,state,sys_created_on,error_message
  order_by: sys_created_on
  order_dir: desc
  limit: 20
```

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
  query: execution_task=<sn_aia_execution_task_sys_id>
  fields: sys_id,role,content,sys_created_on
  order_by: sys_created_on
```
