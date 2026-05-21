# Build Agent — Complete Reference

Build Agent (`sn_build_agent` scope) is the AI chat assistant embedded in AI Agent Studio — the conversational interface used to build apps, create artifacts, and configure ServiceNow features from natural language.

It is a **distinct scope** from AI Agents (`sn_aia_agent`), Skill Kit (`sn_skill_builder`), and Now Assist (`sn_nowassist`).

---

## Tables

| Table | Label | Purpose |
|---|---|---|
| `sn_build_agent_conversation` | Conversation | Top-level conversation record |
| `sn_build_agent_message` | Message | Individual messages in a conversation |
| `sn_build_agent_knowledge_source` | Knowledge Source | "Skill Resource" articles — NowSDK/Fluent docs injected into prompts |
| `sn_build_agent_checkpoint` | Checkpoint | Conversation checkpoints (save/restore points) |
| `sn_build_agent_conversation_change_log` | Change Log | Tracks what artifacts were created/modified per conversation |
| `sn_build_agent_event_telemetry` | Event Telemetry | UI/interaction telemetry events |
| `sn_build_agent_task_telemetry` | Task Telemetry | Task-level telemetry |
| `sn_build_agent_freemium_usage_log` | Freemium Usage Log | Tracks usage against freemium limits |

---

## System Prompt Architecture

The system prompt is assembled from a chain of Script Includes. **All are `sys_policy: protected`** — content is ACL-blocked and cannot be read via Table API.

### Script Include chain

| Script Include | Role |
|---|---|
| `BaseSystemPrompt` | Base-level prompt (shared foundation) |
| `BuildAgentSystemPrompt` | Core Build Agent instructions |
| `ClaudeSystemPrompt` | Claude-specific prompt additions |
| `GPTSystemPrompt` | GPT-specific prompt additions |
| `GeminiSystemPrompt` | Gemini-specific prompt additions |
| `PreprocessorPrompts` | Dynamic prompt fragments generated during preprocessing |
| `BuildAgentPreprocessor` | Orchestrates preprocessing — decides which knowledge sources to inject |

### How "Load Skill Resource" works

1. User sends a message (e.g. "create a script include")
2. `BuildAgentPreprocessor` runs preprocessing to identify the artifact type
3. It queries `sn_build_agent_knowledge_source` for the matching record (e.g. `name=SCRIPT_INCLUDE`)
4. The `content` field (Markdown NowSDK reference docs) is injected into the system prompt
5. The assembled prompt is sent to the LLM

The knowledge source content includes property tables, TypeScript examples, and cross-references to related objects. It ends with RAG-style hints like "Use the same tool to fetch related documents before proceeding: - Role".

### How to read the actual system prompt

The prompt content is protected in Script Includes, but the **assembled prompt** is logged in full after every LLM call:

```bash
# 1. Find recent Build Agent LLM calls
simon query sys_gen_ai_log_metadata -i <instance> \
  --query "sys_scope.name=sn_build_agent^ORDERBYDESCsys_created_on" \
  --fields "sys_id,gen_ai_log_id,model_name,prompt_token_count,sys_created_on" \
  --display-value all --limit 5

# 2. Get the raw log (contains full assembled prompt + response)
simon get sys_generative_ai_log <gen_ai_log_id> \
  --fields "prompt,response"
```

The `prompt` field is JSON: `{"prompt":[{"role":"system","content":"..."},{"role":"user",...},...]}`

> **Large output**: system prompts are typically 40–60 KB. By default the CLI offloads to `/tmp/simon-*.json` when output exceeds 148 lines. Use `--output stdout` to get the full output:
> ```bash
> simon get sys_generative_ai_log <gen_ai_log_id> \
>   -f prompt,response -i <instance> --output stdout > /tmp/build_agent_log.json
> ```
> Then parse the prompt with Python:
> ```bash
> python3 -c "
> import json,sys
> with open('/tmp/build_agent_log.json') as f: data=json.load(f)
> msgs = json.loads(data['prompt']) if isinstance(data['prompt'],str) else data['prompt']
> if isinstance(msgs,dict): msgs=msgs.get('prompt',[])
> for m in msgs:
>     content=m.get('content','')
>     if isinstance(content,list): content='\\n'.join(c.get('text','') for c in content)
>     sys.stdout.write(content)
> " > /tmp/build_agent_system_prompt.txt
> ```

### Prompt structure

Build Agent prompts are **single-message** (role=user, content as array with one text block). There is no separate system message — the entire system prompt, instructions, examples, and dynamic context are packed into one user message. Structure varies by skill:

