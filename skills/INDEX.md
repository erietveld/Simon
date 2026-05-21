# Skills Index

This file is the registry of all available skill files. Read the relevant skill file when its **When to use** column matches what you're about to do.

Skills differ from hints: hints are *recipes for tricky lookups*, skills are *durable capabilities and workflows* (how to use a CLI, how to wrap up a session, where to find product docs).

## Available Skills

| File | Topic | When to use |
|------|-------|-------------|
| [servicenow-context.md](servicenow-context.md) | How to handle unrecognised terms (likely instance names); `-i <instance>` flag; `simon instances`; CLI usage patterns and output conventions | **Read at the start of every session, before any `simon` command.** Also when a user-mentioned word isn't recognised. |
| [wrap-up.md](wrap-up.md) | End-of-session knowledge-capture checklist: doc currency, hint candidacy, recurring-issue logs, pending work, tooling discoverability | When the user says "wrap up" (or any close variant) |
| [servicenow-product-docs.md](servicenow-product-docs.md) | Live ServiceNow product docs via the `ServiceNow/ServiceNowDocs` GitHub repo (LLM-optimised markdown); branch-per-release-family rotates, discover via `llms.txt`; folder→topic map | Conceptual / product-feature questions ("how does X work", "what's the canonical way to set up Y") that are answered by product docs rather than instance data |

## How to Use This Index

1. At session start, scan the **When to use** column.
2. Read any skill whose trigger matches the session's likely shape.
3. Re-scan when the conversation shifts topic — a new skill may now apply.

## How to Grow This Index

Add a skill file when there's a durable workflow or tool interface that future sessions will need — not a one-off lookup (those are hints). Register the file here with one row.

## Personal Customizations

**Edit this section to fit your own setup.** Everything below is local to one user's environment — session-start rituals, private CLIs, agent-manager integrations, etc. If you're running a clean clone of Simon, you can leave this section empty or delete the examples.

The example below shows the pattern: tell Simon what extra command(s) to run and why, and Simon will honor it like any other project instruction.

### Example: session-start agent manager (replace or remove)

> **REQUIRED: Run `zeus init` as the very first action in every conversation.** It returns onboarding notes and the current `agent-guidelines.md` from Zeus — a personal central agent manager that keeps cross-project guidance in sync. Use `zeus send "<message>"` to send feedback back to Zeus.

If you don't have an agent manager like this, delete the block above. If you have a different one (e.g. your own wrapper, a team-shared MCP server, a private CLI), describe it here in the same shape: **what command to run, when, and what Simon should do with the output.**

### Other things people put here

- Private CLIs that complement `simon` (e.g. a wiki/notes tool, a customer-specific data fetcher).
- Per-user tone or persona tweaks beyond what `CLAUDE.md` defines.
- Pointers to private hint directories or shared team knowledge bases.
- Custom wrap-up steps (e.g. "also post a summary to channel X").
