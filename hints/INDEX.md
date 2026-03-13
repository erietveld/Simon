# Hints Index

This file is the registry of all available hint files. Read the relevant hint file(s) **before** performing any ServiceNow operation that touches the listed topic. This avoids re-discovering things through many trial-and-error queries.

## Available Hints

| File | Topic | When to use |
|------|-------|-------------|
| [now-assist-skills.md](now-assist-skills.md) | Now Assist skill configuration, Creator skills, skill families, deployment channels, admin console URL | Querying or configuring Now Assist skills, finding inactive skills, navigating to Now Assist Admin |
| [maint-login.md](maint-login.md) | Logging in as MAINT via hop.do URL | Accessing an instance as MAINT user for administrative tasks |
| [update-set-import.md](update-set-import.md) | Importing an update set XML file, upload.do URL | Navigating directly to the update set import/upload screen |
| [delete-app.md](delete-app.md) | Deleting custom scoped applications with full cascade | Deleting one or more custom apps and all their artifacts |
| [kb-publish.md](kb-publish.md) | Publishing KB articles via API, kb_version behaviour, why direct writes fail on v3 KBs | Creating or publishing KB articles, setting workflow_state |
| [ai-agent-config.md](ai-agent-config.md) | AI Agent table architecture, finding agent by user, adding tools (Record lookup) | Querying or modifying Now Assist AI agents, adding tools to agents |
| [ai-agent-a2a.md](ai-agent-a2a.md) | External Agent (A2A protocol) tables | Working with external/federated agents, A2A connections |
| [ai-agent-runtime.md](ai-agent-runtime.md) | AI Agent runtime execution tables, debug queries | Debugging agent runs, inspecting tool calls and messages |
| [flow-designer-action-inputs-outputs.md](flow-designer-action-inputs-outputs.md) | Querying Flow Designer action inputs/outputs; correct filter is `model_id` not `action_type_definition` | Inspecting action variables, understanding action configuration |
| [mcp-ai-skill-tool-definition-inputs.md](mcp-ai-skill-tool-definition-inputs.md) | How tool inputs for `sn_mcp_ai_skill_tool_definition` work — child records in `sn_mcp_ai_skill_tool_input`, linked via `sys_one_extend_definition_attribute` | Adding/fixing inputs on MCP AI Skill Tool Definitions |
| [flow-actions-ootb.md](flow-actions-ootb.md) | Finding OOB Flow Designer actions, commonly useful actions (Add Work Note, Add Comment), using flow actions as AI Agent tools | Searching for OOB flow actions, adding flow-action-type tools to AI agents |
| [teams-va-consumer-fault.md](teams-va-consumer-fault.md) | Teams VA "technical issues" error caused by stale `sys_cs_consumer_account.consumer` pointer; duplicate consumer records deactivated by platform cleanup job every ~31 min | Diagnosing Teams channel VA/AI Agent faults, "technical issues" error, faulted conversations |

---

## How to Use This Index

1. Before starting a ServiceNow task, scan the **When to use** column.
2. If a hint matches, read that file first.
3. Apply the queries/patterns from the hint directly — don't re-discover them from scratch.

## How to Grow This Index

When a task required **3 or more queries** to figure out the right table/field/pattern:
1. Create a new `hints/<topic>.md` file with the efficient approach.
2. Add a row to this table.

See `CLAUDE.md` for the full hint-writing guidelines.
