# Build Agent LLM Configuration — Hints

## What Is Build Agent

**Build Agent** (`sn_build_agent` scope) is the AI assistant embedded in AI Agent Studio — the chat interface used when testing/building agents in Studio. It is a distinct scope from the AI agents themselves (`sn_aia_agent`) and from the Skill Kit (`sn_skill_builder`).

The "Download Log" button in Studio calls `/api/sn_build_agent/build_agent_api/conversations/{id}/messages` (requires user API token, not OAuth — 401 with standard Simon credentials). Use the Table API instead.

---

## How to Find the LLM in Use

The LLM configuration for Build Agent is **not easily readable** through provider/capability config tables (all ACL-blocked). The fastest approach is to check actual LLM call logs:

```bash
simon query sys_gen_ai_log_metadata \
  --query "sys_scope.name=sn_build_agent" \
  --fields "model_name,sys_created_on" \
  --display-value all \
  --order-by sys_created_on --order-dir desc --limit 10
```

> Note: `order_by` on this table may not apply (ACL restriction on that field). Look for the most recent `sys_created_on` manually in the results.

---

## Current LLM (as of Feb 2026)

| Model alias | Provider | Usage |
|-------------|----------|-------|
| `claude_large` | Now LLM Service (Anthropic/Claude) | **Primary** — main Build Agent conversations |
| `text2flow_llm/mistral-nemo-12b-instruct` | Now LLM Service | Sub-task: "generate flow" operations |
| `gemini_small` | Now LLM Service | Occasional; seen once in Dec 2025 |

---

## Dead Ends (don't repeat these)

- `sys_gen_ai_provider` — exists but all fields are ACL-blocked except `sys_id`
- `sys_gen_ai_routing_selection` — table exists but returns 0 records
- `sn_gen_ai_provider_config`, `sys_ai_capability`, `sn_generative_ai_provider`, `sys_gen_ai_capability`, `sn_generative_ai_capability` — all invalid tables
- `sys_generative_ai_capability_definition` — exists ("Generative AI Provider Mapping") but returns 403 on query
- `sn_ais_assist/admin/v1/providers` and `sn_nowassist_admin/nowassist/configuration` — REST endpoints return 400 (don't exist)
- `sn_aia_gen_ai_m2m` — 403 on all useful fields
- `sn_aia_skill_provider_rule` — only shows **Exclude** rules (what's blocked, not what's active); doesn't reveal the active LLM

## Gotchas

- Build Agent scope is `sn_build_agent` — NOT `sn_skill_builder` (Skill Kit) or `sn_aia_agent`
- `sn_skill_builder` scope logs in `sys_gen_ai_log_metadata` return the same records as `sn_build_agent` — they appear to share the same scope label
- `claude_large` is ServiceNow's internal alias for an Anthropic Claude model served via Now LLM Service
- There is no single config record that cleanly shows "Build Agent uses X model" — log evidence is the most reliable approach
