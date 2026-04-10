# Agent Gallery

A collection of documented AI Agent use cases built on ServiceNow. Each file captures the full blueprint for a single agent pattern — role, instructions, tools, prerequisites — so it can be recreated on any instance without guesswork.

## How to capture an agent effectively

When documenting a new AI Agent for this gallery, pull and record the following:

### 1. Agent definition (`sn_aia_agent`)

| Field | Why it matters |
|---|---|
| `name` | Identifies the agent |
| `role` | The agent's persona, tone, and constraints — *who* it is |
| `instructions` | The ordered steps the agent follows — *what* it does |
| `strategy` | Reasoning strategy (e.g. ReAct) |
| `channel` | Where it's deployed (NAP + VA, Teams, etc.) |
| `advanced_mode` | Whether advanced/custom prompt mode is enabled |

### 2. Tools (`sn_aia_agent_tool_m2m` + `sn_aia_tool`)

For each tool assigned to the agent, capture:

| Field | Why it matters |
|---|---|
| Tool name | Human-readable label |
| Tool type | `crud` (Record Lookup), `flow` (Subflow), `catalog`, etc. |
| Target table | Which table the tool queries |
| Query / filter | The encoded query, including any `{{input}}` placeholders |
| Returned fields | Which fields are sent back to the agent |
| Record limit | Max records returned |
| `execution_mode` | `copilot` (Supervised) or `autopilot` (Autonomous) |
| Description | What the tool does — this is what the LLM sees when deciding to use it |

### 3. Triggers & use cases (`sn_aia_trigger_agent_usecase_m2m`)

- Is the agent triggered automatically (record create/update) or manually (chat)?
- If triggered: what table, what condition, what use case?

### 4. Prerequisites

Document anything that must exist on the instance before the agent works:
- Data records (KB articles, catalog items, CMDB entries)
- Specific field values or naming conventions the tools depend on
- Permissions or roles the run-as user needs

### 5. Gotchas & lessons learned

If the agent took multiple iterations to get right, note what went wrong and how it was fixed. This saves the next person from repeating the same discovery.

---

## Gallery contents

| File | Use Case |
|---|---|
| [design-review-agent.md](design-review-agent.md) | Review citizen developer designs against architectural guidelines |
| [business-service-suggestion-agent.md](business-service-suggestion-agent.md) | Suggest existing business services or request new ones |
