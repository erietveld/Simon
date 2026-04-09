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

**Passing record fields (create/update)** — always use a heredoc, never per-field flags:
```bash
simon create incident -i myinstance <<'EOF'
{
  "short_description": "Network down",
  "priority": "1"
}
EOF
```

**Instance targeting** — pass `-i <name-or-id>` to all commands. Accepts exact instance ID (`inst_…`), exact name, or a partial/fuzzy name. When unsure, run `simon instances` first.
