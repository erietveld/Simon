# AI Agent Configuration — Hints

## Architecture

```
sys_user (identity_type=ai_agent)   ← the "run as" service account
    |
    v  run_as_user
sn_aia_agent_config                 ← deployment config (channel, public/private)
    |
    v  agent
sn_aia_agent                        ← agent definition (name, instructions, role, strategy)
    |
    +-- sn_aia_agent_tool_m2m       ← assigns tools to the agent (holds inputs JSON)
    |       |
    |       v  tool
    |   sn_aia_tool                 ← tool definition (name, type, description)
    |
    +-- sn_aia_agent_child          ← sub-agent (orchestrator) mappings
    |
    +-- sn_aia_trigger_agent_usecase_m2m  ← links agent to trigger + use case
```

---

## Table Reference by Category

### Core — Agent Definition (read/write these to build agents)

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_agent` | AI Agent | Agent definition: name, instructions, role, strategy, channel, advanced_mode |
| `sn_aia_agent_config` | AI Agent Config | Deployment config: links `run_as_user` (sys_user) to an agent; controls public/guest access |
| `sn_aia_strategy` | Strategy | Strategy definitions (e.g. ReAct) — reference, rarely modified |
| `sn_aia_agent_modification` | AI Agent Modification | Overrides/patches to an agent definition |
| `sn_aia_version` | AIA Version | Version records for agent definitions |

### Tools (read/write to add capabilities to an agent)

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_tool` | Tool | Tool definition: name, type (`crud`/`flow`/etc.), description |
| `sn_aia_agent_tool_m2m` | Agent Tool | Junction: assigns tool to agent; holds `inputs` JSON with query config, `execution_mode` |
| `sn_aia_agent_tool_document` | AI Agent Tool Document | Document/attachment linked to a tool |

### Use Cases & Triggers

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_usecase` | Use case | Defines a use-case scenario for an agent |
| `sn_aia_trigger_configuration` | AIA Trigger Configuration | Defines when/how an agent is triggered |
| `sn_aia_trigger_config_override` | Trigger Configuration Override | Instance-level overrides of trigger config |
| `sn_aia_usecase_config_override` | Usecase Configuration Override | Instance-level overrides of use case config |
| `sn_aia_trigger_agent_usecase_m2m` | Trigger M2M | Links a trigger ↔ agent ↔ use case |
| `sn_aia_trigger_conversation_m2m` | Trigger Conversation M2M | Links a trigger to a conversation |

### Teams & Orchestration

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_team` | Team | Defines a team of agents |
| `sn_aia_team_member` | Team Member | Links agents to a team |
| `sn_aia_agent_child` | Agent Child Mapping | Sub-agent mapping for orchestrator patterns |
| `sn_aia_worker` | Worker | Worker process definition |
| `sn_aia_worker_template` | Worker Template | Template for worker processes |
| `sn_aia_worker_user_m2m` | Worker User M2M | Links workers to users |

### Memory

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_memory` | AI Agent Memory | Runtime memory records for an agent |
| `sn_aia_memory_category` | AI Agent Memory Categories | Category definitions for memory |
| `sn_aia_memory_execution_m2m` | Memory Execution M2M | Links memory to an execution |
| `sn_aia_ltm_category` | AI Agent Memory Categories (LTM) | Long-term memory category definitions |
| `sn_aia_ltm_category_mapping` | AI Agent Category Mappings (LTM) | LTM category mappings |
| `sn_aia_category_mapping` | AI Agent Category Mappings | General category mappings |

### Skills & Metadata

| Table | Label | Purpose |
|---|---|---|
| `sn_aia_skill_metadata` | AI Agent Skill MetaData | Metadata about skills used by agents |
| `sn_aia_skill_provider_rule` | AIA Skill Provider Rule | Rules that determine which skill provider to use |
| `sn_aia_gen_ai_m2m` | Gen AI Metadata M2M | Links agents to Gen AI metadata |
| `sn_aia_property` | Agent Property | Key-value properties on an agent |
| `sn_aia_extensibility` | AI Agent Extensibility | Extensibility hooks |
| `sn_aia_conversational_debugger_mapping` | Conversational Debugger Mapping | Debug tooling mappings |

> **Ignore:** `np$sn_aia_*` tables are internal ServiceNow shadow/versioning tables — do not read or write these directly. `*_lab` suffix tables are UI label variants, not data tables.

---

## Efficient Query Patterns

### Find agent config by sys_user
```
sn_query:
  table: sn_aia_agent_config
  query: run_as_user=<sys_user_sys_id>
  fields: sys_id,agent,run_as_user,active,public
  display_value: all
```

### Find tools assigned to an agent
```
sn_query:
  table: sn_aia_agent_tool_m2m
  query: agent=<sn_aia_agent_sys_id>
  fields: sys_id,name,tool,active,description,execution_mode,inputs
  display_value: all
```

### role vs instructions fields

- `role` — persona, tone, constraints, what NOT to do. This is the agent's identity.
- `instructions` — ordered step-by-step workflow. This shows as the "Steps" / "List of steps" in Agent Studio.
- When both are populated, Agent Studio renders them as separate sections. If everything is in `role` only, the "Steps" section appears empty in the UI.

### Trigger conditions

- `trigger_flow_definition_type` determines when the trigger evaluates: `record_create`, `record_update`, etc.
- For `record_create` triggers, do NOT use `CHANGESTO` operators — the record is new, fields don't "change to" a value. Use simple equality: `state=2` not `stateCHANGESTO2`.
- For `record_update` triggers, `CHANGESTO` and `VALCHANGES` operators work correctly.
- The `condition` field uses standard ServiceNow encoded query syntax.

---

## Gotchas

- The sys_user → agent link is **only** via `sn_aia_agent_config.run_as_user` — NOT via `sn_aia_agent.source_id` (often empty)
- Not all `identity_type=ai_agent` sys_users have an `sn_aia_agent_config` record — some are plain service accounts
- Querying `run_as_userNOT EMPTY` on `sn_aia_agent_config` throws 403 — always query by specific sys_id
- `execution_mode` API value is `autopilot` (UI shows "Autonomous")
- Agent `role` vs `instructions`: put persona/tone in `role`, put ordered steps in `instructions`. If instructions is empty, the "Steps" section in Agent Studio is blank.
- Trigger `CHANGESTO` operator: only works with `trigger_flow_definition_type=record_update`. For `record_create` use simple equality (`state=2`)
- `sn_aia_trigger_agent_usecase_m2m` does NOT have an `agent` field. The link to the agent is via `related_resource_table` (= `sn_aia_agent`) + `related_resource_record` (= agent sys_id). Setting a non-existent `agent` field silently does nothing.
