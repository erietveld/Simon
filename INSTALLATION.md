# Simon — Installation Guide

Concise install steps. Intended to be followed by Claude on a fresh machine. Detect platform (macOS / Linux / Windows) and adapt commands accordingly.

## Prerequisites to install

| Software | Purpose |
|----------|---------|
| Visual Studio Code | Editor + Claude Code host |
| Git | Clone the repo |
| Node.js 20.12+ (includes npm) | Run the Simon server and CLI |
| Claude Code extension | Drives Simon from inside VS Code |

## Step 1 — Install Visual Studio Code

- macOS: `brew install --cask visual-studio-code`
- Linux: download `.deb`/`.rpm` from https://code.visualstudio.com or use the distro package manager
- Windows: `winget install Microsoft.VisualStudioCode`

Verify: `code --version`

## Step 2 — Install Git

- macOS: `brew install git` (or use Xcode CLT: `xcode-select --install`)
- Linux: `sudo apt install git` / `sudo dnf install git`
- Windows: `winget install Git.Git`

Verify: `git --version`

## Step 3 — Clone the repo

```bash
git clone https://github.com/erietveld/Simon
cd Simon
```

Open in VS Code: `code .`

## Step 4 — Install the Claude Code extension

In VS Code: Extensions panel → search "Claude Code" (publisher: Anthropic) → Install. Sign in with the user's Anthropic / enterprise account when prompted.

CLI alternative: `code --install-extension anthropic.claude-code`

## Step 5 — Install Node.js (20.12+)

- macOS: `brew install node`
- Linux: use [nvm](https://github.com/nvm-sh/nvm) or distro packages — must be 20.12 or newer
- Windows: `winget install OpenJS.NodeJS`

Verify: `node --version` (≥ v20.12) and `npm --version`

## Step 6 — Install Simon and start the server

From the repo root:

```bash
npm install
npm link        # registers the global `simon` command
npm start       # starts the web UI on http://localhost:3001
```

Keep the `npm start` terminal open while using Simon.

## Step 7 — Register a ServiceNow instance

Open http://localhost:3001 → **Instances** tab → **Add Instance**.

- **OAuth 2.0** (recommended): instance URL + client ID + client secret. Requires an OAuth provider configured on the ServiceNow instance.
- **Basic auth**: instance URL + username + password.

Credentials are written to `instances.json` (gitignored).

## Step 8 — Verify

```bash
simon instances
```

Should list the registered instance(s). If the command is not found, re-run `npm link` from the repo root.

## Troubleshooting

- **`simon: command not found`** — run `npm link` from the Simon repo root.
- **Port 3001 in use** — another `npm start` is running, or change `PORT` in a `.env` file at the repo root.
- **Auth failures** — re-test from the web UI; for OAuth, confirm the provider is active on the instance.
