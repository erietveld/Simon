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
