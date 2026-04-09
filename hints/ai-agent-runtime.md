# AI Agent — Runtime & Execution Data — Hints

These tables are mostly read-only and useful for debugging agent runs.

## Key Tables

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_execution_plan` | Execution Plan | Top-level run record — has `agent` field, correct entry point |
| `sn_aia_execution_task` | Execution Task | Individual tasks within a run: types `access_verification`, `agent`, `tool`, `gen_ai` |
| `sn_aia_tools_execution` | Tools Execution | Record of individual tool calls within an execution |
| `sn_aia_message` | Message | Messages exchanged in an agent conversation |
| `sys_gen_ai_log_metadata` | Gen AI Log Metadata | Per-LLM-call metadata: model, token counts, timing, perf traces |
| `sys_generative_ai_log` | Generative AI Log | Raw LLM payload: full prompt (messages array) + raw LLM response |
| `sn_aia_memory` | AI Agent Memory | Short-term memory records written during a run |
| `sn_aia_memory_execution_m2m` | Memory Execution M2M | Links a memory record to an execution |
| `sn_aia_version_execution_m2m` | Version Execution Plan M2M | Links agent version to an execution plan |
| `sn_aia_execution_metric` | Execution Metric | Token/latency metrics per execution |
| `sn_aia_execution_feedback` | Execution Feedback | User thumbs up/down feedback on a run |
| `sn_aia_perf_event` | AI Agent Performance Event | Low-level performance events |
| `sn_aia_report_metric` | Report Metrics | Aggregated metrics for reporting |

## Table Relationships

```
sn_aia_execution_plan
  └─ sn_aia_message          (query: execution_plan=<plan_sys_id>)
  └─ sn_aia_execution_task   (query: execution_plan=<plan_sys_id>)
       └─ type=gen_ai: output JSON contains "URL": "/sys_gen_ai_log_metadata.do?sys_id=<id>"
            └─ sys_gen_ai_log_metadata  (sys_id from URL)
                 └─ gen_ai_log_id → sys_generative_ai_log  (full prompt + response)
```

## sn_aia_message Field Names

The correct fields are `message` and `user_message` — NOT `content` (that field does not exist):

```bash
simon query sn_aia_message \
  --query "execution_plan=<sn_aia_execution_plan_sys_id>" \
  --fields "sys_id,role,type,user_message,message,message_sequence,sys_created_on" \
  --order-by message_sequence \
  --display-value all
```

Message roles: `user`, `user_profile`, `agent`
Message types: `conversation` (tool output), null (regular turn)

## Useful Debug Queries

### Run types in sn_aia_execution_plan

`sn_aia_execution_plan` is shared between two run types:

| Run type | `agent` | `team` | `usecase` |
|---|---|---|---|
| Single-agent run | populated | empty | empty |
| Team/usecase run | **empty** | populated | populated |

Filter by `agentISNOTEMPTY` to scope queries to single-agent runs only.

### Find the most recently run agent (across all agents)
```bash
simon query sn_aia_execution_plan \
  --query "agentISNOTEMPTY" \
  --fields "sys_id,agent,state,state_reason,objective,sys_created_on" \
  --order-by sys_created_on --order-dir desc --limit 1 \
  --display-value all
```
> `display_value: all` on `agent` returns the agent name directly — no second lookup needed.
> Without `agentISNOTEMPTY`, ghost/stuck runs with no agent reference can surface first and send you down extra queries.

### Find all runs for an agent
```bash
# use sn_aia_execution_plan, NOT sn_aia_execution_task (no agent field)
simon query sn_aia_execution_plan \
  --query "agent=<sn_aia_agent_sys_id>" \
  --fields "sys_id,state,state_reason,objective,sys_created_on" \
  --order-by sys_created_on --order-dir desc --limit 5 \
  --display-value all
```
> `sn_aia_execution_task` does NOT have an `agent` field — querying it by agent causes a 403.
> `sn_aia_execution_plan` has the `agent` reference and is the correct entry point.
> Timestamps are stored in UTC — the instance may be in a different timezone.

### Find tool calls within a run
```bash
simon query sn_aia_tools_execution \
  --query "execution_task=<sn_aia_execution_task_sys_id>" \
  --fields "sys_id,tool,status,input,output,sys_created_on" \
  --order-by sys_created_on
```

### Find messages in a run

See the `sn_aia_message Field Names` section above for the correct query and field names.

### Find all LLM calls in a run
```bash
simon query sn_aia_execution_task \
  --query "execution_plan=<plan_sys_id>^type=gen_ai" \
  --fields "sys_id,type,status,output,sys_created_on" \
  --order-by sys_created_on \
  --display-value all
```
The `output` JSON of each gen_ai task contains a `"URL"` key like `/sys_gen_ai_log_metadata.do?sys_id=<metadata_sys_id>`.
Use that sys_id to fetch `sys_gen_ai_log_metadata`, then follow its `gen_ai_log_id` to `sys_generative_ai_log` for the full prompt/response.

### Get the raw system prompt for a run
```
# 1. Get gen_ai_log_metadata sys_id from sn_aia_execution_task.output (URL field)
# 2. Look up gen_ai_log_id
simon get sys_gen_ai_log_metadata <metadata_sys_id> \
  --fields "gen_ai_log_id,model_name,prompt_token_count,response_token_count,time_taken"

# 3. Fetch the raw log
simon get sys_generative_ai_log <gen_ai_log_id> \
  --fields "prompt,response,prompt_token_count,response_token_count,time_taken,model_name,started_at,completed_at"
```
> The `prompt` field is a JSON string: `{"prompt":[{"role":"system","content":"..."},{"role":"user",...},...]}`
> The system prompt alone is typically **40–50 KB**. The CLI caps large responses at 148 lines and writes the rest to a temp file.
> **To get the full prompt**: use `curl` directly with a refreshed OAuth token and pipe through Python to extract `prompt[0].content`:
> ```bash
> curl -s -H "Authorization: Bearer <token>" \
>   "https://<instance>.service-now.com/api/now/table/sys_generative_ai_log/<sys_id>?sysparm_fields=prompt" \
>   | python3 -c "
> import json,sys
> d=json.load(sys.stdin)
> obj=json.loads(d['result']['prompt'])
> for m in obj['prompt']:
>     if m['role']=='system':
>         sys.stdout.write(m['content']); break
> " > /tmp/system_prompt.txt
> ```

---

## "Download Log" in AI Agent Studio

The Studio test panel has a "Download Log" button. It calls:
```
GET /api/sn_build_agent/build_agent_api/conversations/{id}/messages
```
This endpoint requires a **user API token** (not the standard OAuth token) — it returns 401 with normal Simon credentials.

The same data is fully accessible via the Table API using the tables above. The `.do?sys_id=` URL embedded in gen_ai task output is just a ServiceNow form link, not a download endpoint.

---

## "Security Violation" / isAccessAllowed: false

When a run terminates immediately with `state_reason=security_violation`, the cause is an **Access Verification** pre-check that runs before any tool executes.

### How to diagnose
```bash
simon query sn_aia_execution_task \
  --query "execution_plan=<execution_plan_sys_id>" \
  --fields "sys_id,type,status,output,sys_created_on" \
  --display-value all
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
