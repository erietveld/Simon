# ETool — Project Instructions

## What This Project Is

A ServiceNow development powertool. It provides:
- An **Express web server** (`server.js`, port 3001) with a browser UI for manual testing of ServiceNow APIs
- An **MCP server** (`mcp-server.mjs`) that gives Claude Code native ServiceNow tools directly in this conversation

The Express server handles OAuth authentication. The MCP server reads the same token file, so both work off the same login session.

## Architecture

```
sn-auth.js      — shared OAuth token management (CJS)
sn-client.js    — shared ServiceNow API operations (CJS)
server.js       — Express server + web UI
mcp-server.mjs  — MCP stdio server (ESM, imports CJS via createRequire)
.mcp.json       — Claude Code MCP registration
```


## Hints System

### Always check hints before starting a ServiceNow task

Before performing any non-trivial ServiceNow operation, **read `hints/INDEX.md`** and check if a relevant hint file exists. If it does, read it before issuing any queries. This avoids re-discovering things through many trial-and-error queries.

```
Read: hints/INDEX.md        ← check what hints exist
Read: hints/<topic>.md      ← read the relevant hint(s)
```

### When to write a hint

After completing any task that required **3 or more queries** to figure out the right table, field, or pattern — write a hint file so future sessions don't repeat the same discovery work.

**Trigger examples:**
- Needed to explore multiple tables before finding the right one
- Had to try several query approaches before getting useful results
- Discovered a non-obvious relationship between tables or fields
- Found a key navigation URL or admin console path after searching

### How to write a hint

1. Create `hints/<short-topic-name>.md`
2. Add an entry to `hints/INDEX.md`
3. Structure the hint file with:
   - The **key tables** involved
   - The **efficient query** (the final working approach, not the exploration steps)
   - Any **gotchas** discovered (e.g., "Creator family has 0 direct skills — use sub-families")

**Do NOT store current state** (e.g. which records are active/inactive). Hints capture *how to query*, not *what the data is* — live data belongs in the instance, not in hint files.

### Hint file template

```markdown
# <Topic> — Query Hints

## Key Tables
| Table | Purpose |

## Efficient Query
\`\`\`
sn_query:
  table: ...
  query: ...
  fields: ...
\`\`\`

## Gotchas
- ...
```
