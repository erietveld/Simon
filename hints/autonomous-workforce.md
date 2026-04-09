# Autonomous Workforce (AI Workers) — Hints

> **Version gate:** GA in **ZP8/AP1 (April 9, 2025)** and **YP13 (May 5, 2025)**.
> Available on **Pro+ and Prime AI-Native SKU only**. Not present on older patches.

## Terminology

| Term | Meaning |
|------|---------|
| AI worker | The object/type name (the thing you configure) |
| AI specialist | The AI worker *record* name (what you call a specific instance) |

## Key Tables

| Table | Purpose |
|-------|---------|
| `sn_aia_worker` | Parent table for AI workers (AI specialists) |
| `sn_aia_worker_m2m` | Maps AI worker to AI user record on `sys_user` |

## Scope / SKU Constraints

- Pro+ and Prime AI-Native SKU only
- Assists consumption is still tool-based (not agent-based)
- ITSM L1 AI specialist is the first GA use case (v1)
- HRSD and CSM L1 AI specialists are WIP as of GA date
- Multi-lingual supported (tested on English and Japanese)
- BYOK supported for regulated markets

## Querying AI Workers

```bash
simon query sn_aia_worker \
  --query "active=true" \
  --fields "name,sys_class_name,sys_created_on" \
  --display-value all
```

To find the linked AI user account:

```bash
simon query sn_aia_worker_m2m \
  --query "worker.active=true" \
  --fields "worker,worker.name,user,user.name" \
  --display-value all
```

## Gotchas

- These tables will not exist on instances older than ZP8/AP1 or YP13 — queries will return a 404/invalid table error
- "AI worker" ≠ AI Agent (`sn_aia_agent`) — these are a distinct feature; don't confuse the two
- The `sn_aia_worker_m2m` join table is the right place to find which `sys_user` record acts as the AI persona
