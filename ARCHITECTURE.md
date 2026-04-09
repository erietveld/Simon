# Architecture

## What This Project Is

A ServiceNow operations powertool. It provides:
- A **`simon` CLI** (`cli.mjs`) — the primary interface. Claude invokes it via the Bash tool. Exposes all ServiceNow operations as subcommands with progressive `--help` discovery.
- An **Express web server** (`server.js`, port 3001) with a browser UI for OAuth login and manual API testing

Both share the same `instances.json` auth store via `sn-auth.js`, so they work off the same login session.

## File Map

```
src/sn-auth.js      — shared OAuth token management (CJS)
src/sn-client.js    — shared ServiceNow API operations (CJS)
src/cli.mjs         — simon CLI binary (ESM, imports CJS via createRequire)
src/server.js       — Express server + web UI
.mcp.json           — Claude Code MCP registration (empty — no custom MCP server)
```