| Skill | Label in logs | Prompt structure |
|---|---|---|
| Catalog Canvas | `Catalog Canvas(Amazon Bedrock)` | Identity + static instructions + question/behavior rules + output format + examples + dynamic context (memory, scratchpad, requirement) |
| Generate Work Plan | `Generate work plan (AWS Claude - ...)` | Prioritization instructions + output format + task list JSON |
| Flow Capability | `FlowCapability` | (prompt field empty — may be ACL-blocked) |
| Analytics | `Analytics * generation (...)` | Analytics-specific prompts |

---

## Knowledge Source (Skill Resources)

Table: `sn_build_agent_knowledge_source`

| Field | Purpose |
|---|---|
| `name` | Artifact type key (e.g. `SCRIPT_INCLUDE`, `TABLE`, `ACL`) |
| `plugin` | Same as name — SDK/API category identifier |
| `content` | Full Markdown documentation — NowSDK Fluent API reference |
| `document_type` | Always `Documentation` |
| `fluent_version` | NowSDK Fluent version the docs apply to (e.g. `3.0.0`) |
| `active` | Whether this resource is live |

### Query all knowledge sources
```bash
simon query sn_build_agent_knowledge_source -i <instance> \
  --fields "name,plugin,fluent_version,active,document_type" \
  --display-value all --limit 100
```

### Query via REST API (how the UI fetches them)
```
GET /api/sn_build_agent/build_agent_keyword_search/getFluentKS/{apiType}/{fluentVersion}
GET /api/sn_build_agent/build_agent_keyword_search/getAvailableAPITypes
```

### Known artifact types (~55 records, 43 unique types)

ACL, APPLICATION_MENU, ATF_* (APPNAV, CATALOG, CATALOG_SP, EMAIL, FORM, FORM_SP, INTRO, REPORTING, RESPONSIVEDASHBOARD, REST, SERVER), BUSINESS_RULE, CLIENT_SCRIPT, COLUMN, CROSS_SCOPE_PRIVILEGE, FORM, GENERAL, IMPORT_SET, LDAP_SERVER_CONFIG, LDAP_SERVER_URL, LIST, MODULE, PROPERTY, RECORD, RELATIONSHIP, ROLE, SCHEDULED_SCRIPT, SCRIPTED_REST_API, SCRIPT_INCLUDE, SYS_DATA_SOURCE, SYS_SECURITY_ATTRIBUTE, SYS_SECURITY_DATA_FILTER, TABLE, UI_ACTION, UI_FORMATTER, UI_PAGE, UI_PAGE_THEMING_*, UI_POLICY

Some types have two records (different Fluent SDK versions or plugin variants).

> **Note**: Catalog Item creation is NOT in this table — it uses a self-contained prompt path baked into the `ClaudeSystemPrompt` / `BuildAgentSystemPrompt` Script Includes.

---

## Key Script Includes

All 23 Script Includes are `sys_policy: protected` (ACL-blocked content).

| Script Include | Purpose |
|---|---|
| `BuildAgentEngine` | Core execution engine |
| `BuildAgentPreprocessor` | Preprocessing orchestrator (knowledge source injection) |
| `SendMessage` | LLM API interface |
| `ConversationManager` | Conversation CRUD |
| `CheckpointManager` | Checkpoint save/restore |
| `ConversationChangeLogManager` | Change log tracking |
| `BuildAgentUtil` | General utilities |
| `BuildAgentServiceUtil` | Logging and assist charging |
| `BaeUtils` | BAE (Build Agent Engine) utilities |
| `RestValidator` | REST request validation |
| `AuthenticationAPI` | JWT-based user API token generation |
| `OAuthTokenManager` | OAuth token management |
| `TelemetryManagement` | Telemetry API |
| `PromptLimitChecker` | Freemium usage limit enforcement |
| `FreemiumProviderConfig` | Freemium provider configuration |
| `VariantSelection` | Paid vs freemium determination |
| `BuildAgentLogger` | Logging utility |

---

## REST APIs

### Build Agent API (core — 27 operations)
Base: `/api/sn_build_agent/build_agent_api`

| Method | Path | Purpose |
|---|---|---|
| POST | `/conversations` | Create conversation |
| GET | `/conversations` | List conversations |
| GET | `/conversations/{id}` | Get conversation |
| PATCH | `/conversations/{id}` | Update conversation |
| PUT | `/conversations/{id}/title` | Update title |
| PUT | `/conversations/{id}/state` | Update state |
| POST | `/conversations/{id}/deactivate` | Deactivate |
| POST | `/conversations/{id}/messages` | Append message |
| GET | `/conversations/{id}/messages` | Get messages |
| PATCH | `/conversations/{conversationId}/messages/{messageId}` | Update message |
| POST | `/conversations/{id}/messages/revert_to_checkpoint` | Revert to checkpoint |
| POST | `/send` | **Main LLM send** |
| POST | `/preprocess` | **Preprocessing (triggers Load Skill Resource)** |
| POST | `/system-prompt-generation` | System prompt assembly |
| GET | `/getTableSchema/{table}` | Table schema lookup |
| GET | `/runQuery/table/{table}/query/{encoded_query}` | DB query |

