# Hints Index

This file is the registry of all available hint files. Read the relevant hint file(s) **before** performing any ServiceNow operation that touches the listed topic. This avoids re-discovering things through many trial-and-error queries.

## Available Hints

| File | Topic | When to use |
|------|-------|-------------|
| [ide-file-index-crash.md](ide-file-index-crash.md) | IDE crash on load — `syncStepsV2` / `readFile` / `.slice()` on undefined; tombstone cleanup via MAINT | IDE fails to load with TypeError, diagnosing and fixing sn_glider_ide_file_index tombstones |
| [now-assist-skills.md](now-assist-skills.md) | Now Assist skill configuration, Creator skills, skill families, deployment channels, admin console URL | Querying or configuring Now Assist skills, finding inactive skills, navigating to Now Assist Admin |
| [maint-login.md](maint-login.md) | Logging in as MAINT via hop.do URL | Accessing an instance as MAINT user for administrative tasks |
| [update-set-import.md](update-set-import.md) | Importing an update set XML file, upload.do URL | Navigating directly to the update set import/upload screen |
| [delete-app.md](delete-app.md) | Deleting custom scoped applications with full cascade | Deleting one or more custom apps and all their artifacts |
| [kb-publish.md](kb-publish.md) | Publishing KB articles via API, kb_version behaviour, why direct writes fail on v3 KBs | Creating or publishing KB articles, setting workflow_state |
| [ai-agent-config.md](ai-agent-config.md) | AI Agent table architecture, finding agent by user, role vs instructions, trigger conditions | Querying or navigating Now Assist AI agents, understanding the data model |
| [ai-agent-tools.md](ai-agent-tools.md) | Adding tools to AI agents: Record Lookup (CRUD), Subflow, Flow Action patterns; OOB comment subflows; silent-success failure when CRUD update tool has no `fieldValues` mapping | Adding or modifying tools on an AI agent; debugging an update tool that reports success but never changes the field |
| [ai-agent-a2a.md](ai-agent-a2a.md) | External Agent (A2A protocol) tables | Working with external/federated agents, A2A connections |
| [ai-agent-runtime.md](ai-agent-runtime.md) | AI Agent runtime execution tables, LLM log chain (sys_gen_ai_log_metadata → sys_generative_ai_log), raw system prompt extraction, Download Log gotchas; "trigger fired but no execution_plan" = disabled agent (syslog `Trying to execute a disabled agent`) | Debugging agent runs, inspecting tool calls, messages, and raw LLM prompts/responses; diagnosing a trigger that never produced a run |
| [flow-designer-action-inputs-outputs.md](flow-designer-action-inputs-outputs.md) | Querying Flow Designer action inputs/outputs; correct filter is `model_id` not `action_type_definition` | Inspecting action variables, understanding action configuration |
| [flow-designer-version-revert.md](flow-designer-version-revert.md) | Per-publish history of a flow lives in `sys_update_version` (NOT `sys_hub_flow_snapshot` / `sys_audit` / `sys_update_xml`); revert is UI-only, no REST endpoint | Restoring a broken Flow Designer flow to an earlier version; finding prior versions of any update-set-tracked artifact |
| [mcp-ai-skill-tool-definition-inputs.md](mcp-ai-skill-tool-definition-inputs.md) | How tool inputs for `sn_mcp_ai_skill_tool_definition` work — child records in `sn_mcp_ai_skill_tool_input`, linked via `sys_one_extend_definition_attribute` | Adding/fixing inputs on MCP AI Skill Tool Definitions |
| [flow-actions-ootb.md](flow-actions-ootb.md) | Finding OOB Flow Designer actions, commonly useful actions (Add Work Note, Add Comment), using flow actions as AI Agent tools | Searching for OOB flow actions, adding flow-action-type tools to AI agents |
| [teams-va-consumer-fault.md](teams-va-consumer-fault.md) | Teams VA "technical issues" error caused by stale `sys_cs_consumer_account.consumer` pointer; duplicate consumer records deactivated by platform cleanup job every ~31 min | Diagnosing Teams channel VA/AI Agent faults, "technical issues" error, faulted conversations |
| [nowsdk-ui-page-apps.md](nowsdk-ui-page-apps.md) | NowSDK / build-agent SPA apps: single bundle, auto-generated `sys_ui_page` HTML shells, client-side routing, deploy flow, "wrong page renders" diagnosis | Investigating or debugging NowSDK-built scoped apps, routing bugs, understanding the deploy model |
| [scripted-rest-api.md](scripted-rest-api.md) | Creating Scripted REST APIs: correct table (`sys_ws_definition` not `sys_web_service`), required fields, namespace rules, example KB publisher script | Creating or calling Scripted REST APIs on ServiceNow |
| [custom-subflow-agent-tool.md](custom-subflow-agent-tool.md) | Creating custom subflows and wiring them as AI Agent tools; how to inspect subflow inputs via `label_cache`; why `sys_hub_flow_input` and `sys_hub_action_instance` filters don't scope correctly | Building a custom subflow and adding it as a tool to an AI agent |
| [app-install-upgrade.md](app-install-upgrade.md) | Bypassing the Plugin Manager Suite UI to install/upgrade a single store app; CI/CD REST API approach; Now Assist Skill Kit suite details | Installing or upgrading a store app when suite siblings are blocked |
| [suite-member-management.md](suite-member-management.md) | Removing apps from a suite (`sys_suite_config_app_version_m2m`); cross-scope ACL workaround via temp Script Include in `sn_appclient` scope; bulk upgrade all suite members via CI/CD | Removing suite members, bulk-upgrading a Now Assist suite |
| [instance-performance-tuning.md](instance-performance-tuning.md) | How to diagnose and fix slow POV instances; standard playbook for disabling EM/ITOM/CMDB jobs; syslog_transaction timing approach; run_period format; stacking job detection | Improving instance performance, reducing background job load |
| [plugin-store-sync.md](plugin-store-sync.md) | Plugin/store app sync: last sync time via `sn_appclient.apps_last_sync_time` sys_property, how to trigger live sync via `POST /api/sn_appclient/appmanager/apps?tab_context=updates` | Checking when plugins last synced, forcing a plugin catalog refresh |
| [mfa-enforcement.md](mfa-enforcement.md) | MFA setup: per-user enforcement table, role-based triggers, group exemptions, background script workaround for changing enforced status, ACL-blocked device table | Managing MFA enforcement, exempting users, clearing MFA state |
| [build-agent.md](build-agent.md) | Build Agent (`sn_build_agent`) complete reference: tables, system prompt chain, knowledge sources (skill resources), REST APIs, LLM config, conversations, dead ends | Any Build Agent investigation — system prompt extraction, skill resource lookup, LLM identification, conversation/message queries, understanding the preprocessing pipeline |
| [identity-type-change.md](identity-type-change.md) | Changing `sys_user.identity_type` to/from `ai_agent`; "Handle Identity type change" BR block + disable/update/reenable workaround | Converting a regular user into an AI User (or vice versa) |
| [autonomous-workforce.md](autonomous-workforce.md) | Autonomous workforce / AI workers: `sn_aia_worker`, `sn_aia_worker_m2m`; terminology (AI worker vs AI specialist); version gate ZP8/AP1 + YP13; SKU requirements | Querying or configuring AI workers (AI specialists); checking if the feature is available on an instance |
| [configurable-workspace-anatomy.md](configurable-workspace-anatomy.md) | Inside a Configurable Workspace: tables (`sys_ux_page_registry` + `sys_ux_app_config` + `sys_ux_app_route` + `sys_ux_page_property`), list menu chain (`sys_ux_list_menu_config` → `sys_ux_list_category` → `sys_ux_list`), URL anatomy, Build Agent duplicate-registry / dangling-`listConfigId` gotcha | Diagnosing missing lists in a workspace, understanding the data model behind `/now/<path>/...`, fixing what Build Agent broke during a rebuild |
| [workspace-dropdown-source.md](workspace-dropdown-source.md) | What populates the unified-nav Workspaces dropdown: `sys_ux_page_registry` filtered by Workspace App Shell macroponent + `sys_ux_registry_m2m_category`; legacy `sys_aw_master_config` is NOT the source | Diagnosing why a Configurable Workspace doesn't appear in the Workspaces dropdown; understanding the three-record anatomy of a workspace |
| [workspace-fluent-sync-errors.md](workspace-fluent-sync-errors.md) | Fluent sync TS errors after creating a Configurable Workspace: hyphenated view name, empty ACL `local_or_existing`/`decision_type`, scope-mismatched property; ACL needs security_admin elevation (deeplink workaround) | New workspace breaks Fluent sync; fixing auto-generated records that fail TS validation |
| [property-scope-on-create.md](property-scope-on-create.md) | Why new sys_properties records land in the wrong scope: `sys_scope` field is set from the API user's `apps.current_app` preference, not the request body | Creating sys_properties (or any scope-aware record) and needing it in a specific scope (e.g. global) when simon's user is in a scoped app |
| [syslog-query-discipline.md](syslog-query-discipline.md) | Always time-bound `syslog`; prefer indexed `source`/`level`; never OR multiple `messageLIKE`; sort+limit always | Any time you're about to query the `syslog` table — read this first to avoid runaway scans |
| [lab-cleanup.md](lab-cleanup.md) | Removing `User<NN>` test AI agents from lab instances between sessions; cascade-delete behaviour; what NOT to delete | "Retesting the lab", cleaning up leftover test agents/users on lab instances |
| [build-agent-ai-agent-install-issues.md](build-agent-ai-agent-install-issues.md) | Recurring Build Agent bugs when installing/updating AI Agents: silent CRUD no-op writes (missing `fieldValues` mapping in `sn_aia_agent_tool_m2m.inputs`), duplicate RAG retrievers | After any Build Agent install/update of an AI Agent — run the detection queries before testing |

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
