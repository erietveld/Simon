# Lab Cleanup Procedure

Steps to remove leftover test artifacts from lab instances between sessions. Identify lab instances from `simon instances` (typically tagged with a lab prefix).

## Test-data naming convention

Lab test users and their agents are named with a `User<NN>` prefix (e.g. `User39 Interaction Operations`, `User15 KYC Update Agent`). Whitespace between `User` and the number is inconsistent (`User 13`, `user15`, `User2  KYC`) — match case-insensitively and allow optional space.

**Do NOT delete** agents that start with `User` but have no trailing number — those are real (e.g. `User Detail Agent`, `User impact analysis AI Agent`).

## 1. Scan all erlabs in parallel

```bash
for i in <lab1> <lab2> <lab3> ...; do
  simon query sn_aia_agent -i $i --query "nameSTARTSWITHUser" --fields "sys_id,name"
done
```

Filter the results to names matching `^[Uu]ser ?\d+` — these are the test agents.

## 2. Delete in parallel

```bash
simon delete sn_aia_agent <sys_id> -i <instance>
```

Loop the sys_ids per instance. Cascade delete in `sn_aia_*` handles related m2m records (agent_tool_m2m, agent_config, trigger m2m) automatically — no manual cleanup of child tables required.

## 3. Verify

Re-run the scan from step 1; expected output is `[]` per instance (or only the legit `User ...` names without numbers).

## Other lab residue to consider

When the user signals "retesting the lab", also check for:

- **Test interactions / conversations** — `sys_cs_conversation`, `interaction` tables tied to deleted UserXX users
- **Deactivated test sys_users** with `identity_type=ai_agent` whose `sn_aia_agent_config` is now dangling
- **Orphaned `sn_aia_execution_plan`** records for deleted agents

Don't pre-emptively delete these — confirm with the user first, since they may want logs preserved for debugging.

## History

- 2026-05-18: deleted 25 UserXX agents across the lab instances; most concentrated on one of them.