### Build Agent Keyword Search
Base: `/api/sn_build_agent/build_agent_keyword_search`

| Method | Path | Purpose |
|---|---|---|
| GET | `/getKeywordSearchResult` | Metadata keyword search |
| GET | `/getLatestFluentVS` | Latest Fluent SDK version |
| GET | `/getFluentKS/{apiType}/{fluentVersion}` | **Fetch a specific knowledge source** |
| GET | `/getAvailableAPITypes` | List available artifact types |

### Other APIs
- **Checkpoints API** (`/api/sn_build_agent/checkpoints_api`) — create, restore, finalize checkpoints
- **Conversation Change Log API** (`/api/sn_build_agent/conversation_change_log_api`) — change tracking
- **Update Sets API** (`/api/sn_build_agent/update_sets_api`) — create/complete update sets
- **Build Agent Health** (`/api/sn_build_agent/build_agent_health/check`) — capability check

---

## LLM Configuration

The LLM is **not readable** through provider config tables (all ACL-blocked). Use log evidence:

```bash
simon query sys_gen_ai_log_metadata -i <instance> \
  --query "sys_scope.name=sn_build_agent^ORDERBYDESCsys_created_on" \
  --fields "model_name,sys_created_on" \
  --display-value all --limit 10
```

Known models (as of Feb 2026):
- `claude_large` — Primary (Anthropic Claude via Now LLM Service)
- `text2flow_llm/mistral-nemo-12b-instruct` — Flow generation sub-tasks
- `gemini_small` — Occasional

These are ServiceNow internal aliases, not direct model names.

---

## Conversations & Messages

```bash
# List recent conversations
simon query sn_build_agent_conversation -i <instance> \
  --fields "sys_id,title,state,sys_created_on,sys_created_by" \
  --order-by sys_created_on --order-dir desc --limit 10 \
  --display-value all

# Get messages in a conversation
simon query sn_build_agent_message -i <instance> \
  --query "conversation=<conversation_sys_id>" \
  --fields "sys_id,role,content,sys_created_on" \
  --order-by sys_created_on \
  --display-value all
```

> **ACL gotcha:** `sn_build_agent_conversation`, `sn_build_agent_message`, `sn_build_agent_event_telemetry`, `sn_build_agent_task_telemetry`, and `sn_build_agent_freemium_usage_log` all return **403 "Failed API level ACL Validation"** via standard Table API, even for instance admins. They're readable only through the Build Agent's own API (which needs a user API token / JWT) or via background-script GlideRecord. `sn_build_agent_conversation_change_log` is the one that *is* queryable.

---

## Message Pipeline — REST vs WebSocket

User-message exchange runs over a **WebSocket**, not REST. The REST `POST /conversations/{id}/messages` endpoint persists message records but is not the LLM hot path.

| Property | Default | Meaning |
|---|---|---|
| `sn_build_agent.use_websocket_service` | `true` | Use Nirvana WebSocket pipeline. Set to `false` to fall back to legacy GAIC/oneextend (failsafe). |
| `sn_build_agent.nirvana_websocket_url` | `/sncapps/code/assist/ba/nirvana/web-socket` | WebSocket endpoint |

A dedicated `sys_amb_processor` is registered in the `sn_build_agent` scope.

**Implication for diagnosis:** WebSocket frames don't appear in `syslog_transaction`. If a Build Agent session shows OAuth + `getVariant` + telemetry calls but no `/conversations/{id}/messages` POSTs, that does **not** mean nothing happened — the WS may be carrying the actual traffic. To confirm a hang vs. healthy WS use, look at whether `sn_build_agent_message` rows are being created (via background script — see ACL gotcha above), or grab browser-side WS frames.

---

## OAuth Client

`oauth_entity` "Build Agent OAuth Grant" (client_id varies per instance):

| Field | Value | Notes |
|---|---|---|
| `access_token_lifespan` | `1800` | 30 minutes — any prior-day session has an expired access token. |
| `refresh_token_lifespan` | `8,640,000` | 100 days. |

Refresh chain (in order, all under `/api/sn_build_agent/build_agent_api/`):
`oauth_redirect` → `oauth_auth.do` → `oauth_refresh_token` → `oauth_store_refresh_token` → `getVariant`

A stale token at session start logs `Exception on token flow - invalid_token: The provided OAuth token is not valid` (source `com.glide.ui.ServletErrorListener`) — this is **expected and recoverable**, not a bug by itself; the chain above runs and produces a fresh token. Hung sessions after this chain point at the WebSocket bootstrap, not the REST OAuth.

---

## Error Recovery

