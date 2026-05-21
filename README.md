# Simon

**S**erviceNow **I**ntegrated **M**agical **O**perations **N**ode — AI assistant for ServiceNow operations.

Simon connects Claude Code directly to your ServiceNow instance. No copy-paste. No plumbing. Describe what you need — query data, configure AI Agents, populate demo environments, inspect logs — and get the result.

**Built for Solution Consultants** who build and manage ServiceNow demo instances, but useful for any developer or admin who wants an agentic layer on top of their environment.

---

Think about how work gets done on an instance today. You need to know which incidents were re-opened last week, or why the Teams Virtual Agent is throwing errors. So you Slack someone who knows — or you ask ChatGPT, get a GlideRecord script back, then go find a background script runner and interpret the results yourself.

Simon is Era 3: you describe what you need, Simon connects directly to your instance, queries the right tables, and brings back the answer.

---

## Installation

See [INSTALLATION.md](INSTALLATION.md).

> Forking is recommended because `hints/` accumulates your own ServiceNow knowledge over time — forking lets you commit and back up those hints in your own repo. You can still pull upstream updates with `git pull upstream main`.

## What you can do with Simon

- **Query and manage data** — "Show me all incidents re-opened in the last 7 days, grouped by assignment group"
- **Configure AI Agents** — set up tools, topics, and Now Assist skills through natural language
- **Debug AI features** — inspect LLM logs, trace AI Agent execution, find what's failing and why
- **Populate demo environments** — build out customer storylines and demo data without clicking through forms
- **Multi-instance operations** — connect to multiple DemoHub instances simultaneously (acme, globalbank, etc.) and compare or sync configs without switching context

## Usage

### Web UI (`http://localhost:3001`)
Manage instances and manually test ServiceNow REST API calls.

### Claude Code (`simon` CLI)
When working in Claude Code, all ServiceNow operations go through the `simon` CLI via the Bash tool:

| Command | Purpose |
|---------|---------|
| `simon query` | Query records from any table |
| `simon get` | Get a single record by sys_id |
| `simon create` | Create a new record |
| `simon update` | Update an existing record |
| `simon delete` | Delete a record |
| `simon schema` | Inspect table schema and relationships |
| `simon script` | Call a Script Include via GlideAjax |
| `simon api` | Generic REST API call |
| `simon instances` | List configured instances |
| `simon update-set` | Switch the active update set |

Every command takes a `-i <instance>` flag — you can operate against multiple instances in the same conversation without switching context. Run `simon <command> --help` for details.

### Hints
`hints/` is an adaptive knowledge library that grows over time. It captures the right query patterns, table relationships, and gotchas for your environment so Simon doesn't repeat discovery work across sessions. Check `hints/INDEX.md` before starting any non-trivial task.

## Optional configuration

Create a `.env` file in the project root to override defaults:
```
PORT=3002
```

## Components

- **`src/server.js`** — Express server (port 3001) with browser UI
- **`src/sn-auth.js`** — Shared OAuth 2.0 / Basic auth token management
- **`src/sn-client.js`** — Shared ServiceNow REST/GlideAjax API client
