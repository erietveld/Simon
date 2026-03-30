# Simon — Installation Guide

This guide walks you through installing Simon from scratch, step by step. No prior experience with Git, terminals, or developer tools is assumed.

**Time required:** approximately 20–30 minutes.

---

## What you will install

| Software | Purpose |
|----------|---------|
| **Visual Studio Code** | Code editor — also where you will chat with Claude |
| **Claude Code extension** | Brings Claude AI directly into VS Code |
| **Git** | Downloads Simon from GitHub (and keeps it up to date) |
| **Node.js + npm** | Runs the Simon server locally — npm is included with Node.js |
| **Simon** | The tool itself — connects Claude to your ServiceNow instance |

---

## Step 1 — Install Visual Studio Code

VS Code is the application you will use to run Simon and talk to Claude.

### Windows
1. Go to [https://code.visualstudio.com](https://code.visualstudio.com)
2. Click **Download for Windows**
3. Run the downloaded `.exe` installer
4. Accept all default options — on the *Select Additional Tasks* screen, tick **Add to PATH** if it is offered
5. Click **Install**, then **Finish**

### Mac
1. Go to [https://code.visualstudio.com](https://code.visualstudio.com)
2. Click **Download for Mac**
3. Open the downloaded `.zip` — this creates a **Visual Studio Code** app
4. Drag **Visual Studio Code** into your **Applications** folder
5. Open it from Applications (right-click → Open the first time if macOS warns about an unidentified developer)

---

## Step 2 — Install Git

Git is required to download Simon. Check whether it is already installed first:

1. In VS Code, open a terminal: menu **Terminal → New Terminal**
2. Run: `git --version`
3. If you see a version number (e.g. `git version 2.43.0`), Git is installed — skip to Step 3.

If Git is not installed:

### Windows
1. Go to [https://git-scm.com/download/win](https://git-scm.com/download/win) — the download starts automatically
2. Run the installer and accept all default options
3. Close and reopen the VS Code terminal, then run `git --version` to confirm

### Mac
1. Run `git --version` in the terminal — macOS will offer to install the **Xcode Command Line Tools** automatically
2. Click **Install** in the dialog that appears and wait for it to finish
3. Run `git --version` again to confirm

---

## Step 3 — Get the Simon code

You will download a copy of Simon directly inside VS Code — no GitHub account required.

1. Open **Visual Studio Code**
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac) to open the Command Palette
3. Type `clone` and select **Git: Clone**
4. Paste this URL and press Enter:
   ```
   https://github.com/erietveld/Simon
   ```
5. VS Code will ask where to save the folder — choose a location you can find easily (e.g. your Desktop or Documents)
6. When asked *"Would you like to open the cloned repository?"*, click **Open**

You should now see the Simon project files in the left-hand panel.

---

## Step 4 — Install the Claude Code extension

1. Click the **Extensions** icon in the left sidebar (it looks like four squares)
2. In the search box, type `Claude Code`
3. Find the extension published by **Anthropic** and click **Install**
4. Once installed, a Claude icon will appear in the left sidebar

### Sign in with your enterprise account

1. Click the **Claude** icon in the left sidebar
2. Click **Sign in** — you will be taken to a browser page
3. Sign in using your **enterprise email address** (the same account you use for Claude normally)
4. Return to VS Code — you should see a chat panel where you can type to Claude

---

## Step 5 — Install Node.js

Node.js is the engine that runs the Simon server. **npm** (used in Step 6) is included with Node.js — you do not need to install it separately.

First, check if Node.js is already installed:

1. Open a terminal in VS Code (**Terminal → New Terminal**)
2. Run: `node --version`
3. If you see `v20` or higher, you're done — skip to Step 6.

If Node.js is not installed:

### Windows
1. Go to [https://nodejs.org](https://nodejs.org) and click **Download Node.js (LTS)**
2. Run the installer and accept all defaults
3. Close and reopen the terminal, then run `node --version` to confirm

### Mac
1. Go to [https://nodejs.org](https://nodejs.org) and click **Download Node.js (LTS)**
2. Run the `.pkg` installer and follow the prompts
3. Close and reopen the terminal, then run `node --version` to confirm

> **Alternatively,** now that Claude is available you can ask it: *"I need to install Node.js version 20 or higher on my [Windows / Mac] computer. Please give me step-by-step instructions and confirm it installed correctly."*

---

## Step 6 — Start the Simon server

1. In VS Code, open a terminal: menu **Terminal → New Terminal** (or press `` Ctrl+` `` on Windows, `` Cmd+` `` on Mac)
2. Make sure the terminal shows the Simon folder path (e.g. `C:\Users\you\Documents\Simon` or `~/Documents/Simon`). If it does not, something went wrong in Step 3 — ask Claude for help.
3. Run this command to install Simon's dependencies:
   ```
   npm install
   ```
   Wait for it to finish — you will see a lot of text scroll by, ending with something like `added 80 packages`.
4. Start the Simon server:
   ```
   npm start
   ```
   You should see: `Simon server running on http://localhost:3001`

5. Open [http://localhost:3001](http://localhost:3001) in your browser — you should see the Simon web interface.

> **Keep this terminal open.** The server runs as long as the terminal is open. If you close it, the server stops.

---

## Step 7 — Add your ServiceNow instance

1. In the Simon web interface at [http://localhost:3001](http://localhost:3001), go to the **Instances** tab
2. Click **Add Instance**
3. Fill in:
   - **Name** — a short label for your reference (e.g. `prod` or `dev`)
   - **Instance URL** — e.g. `https://yourcompany.service-now.com`
   - **Auth method** — choose one:
     - **OAuth 2.0** *(recommended)* — enter a Client ID and Client Secret. More secure and does not expose your password. Requires an OAuth provider to be configured on your ServiceNow instance — ask your instance admin if you are unsure.
     - **Basic auth** — enter your ServiceNow username and password. Simpler to set up, but less secure than OAuth.
4. Click **Save** and then **Test connection** to confirm it works

> Your credentials are stored only on your own computer in a file called `instances.json`. They are never sent anywhere other than directly to your ServiceNow instance.

---

## Step 8 — Reload VS Code so Claude can see Simon's tools

> **This step is easy to miss and will cause confusion if skipped.**

Simon includes an MCP server that gives Claude direct access to ServiceNow. Claude Code only picks up this server when VS Code is reloaded after the project is first opened.

1. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
2. Type `reload window` and select **Developer: Reload Window**
3. VS Code will briefly go blank and reload — this is normal
4. Wait a few seconds for everything to start up again

### Verify that the tools are active

1. Open the Claude chat panel
2. Start a new conversation and send this message:
   ```
   What ServiceNow tools do you have available?
   ```
3. Claude should respond listing tools such as `sn_query`, `sn_get_record`, `sn_instance_info`, etc.

If Claude says it has no ServiceNow tools, see [Troubleshooting](#troubleshooting) below.

---

## Step 9 — Try it out

Make sure the Simon server is still running (the terminal from Step 6 should still be open). Then open a Claude chat and try these prompts:

**Prompt 1 — Check what's on your plate:**
```
Using my ServiceNow instance, show me the 10 most recently updated incidents that are assigned to me or my group. Include the number, short description, state, and assigned to.
```

**Prompt 2 — Explore a table:**
```
Using my ServiceNow instance, show me the 5 change requests that were most recently moved to the Implement state. For each one, include the change number, short description, assigned to, and planned start date.
```

---

## Everyday use

Once installed, your daily routine is:

1. Open VS Code (Simon project is already there)
2. Open a terminal and run `npm start`
3. Chat with Claude — Simon's ServiceNow tools are ready

---

## Troubleshooting

### Git is not installed
Follow the instructions in Step 2 to install Git for your platform, then return to Step 3 to clone Simon.

### `npm`: command not found
npm is included with Node.js — if npm is missing, Node.js is not installed or not on your PATH. Follow the instructions in Step 5 to install Node.js, then reopen the terminal and try again.

### `node`: command not found
Node.js is not installed. Follow the instructions in Step 5.

### `npm start` fails with "address already in use"
Port 3001 is already in use (possibly an earlier Simon session). Either close the other terminal running Simon, or ask Claude: *"Port 3001 is in use on my computer — how do I find and stop the process using it?"*

### Claude does not see any ServiceNow tools after reload
Check the following:
- The Simon server (`npm start`) is running in a terminal
- You opened VS Code **from the Simon project folder** (check the title bar shows the Simon folder)
- You reloaded the window (Step 8) after opening the project — if not, do it now
- Try reloading the window once more: `Ctrl+Shift+P` → **Developer: Reload Window**

If still not working, ask Claude: *"My Simon MCP server is not loading. The project is at [folder path]. Can you help me diagnose why Claude Code is not picking up the MCP tools from .mcp.json?"*

### Claude keeps asking for instance credentials
You need to add your instance in the Simon web UI first — see Step 7. The web server must also be running (`npm start`).

### Need to restart from scratch
If something went badly wrong, delete the Simon folder, go back to Step 3, and clone it again. Your `instances.json` will be lost (you will need to re-add your instance), but nothing else is affected.