`sn_build_agent.error_recovery.config` (JSON) defines retry strategies — but only for LLM-level patterns:
- `messageRecovery.handlers` — regex → strategy (`LAST_TURN`) for things like `thinking`/`redacted_thinking` block mutation and function-call/response count mismatches.
- `exponentialBackoff.delaysMs = [5000, 30000, 60000]` for: `Too many tokens, please wait before trying again`, `ConnectionClosedException`, `Premature end of chunk coded message body`, `resource exhausted`.

Notably **no handler for `invalid_token` / WebSocket-auth failures** — those produce a permanent UI hang requiring a hard browser refresh.

---

## Useful System Properties (sn_build_agent scope)

| Property | Purpose |
|---|---|
| `sn_build_agent.tier_override` | Force `free` or `paid` (paid still requires `sn_build_agent_pro` scope). |
| `sn_build_agent.user_prompt_limit` | Prompts/window in prod (default 25). |
| `sn_build_agent.user_prompt_limit_pdi` | Prompts/window on sub-prod / PDI (default 10). |
| `sn_build_agent.prompt_limit_period_days` | Rolling-window length for the limits above (default 30). |
| `sn_build_agent.tool.execution.timeouts` | Per-tool timeout JSON; default 240000ms, `create_new_servicenow_app` 300000ms. |
| `sn_build_agent.disable.stream.by.provider` | CSV of `sys_one_extend_definition_config` provider IDs that must run non-streaming. |
| `sn_build_agent.keyword_search.default_limit` / `max_field_length` | Knowledge-source search defaults. |

---

## Dead Ends (don't repeat)

- `sys_gen_ai_provider` — ACL-blocked except sys_id
- `sys_gen_ai_routing_selection` — 0 records
- `sn_gen_ai_provider_config`, `sys_ai_capability`, `sn_generative_ai_provider`, `sys_gen_ai_capability`, `sn_generative_ai_capability` — invalid tables
- `sys_generative_ai_capability_definition` — 403 on query
- `sn_ais_assist/admin/v1/providers`, `sn_nowassist_admin/nowassist/configuration` — endpoints don't exist
- `sn_aia_gen_ai_m2m` — 403 on useful fields
- Build Agent API `GET /conversations/{id}/messages` requires a **user API token** (JWT from `get-user-api-token`), not standard OAuth — returns 401 with normal credentials

---

## Version Anatomy — AP1 vs AP2

Tracked across Australia patch levels. Use as a reference when investigating "is feature X available on this instance".

| Patch | Build Agent (`sn_build_agent`) | Build Agent Premium (`sn_build_agent_pro`) |
|---|---|---|
| AP1 | 2.1.10 | 1.1.9 |
| AP2 | 2.2.6  | 1.2.6 |

### Surface diff (AP1 → AP2)

**New tables (+2):**
- `sn_build_agent_skill` — Build Agent Skill
- `sn_build_agent_skill_resource` — Build Agent Skill Resource

> Note: this is a Build-Agent-internal Skill model, **distinct** from Skill Kit (`sn_skill_builder`) and Now Assist skills.

**New REST APIs (+2 services, +7 operations):**
- `Skills API`
- `WDF Mock API`

**New system properties (+2):**
- `sn_build_agent.enable_wdf_server_discovery` — toggles WDF (Workflow Discovery Framework) server discovery
- `sn_build_agent.use_mock_wdf_endpoint` — routes WDF traffic to the mock API for testing

**Dictionary:** +13 fields (driven by the two new tables).

### Unchanged between AP1 and AP2

- **Script Includes**: same 23 names. Bodies are `sys_policy: protected`, so implementation drift can't be diffed via Table API — only the surface is verifiable.
- **Business rules**: 5 on both.
- **Base tables**: the 8 listed in [Tables](#tables) above are present on both.
- **Pre-existing REST APIs**: `Build Agent API`, `Build Agent Keyword Search`, `Build Agent Health`, `Conversation Change Log API`, `Checkpoints API`, `Update Sets API`.

### How to reproduce this diff

```bash
# 1. Identify scope versions
simon api "/api/now/table/sys_scope?sysparm_query=scopeSTARTSWITHsn_build_agent&sysparm_fields=scope,name,version" -i <instance> --output stdout

# 2. Count artifacts per scope across instances
for tbl in sys_script_include sys_script sys_ws_definition sys_ws_operation \
           sys_properties sys_db_object sys_dictionary; do
  simon api "/api/now/stats/$tbl?sysparm_query=sys_scope.scopeSTARTSWITHsn_build_agent&sysparm_count=true" \
    -i <instance> --output stdout
done

# 3. Enumerate names where a count differs
simon api "/api/now/table/<tbl>?sysparm_query=sys_scope.scopeSTARTSWITHsn_build_agent&sysparm_fields=name" \
  -i <instance> --output stdout
```

> **Heads-up:** `sys_app` and `sys_store_app` both return empty/403 for the Build Agent scopes — query `sys_scope` for version info instead.
