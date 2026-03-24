# Simon

ServiceNow Integrated MCP Operations Node — ServiceNow development and admin powertool. Provides a local Express web server for manual API testing and an MCP server that gives Claude Code native ServiceNow tools.

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

## Usage

### Web UI (`http://localhost:3001`)
Use the browser UI to manually test ServiceNow REST API calls and manage instances.

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
| `sn_switch_instance` | Switch the active instance |
| `sn_switch_update_set` | Switch the active update set |

### Hints
`hints/` contains query patterns and gotchas for common ServiceNow tasks accumulated over time. Check `hints/INDEX.md` before starting a non-trivial task — it often saves a lot of trial and error.

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
