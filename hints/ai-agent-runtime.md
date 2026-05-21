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

## sn_aia_message — Quickest Debug Path

**Start here for any "what happened in this run?" question.** A single ordered query gives you the user input, every tool result, every RAG hit, and the final agent reply — all in one chronological list. Faster than walking execution_task → metadata → output.

```bash
simon query sn_aia_message \
  -q "execution_plan=<plan_sys_id>^ORDERBYsys_created_on" \
  -f sys_created_on,role,type,message \
  -i <instance> --output stdout
```

- **Order by `sys_created_on`, NOT `message_sequence`** — `message_sequence` is empty on `user_profile` and `conversation` rows, so sorting by it scrambles the trail.
- Fields: `message` and `user_message` — **NOT** `content` (that field does not exist).
- Roles: `user`, `user_profile`, `agent`
- Types: `conversation` (tool output / RAG result, JSON in `message`), null (regular turn or final reply)
- Tool **outputs** appear here as `agent/conversation` JSON. Tool **inputs** don't — for those, fall back to `sn_aia_execution_task.metadata` (see below).

### Common error signatures in conversation messages

| Snippet in `message` | Meaning |
|---|---|
| `FDIH transformation failed: Failed to prepare request: No value present` | A subflow-type tool was called with a null required input. Check the previous gen_ai turn to see which tool the LLM picked and what inputs it filled. |
| `Sorry, there was a problem on my side trying to complete this request` | Agent's user-facing give-up reply. Always preceded by a tool error or a gen_ai failure — look at the message just before. |

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

**Prefer `sn_aia_execution_task` with `type=tool`** — `sn_aia_tools_execution` has a read ACL on `execution_task` that 403s for non-privileged users (`Insufficient rights to query records — Field(s) present in the query do not have permission to be read`). The execution_task record carries everything you need:

- `metadata` (JSON string) — contains `inputs` (the tool call arguments) and the tool `name`/`id`
- `output` (JSON string) — contains the tool result
- `description` — human-readable tool name (e.g. "Update Jumble State", "Create Sparkle")
- `execution_time_ms`, `start_time`, `status`

```bash
simon query sn_aia_execution_task \
  --query "execution_plan=<plan_sys_id>^type=tool" \
  --fields "sys_id,description,metadata,output,execution_time_ms,start_time,status" \
  --order-by sys_created_on \
  --display-value all
```

> The `output` field is double-encoded JSON: `{"result": "{\"output\":..., \"Output Fields\":{...}}"}` — parse twice.

Only fall back to `sn_aia_tools_execution` if you specifically need fields not present on the task record (and have the ACL for it):
```bash
simon query sn_aia_tools_execution \
  --query "execution_task=<sn_aia_execution_task_sys_id>" \
  --fields "sys_id,tool,status,input,output,sys_created_on" \
  --order-by sys_created_on
```

### Find messages in a run

See the `sn_aia_message — Quickest Debug Path` section above.

### List tools attached to an agent

```bash
simon query sn_aia_agent_tool_m2m \
  -q "agent=<sn_aia_agent_sys_id>" \
  -f tool.name,tool.type,tool.description,tool.sys_updated_on,sys_updated_on \
  -l 50 -i <instance>
```
> **Use `-q`, not positional.** `simon query <table> "<filter>"` silently drops the filter and returns the first 20 rows of the table (looks like a permission issue but is just syntax). Always pass filters via `-q`/`--query`.
> The m2m row's `sys_updated_on` shows when the tool was linked to this agent — handy for "what did Build Agent add today?"

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
> **To get the full prompt**: use `--output stdout` to bypass the 148-line offload limit and pipe to a file:
> ```bash
> simon get sys_generative_ai_log <gen_ai_log_id> \
>   -f prompt,response -i <instance> --output stdout > /tmp/agent_log.json
> ```
> Then extract the system prompt with Python:
> ```bash
> python3 -c "
> import json,sys
> with open('/tmp/agent_log.json') as f: data=json.load(f)
> msgs = json.loads(data['prompt']) if isinstance(data['prompt'],str) else data['prompt']
> if isinstance(msgs,dict): msgs=msgs.get('prompt',[])
> for m in msgs:
>     if m.get('role')=='system':
>         sys.stdout.write(m.get('content','')); break
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

## Trigger fired but no execution_plan exists

Symptom: a record matches an active `sn_aia_trigger_configuration`, but no `sn_aia_execution_plan` is ever created for it. No error visible in the agent UI.

Cause: the agent is **disabled / unpublished**. The trigger fires, but the runtime refuses to start a plan.

Diagnose via syslog (bound by time + indexed source):

```bash
simon query syslog -i <instance> \
  --query "sys_created_on>2026-05-20 09:43:00^sys_created_on<2026-05-20 09:55:00^source=sn_aia" \
  --fields "sys_created_on,level,source,message" \
  --order-by sys_created_on --order-dir desc --limit 30
```

Look for: `[AIA Flow Action] Trying to execute a disabled agent : <agent_sys_id>`

Fix: republish/enable the agent in AI Agent Studio. Editing an agent can silently flip it back to draft — JUM0001015 ran fine, then a later edit left the agent disabled and JUM0001016's trigger fired into the void.

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
