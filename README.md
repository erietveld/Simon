# Simon

**S**erviceNow **I**ntegrated **M**CP **O**perations **N**ode — AI assistant for ServiceNow operations.

Simon connects Claude Code directly to your ServiceNow instance. No copy-paste. No plumbing. Describe what you need — query data, configure AI Agents, populate demo environments, inspect logs — and get the result.

**Built for Solution Consultants** who build and manage ServiceNow demo instances, but useful for any developer or admin who wants an agentic layer on top of their environment.

---

Think about how work gets done on an instance today. You need to know which incidents were re-opened last week, or why the Teams Virtual Agent is throwing errors. So you Slack someone who knows — or you ask ChatGPT, get a GlideRecord script back, then go find a background script runner and interpret the results yourself.

Simon is Era 3: you describe what you need, Simon connects directly to your instance, queries the right tables, and brings back the answer.

---

## New to this? Start here

See [INSTALLATION.md](INSTALLATION.md) for a step-by-step guide covering VS Code, Claude Code, Node.js, and first use — no prior experience required.

## Prerequisites

- **Node.js 20.12+** — check your version with `node --version`. Download from [nodejs.org](https://nodejs.org) if needed.
- **Claude Code** — the MCP server integrates directly with Claude Code's CLI.

## Getting Started

**1. Fork and clone the repo**

Fork the repo on GitHub (top-right **Fork** button), then clone your fork:
```bash
git clone https://github.com/<your-username>/simon.git
cd simon
```

> Forking is recommended because `hints/` accumulates your own ServiceNow knowledge over time — forking lets you commit and back up those hints in your own repo. You can still pull upstream updates with `git pull upstream main`.

**2. Install dependencies**
```bash
npm install
```

**3. Start the web server**
```bash
npm start
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

**4. Add a ServiceNow instance**

Go to the **Instances** tab and add your instance. Two auth methods are supported:
- **OAuth 2.0** *(recommended)* — client ID + client secret (requires an OAuth provider set up on the instance)
- **Basic auth** — username + password (simpler to set up, but less secure)

Your credentials are stored locally in `instances.json` (gitignored — never committed).

**5. Set up Claude Code integration**

The MCP server registers automatically via `.mcp.json`. Start a Claude Code session in this project directory and the ServiceNow tools will be available immediately.

## What you can do with Simon

- **Query and manage data** — "Show me all incidents re-opened in the last 7 days, grouped by assignment group"
- **Configure AI Agents** — set up tools, topics, and Now Assist skills through natural language
- **Debug AI features** — inspect LLM logs, trace AI Agent execution, find what's failing and why
- **Populate demo environments** — build out customer storylines and demo data without clicking through forms
- **Multi-instance operations** — connect to multiple DemoHub instances simultaneously (acme, globalbank, etc.) and compare or sync configs without switching context

## Usage

### Web UI (`http://localhost:3001`)
Manage instances and manually test ServiceNow REST API calls.

### Claude Code (MCP tools)
When working in Claude Code, the following tools are available directly in the conversation:

| Tool | Purpose |
|------|---------|
| `sn_query` | Query records from any table |
| `sn_get_record` | Get a single record by sys_id |
| `sn_create_record` | Create a new record |
| `sn_update_record` | Update an existing record |
| `sn_delete_record` | Delete a record |
| `sn_table_structure` | Inspect table schema and relationships |
| `sn_script_include` | Call a Script Include via GlideAjax |
| `sn_rest_api` | Generic REST API call |
| `sn_instance_info` | List configured instances |
| `sn_switch_update_set` | Switch the active update set |

Every tool takes an `instance_id` parameter — you can operate against multiple instances in the same conversation without switching context.

### Hints
`hints/` is an adaptive knowledge library that grows over time. It captures the right query patterns, table relationships, and gotchas for your environment so Simon doesn't repeat discovery work across sessions. Check `hints/INDEX.md` before starting any non-trivial task.

## Optional configuration

Create a `.env` file in the project root to override defaults:
```
PORT=3002
```

## Components

- **`src/server.js`** — Express server (port 3001) with browser UI
- **`src/mcp-server.mjs`** — MCP stdio server exposing ServiceNow tools to Claude Code
- **`src/sn-auth.js`** — Shared OAuth 2.0 / Basic auth token management
- **`src/sn-client.js`** — Shared ServiceNow REST/GlideAjax API client
