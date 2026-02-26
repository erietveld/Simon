# Hints Index

This file is the registry of all available hint files. Read the relevant hint file(s) **before** performing any ServiceNow operation that touches the listed topic. This avoids re-discovering things through many trial-and-error queries.

## Available Hints

| File | Topic | When to use |
|------|-------|-------------|
| [now-assist-skills.md](now-assist-skills.md) | Now Assist skill configuration, Creator skills, skill families, deployment channels, admin console URL | Querying or configuring Now Assist skills, finding inactive skills, navigating to Now Assist Admin |
| [maint-login.md](maint-login.md) | Logging in as MAINT via hop.do URL | Accessing an instance as MAINT user for administrative tasks |
| [update-set-import.md](update-set-import.md) | Importing an update set XML file, upload.do URL | Navigating directly to the update set import/upload screen |

---

## How to Use This Index

1. Before starting a ServiceNow task, scan the **When to use** column.
2. If a hint matches, read that file first.
3. Apply the queries/patterns from the hint directly — don't re-discover them from scratch.

## How to Grow This Index

When a task required **3 or more queries** to figure out the right table/field/pattern:
1. Create a new `hints/<topic>.md` file with the efficient approach.
2. Add a row to this table.

See `CLAUDE.md` for the full hint-writing guidelines.
