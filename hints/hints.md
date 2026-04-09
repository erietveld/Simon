# Hints System — How It Works

## When to write a hint

After completing any task that required **3 or more attempts** to figure out the right approach.

**Triggers:**
- Explored multiple tables before finding the right one
- Tried several query approaches before getting useful results
- Discovered a non-obvious relationship between tables or fields
- Found a key navigation URL or admin console path after searching
- Discovered how a ServiceNow API or feature actually works (publishing, workflow triggers, ACL behaviour, etc.)
- Hit a dead end (API limitation, ACL block, unsupported pattern) — document what was tried and why it failed
- An existing hint covered a specific case but a more general variant still required exploration — add the general variant to the existing file

> **Hints vs memory:** ServiceNow how-to knowledge belongs in a hint file, NOT in auto-memory. Memory is for project-level context. Hints are for reusable ServiceNow knowledge.

## How to write a hint

1. Create `hints/<short-topic-name>.md`
2. Add an entry to `hints/INDEX.md`
3. Include: key tables, the efficient approach (final working pattern, not exploration steps), gotchas/dead ends, and a runnable script if needed

**Do NOT store current state** (e.g. which records are active/inactive). Hints capture *how to do things*, not *what the data is*.

## When to include a script

Include a self-contained Node.js script template when:
- The task fires many API calls that can be parallelised (bulk installs, bulk updates, etc.)
- The task requires intermediate computation between steps that is awkward via CLI round-trips
- The operation is likely to be repeated in future sessions

Scripts go to `/tmp/<task-name>.js` and are run from the Simon project root with `node /tmp/<task-name>.js`. They use `src/sn-auth.js` + `src/sn-client.js` directly — no server required.

**Script conventions:**
- `require('./src/sn-auth')` and `require('./src/sn-client')` — reuse existing auth
- Use `auth.getInstance(instanceId)` to resolve an instance
- Mark the configurable section clearly with `// --- Configure these ---`
- Print a summary to stdout

## Hint file template

```markdown
# <Topic> — Hints

## Key Tables
| Table | Purpose |

## How It Works / Efficient Approach
\`\`\`bash
simon query <table> \
  --query "..." \
  --fields "..."
\`\`\`

## Script (if bulk/parallel work needed)
\`\`\`js
// /tmp/<task>.js — run from Simon project root: node /tmp/<task>.js
'use strict';
const auth = require('./src/sn-auth');
const snClient = require('./src/sn-client');

// --- Configure these ---
const INSTANCES = ['inst_...'];
// --- End config ---

async function run(instanceId) { ... }

Promise.all(INSTANCES.map(run)).then(console.log).catch(console.error);
\`\`\`

## Gotchas
- ...
```
