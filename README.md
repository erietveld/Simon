# ETool

ServiceNow development powertool. Provides a local Express web server for manual API testing and an MCP server that gives Claude Code native ServiceNow tools.

## Components

- **`server.js`** — Express server (port 3001) with browser UI for manual testing
- **`mcp-server.mjs`** — MCP stdio server exposing 10 ServiceNow tools to Claude Code
- **`sn-auth.js`** — Shared OAuth 2.0 token management (used by both servers)
- **`sn-client.js`** — Shared ServiceNow REST/GlideAjax API client

## Setup

```bash
npm install
npm start   # http://localhost:3001
```

Open the browser UI and go to the **Instances** tab to add your first ServiceNow instance. No `.env` file required.

> Optionally create a `.env` file to override the port: `PORT=3002`

## Instance management

Instances (including credentials and OAuth tokens) are stored in `instances.json` (gitignored). Manage instances via the web UI at `http://localhost:3001`.

## MCP tools

The MCP server is registered in `.mcp.json` and picked up automatically by Claude Code. Available tools: `sn_query`, `sn_get_record`, `sn_create_record`, `sn_update_record`, `sn_delete_record`, `sn_table_structure`, `sn_script_include`, `sn_rest_api`, `sn_instance_info`, `sn_switch_instance`.

## Hints

`hints/` contains query patterns and gotchas for common ServiceNow tasks. See `hints/INDEX.md`.
