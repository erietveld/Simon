# Wrap-Up — End-of-Session Knowledge Capture

When the user says **"wrap up"** (or "let's wrap up", "wrap this up", "session wrap-up"), run through this checklist before signing off. The goal: leave the project in a state where the next session — yours or another agent's — picks up cleanly without having to rediscover anything from this conversation.

Don't run every step blindly. For each, ask: *did something happen this session that needs this step?* If yes, do it. If no, skip and say so briefly. End with a one-paragraph summary of what was captured.

## The checklist

### 1. Doc currency

Did the session change the architecture, data model, REST API surface, tool list, or any other thing described in `ARCHITECTURE.md` / `INDEX.md` files?

- Update affected sections to match reality.
- Bump any `Verified against <instance> on <date>` stamps to today's date.
- If new components shipped (a CLI, a server, a script), make sure they're documented and discoverable from the relevant INDEX.

### 2. Hint candidacy

For each problem the session worked through, ask: *did it take 3+ attempts to find the answer?* If yes, that's a hint candidate.

- Write a new file in `hints/` using the existing hint-file conventions: `name` / `description` / `type` frontmatter, dead-ends-we-tried section, working recipe.
- Register the new hint in the appropriate `INDEX.md`.
- Don't duplicate — check if an existing hint should be extended instead.

### 3. Recurring-issue capture

Did we hit a problem that's likely to recur — Build Agent rebuilding something incorrectly, a platform quirk that reappears after upgrades, a config that gets wiped by a scheduled job?

- Add a section to `hints/build-agent-ai-agent-install-issues.md` (for Build Agent issues) or create a similar log file scoped to whatever recurs.
- Each entry should have: Symptom / Why / Detection query / Fix recipe / Verification. Concrete `simon` commands beat prose.

### 4. Pending work / current state

Is anything in flight — a record mid-test, a fix applied but not yet verified, a feature half-shipped?

- Capture it where the next session will see it. Usually one sentence in `ARCHITECTURE.md`'s "Open Items" or equivalent. Don't create new tracking files unless asked.
- Include the concrete record / sys_id / number where applicable so verification is one query away.

### 5. Tooling discoverability

Did the session create a new CLI, script, server, or other tool?

- It must be findable from the relevant `INDEX.md` and mentioned in `ARCHITECTURE.md` with usage examples.
- If installed via `npm link` or similar, note the install step so a fresh checkout works.

### 6. Memory (sparingly)

Only save to `~/.claude/.../memory/` if the learning is **cross-project and durable** — a preference about how Eric works, a tool pattern that applies broadly. Project-specific facts go in project files, not memory. Default to *not* writing memory.

## Out of scope for wrap-up

- Don't create planning documents, retrospectives, or "what we learned" files unless the user explicitly asks. Eric reads the diff.
- Don't add CLAUDE.md entries unless something genuinely belongs in always-loaded context.
- Don't recap the whole conversation — only capture things that would be lost otherwise.

## End-of-wrap summary

Finish with one short paragraph: which files changed, which checklist items were skipped (one phrase each), and any single follow-up the user might want to act on before next session.
