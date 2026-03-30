# Simon — Project Instructions

## Identity & Character

See [skills/simon.md](skills/simon.md).

## Skills

Behaviour guides for working with this project live in `skills/`. Read the relevant one before acting:

| File | When to use |
|------|-------------|
| [skills/simon.md](skills/simon.md) | Always — defines Simon's identity and character |
| [skills/servicenow-context.md](skills/servicenow-context.md) | Any time — covers how to handle unrecognised instance names and how to use the MCP tools |

## Maintenance

See [MAINTENANCE.md](MAINTENANCE.md) for procedures such as keeping instance names out of project files.

## What This Project Is

A ServiceNow development powertool. It provides:
- An **Express web server** (`server.js`, port 3001) with a browser UI for manual testing of ServiceNow APIs
- An **MCP server** (`mcp-server.mjs`) that gives Claude Code native ServiceNow tools directly in this conversation

The Express server handles OAuth authentication. The MCP server reads the same `instances.json` store, so both work off the same login session.

## Architecture

```
src/sn-auth.js      — shared OAuth token management (CJS)
src/sn-client.js    — shared ServiceNow API operations (CJS)
src/server.js       — Express server + web UI
src/mcp-server.mjs  — MCP stdio server (ESM, imports CJS via createRequire)
.mcp.json           — Claude Code MCP registration
```


## Hints System

### Always check hints before starting a ServiceNow task

Before performing any non-trivial ServiceNow operation, **read `hints/INDEX.md`** and check if a relevant hint file exists. If it does, read it before issuing any queries. This avoids re-discovering things through many trial-and-error queries.

```
Read: hints/INDEX.md        ← check what hints exist
Read: hints/<topic>.md      ← read the relevant hint(s)
```

### When to write a hint

After completing any task that required **3 or more attempts** to figure out the right approach — write a hint file so future sessions don't repeat the same discovery work.

**Trigger examples:**
- Needed to explore multiple tables before finding the right one
- Had to try several query approaches before getting useful results
- Discovered a non-obvious relationship between tables or fields
- Found a key navigation URL or admin console path after searching
- Discovered how a ServiceNow API or feature actually works (e.g. publishing, workflow triggers, ACL behaviour)
- Hit a dead end (API limitation, ACL block, unsupported pattern) — document what was tried and why it failed
- An existing hint covered a specific case but a more general variant still required exploration (e.g., existing query required a known sys_id, but the task needed "find the most recent across all agents" with no known input) — add the general variant to the existing hint file

> **Hints vs memory:** ServiceNow how-to knowledge — query patterns, API behaviour, workarounds, gotchas — belongs in a hint file, NOT in Claude's auto-memory. Memory is for project-level context (structure, preferences). Hints are for reusable ServiceNow knowledge.

### How to write a hint

1. Create `hints/<short-topic-name>.md`
2. Add an entry to `hints/INDEX.md`
3. Structure the hint file with:
   - The **key tables** involved (if applicable)
   - The **efficient approach** (the final working pattern, not the exploration steps)
   - Any **gotchas or dead ends** discovered (e.g., "Direct write reverted by business rule — must go through workflow")

**Do NOT store current state** (e.g. which records are active/inactive). Hints capture *how to do things*, not *what the data is* — live data belongs in the instance, not in hint files.

### Hint file template

```markdown
# <Topic> — Hints

## Key Tables
| Table | Purpose |

## How It Works / Efficient Approach
\`\`\`
sn_query:
  table: ...
  query: ...
  fields: ...
\`\`\`

## Gotchas
- ...
```
