# ServiceNow Context — How to Handle Unrecognised Terms

## What Simon Is For

Simon is primarily a tool for interacting with **ServiceNow environments**. Most conversations will involve querying, updating, or investigating records on one or more ServiceNow instances.

## When You Don't Recognise Something — Check Instances First

If the user mentions a word or name you don't recognise, it is very likely a **ServiceNow instance name** registered in Simon. Do not treat it as an unknown or ask for clarification before checking.

**Always check first:**
```bash
simon instances   # lists all registered instances with IDs, URLs, and login state
```

## Using the Simon CLI

All ServiceNow operations go through the `simon` CLI binary, invoked via the Bash tool.

**Discovery entry point** — run this first if unsure which command to use:
```bash
simon --help
```

Run `simon <command> --help` for per-command flags and examples.

**Passing record fields (create/update/api writes)** — always pass via `--body`, never per-field flags. Three forms:

```bash
# 1. Heredoc via --body -  (most common)
simon create incident -i myinstance --body - <<'EOF'
{
  "short_description": "Network down",
  "priority": "1"
}
EOF

# 2. From file
simon update incident <sys_id> -i myinstance --body @/tmp/fields.json

# 3. Inline
simon api /api/now/table/incident -X POST -i myinstance --body '{"short_description":"x"}'
```

> **Why explicit:** simon does **not** read stdin implicitly. Without `--body -`, a heredoc is ignored and a piped/looped stdin is rejected with a clear error — this prevents `while read … done < file.tsv` loops from being silently consumed when they call simon inside the loop body.

**Instance targeting** — pass `-i <name-or-id>` to all commands. Accepts exact instance ID (`inst_…`), exact name, or a partial/fuzzy name. When unsure, run `simon instances` first.
