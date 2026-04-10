# Maintenance Procedures

## Keep Instance Names Out of Project Files

`instances.json` is the authoritative store for registered ServiceNow instances. Instance names (e.g. real customer or lab subdomain names) must not appear anywhere else in the project — not in examples, placeholders, hints, or skills files.

**Use `myinstance` as the generic placeholder** in any documentation or example that needs an instance name.

**After adding or removing an instance**, run a quick check:

```bash
grep -r "<instance-name>" . --include="*.md" --include="*.html" --include="*.js" --exclude-dir=node_modules
```

Or search for each registered name from `instances.json` across the project to confirm no stray references exist.

## Check for Leaked ServiceNow Internal Data

Hints and skills files should only capture *how to do things*, never actual data from a ServiceNow instance. Periodically verify that no internal information has leaked into project files.

**What to look for:**

| Type | Examples |
|------|---------|
| sys_ids | 32-char hex strings like `a1b2c3d4e5f6...` |
| Record names/numbers | `INC0012345`, `CHG0001234`, `RITM0056789` |
| Usernames / user sys_ids | Any `sys_id` tied to a person |
| Table data snippets | Field values, record contents copied verbatim |
| Internal URLs | Paths containing instance-specific endpoints or record links |

**How to check:**

```bash
# Look for sys_id-shaped strings (32 hex chars)
grep -rE '[0-9a-f]{32}' . --include="*.md" --exclude-dir=node_modules

# Look for common SN record number prefixes
grep -rE '\b(INC|CHG|RITM|PRB|TASK|REQ|SCTASK)\d{7}\b' . --include="*.md" --exclude-dir=node_modules
```

**If found:** remove the data from the file. If the information was useful context, rephrase it as a generic pattern or observation rather than copying live data.

## Audit for Inconsistencies and Tangled Guidance

Periodically review the instruction/context files to catch conflicting rules, stale references, and duplicated content before they cause confusion.

**Files to review together:**

| File | Role |
|------|------|
| `CLAUDE.md` | Always-loaded rules and pointers |
| `skills/*.md` | Loaded on demand — behavioural guides |
| `.claude/agents/*.md` | Subagent definitions |
| `hints/INDEX.md` + `hints/*.md` | Query/table knowledge |
| `memory/MEMORY.md` + `memory/*.md` | Persistent cross-session state |

**What to look for:**

- **Conflicting rules** — same topic addressed differently in two files (e.g. "never use subagent" in a skill vs. "use subagent for X" in an agent definition)
- **Duplicated content** — the same information spelled out in multiple places; consolidate to one and point to it
- **Stale pointers** — references to files, tools, or fields that no longer exist
- **Orphaned files** — skill or hint files not referenced from any index
- **Memory vs. reality** — memory files asserting something about the codebase that no longer holds; verify with a grep or file read, then update or delete

**Quick checks:**

```bash
# Find hint files not listed in INDEX.md
for f in hints/*.md; do
  name=$(basename "$f")
  grep -q "$name" hints/INDEX.md || echo "UNLISTED: $f"
done

# Find broken file references in CLAUDE.md and skills
grep -rE '\[.*\]\(.*\.md\)' CLAUDE.md skills/ | grep -v 'http' | \
  sed 's/.*(\(.*\))/\1/' | while read p; do [ -f "$p" ] || echo "MISSING: $p"; done
```

**After fixing:** if the inconsistency was non-obvious (e.g. two files pulling in opposite directions), add a note here so future audits know it was a known problem area.

## Sanitise Agent Gallery Entries

Agent Gallery files document reusable AI Agent patterns. Because they are often captured from real instances (e.g. after a workshop), the raw data may contain participant names, user IDs, sys_ids, or implementation mistakes that should not end up in the gallery.

**Before committing a new or updated gallery entry, strip the following:**

| Remove | Why |
|--------|-----|
| Participant names or initials (e.g. "ER", "VNPK") | Privacy; the pattern should be generic |
| User sys_ids or agent sys_ids | Instance-specific data, not reusable |
| References to bugs, mistakes, or broken configurations | The gallery should describe the *correct* pattern, not document errors |
| Record numbers from real instances | Internal data leak |

**What to keep:** if a mistake reveals a useful lesson (e.g. "use `LIKE` instead of exact match"), rephrase it as a positive best-practice tip rather than describing the original error.

**Quick check:**

```bash
# Scan gallery files for sys_id-shaped strings
grep -rE '[0-9a-f]{32}' AgentGallery/ --include="*.md"

# Scan for common SN record number patterns
grep -rE '\b(INC|CHG|RITM|PRB|TASK|REQ|SCTASK)\d{7}\b' AgentGallery/ --include="*.md"
```

## Keep CLAUDE.md Token-Efficient

CLAUDE.md is loaded into every conversation, so it should stay lean. Move detailed content into dedicated files and replace it with a short reference.

**When to extract:** any section in CLAUDE.md that is longer than ~10 lines and isn't critical to read on every task (architecture overviews, procedure details, background context).

**How to extract:**

1. Create a dedicated file (e.g. `ARCHITECTURE.md`, `ONBOARDING.md`) with the full content.
2. Replace the section in CLAUDE.md with a single-line pointer:
   ```
   ## Architecture
   See [ARCHITECTURE.md](ARCHITECTURE.md) for project overview and file map.
   ```
3. Keep the section heading in CLAUDE.md so the structure is still discoverable.

**Good candidates for extraction:** architecture descriptions, onboarding guides, detailed procedures, background context.
**Keep inline:** anything Claude needs to act on immediately (identity/character, must-follow rules, the hints requirement).

## Manage Hint File Size

Hint files should remain focused and scannable. A file that grows too large becomes harder to use than no hint at all.

**When to split:** if a hint file exceeds ~150 lines, review whether it covers more than one distinct topic. If it does, split it.

**How to check:**

```bash
wc -l hints/*.md
```

**How to split:**

1. Identify the natural seam — usually two separate tables, workflows, or API areas that happen to share a file.
2. Create a new file `hints/<new-topic>.md` for one of the topics, following the standard template.
3. Remove the migrated content from the original file and update its scope in the header.
4. Update `hints/INDEX.md` to add the new entry (and revise the description of the original if its scope narrowed).

**If the file is large but cohesive** (all one topic, just detailed), trim it instead: collapse redundant examples, remove exploration dead-ends that are already covered by a single note in the Gotchas section, and keep only the minimal working pattern.
