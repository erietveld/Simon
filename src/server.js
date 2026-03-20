const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const auth = require('./sn-auth');
const snClient = require('./sn-client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3001;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;

// Encode OAuth state = base64(JSON) so we can carry instanceId through the callback
function encodeState(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}
function decodeState(state) {
  try { return JSON.parse(Buffer.from(state, 'base64url').toString()); } catch { return null; }
}

// --- OAuth Authorization Code routes ---

// Step 1: Redirect user to ServiceNow login
// Query param: ?instanceId=<id>  (defaults to active instance)
app.get('/auth/login', (req, res) => {
  const inst = req.query.instanceId
    ? auth.getInstance(req.query.instanceId)
    : auth.getActiveInstance();

  if (!inst) return res.send('<h2>Instance not found</h2><a href="/">Back</a>');
  if (inst.authType !== 'oauth') return res.redirect('/');

  snClient.resetSnSession(inst.id);

  const state = encodeState({ nonce: crypto.randomBytes(12).toString('hex'), instanceId: inst.id });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: inst.clientId,
    redirect_uri: REDIRECT_URI,
    scope: 'useraccount',
    state,
  });

  const authUrl = `${inst.url}/oauth_auth.do?${params.toString()}`;
  console.log(`[OAuth:${inst.id}] Redirecting to: ${inst.url}/oauth_auth.do`);
  res.redirect(authUrl);
});

// Step 2: Handle callback with authorization code
app.get('/auth/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.send(`<h2>OAuth Error</h2><p>${error}</p><a href="/">Back</a>`);
  }

  const stateData = decodeState(state || '');
  const inst = stateData?.instanceId
    ? auth.getInstance(stateData.instanceId)
    : auth.getActiveInstance();

  if (!inst) {
    return res.send('<h2>Unknown instance in OAuth callback</h2><a href="/">Back</a>');
  }

  if (!code) {
    return res.send('<h2>No authorization code received</h2><a href="/">Back</a>');
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: inst.clientId,
      client_secret: inst.clientSecret,
      redirect_uri: REDIRECT_URI,
    });

    console.log(`[OAuth:${inst.id}] Exchanging code for token...`);
    const tokenRes = await fetch(`${inst.url}/oauth_token.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await tokenRes.json();

    if (data.error) {
      console.error(`[OAuth:${inst.id}] Token exchange error:`, data);
      return res.send(`<h2>Token Error</h2><pre>${JSON.stringify(data, null, 2)}</pre><a href="/">Back</a>`);
    }

    auth.saveInstanceSession(inst.id, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiry: Date.now() + data.expires_in * 1000,
    });

    console.log(`[OAuth:${inst.id}] Logged in! Token expires in ${data.expires_in}s`);
    res.redirect('/');
  } catch (err) {
    console.error(`[OAuth:${inst.id}] Callback error:`, err);
    res.send(`<h2>Error</h2><pre>${err.message}</pre><a href="/">Back</a>`);
  }
});

// Logout — ?instanceId=<id> (defaults to active instance)
app.get('/auth/logout', (req, res) => {
  const inst = req.query.instanceId
    ? auth.getInstance(req.query.instanceId)
    : auth.getActiveInstance();

  if (inst) {
    auth.saveInstanceSession(inst.id, { accessToken: null, refreshToken: null, tokenExpiry: 0 });
    snClient.resetSnSession(inst.id);
    console.log(`[OAuth:${inst.id}] Logged out`);
  }
  res.redirect('/');
});

// --- Instance management API ---

// GET /api/instances — list all instances (strip client secrets from response)
app.get('/api/instances', (req, res) => {
  const data = auth.getInstances();
  const safe = data.instances.map(inst => ({
    id: inst.id,
    name: inst.name,
    url: inst.url,
    authType: inst.authType,
    loggedIn: auth.isLoggedIn(inst),
    isActive: inst.id === data.activeInstanceId,
    // Include non-secret fields needed by the UI
    username: inst.username || null,
    clientId: inst.clientId || null,
    // Session expiry info for OAuth
    tokenExpiry: inst.session?.tokenExpiry || null,
  }));
  res.json({ activeInstanceId: data.activeInstanceId, instances: safe });
});

function normalizeUrl(url) {
  if (!url) return url;
  let u = url.trim().replace(/\/+$/, '');
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
  return u;
}

// POST /api/instances — add a new instance
app.post('/api/instances', (req, res) => {
  const { name, authType, clientId, clientSecret, username, password } = req.body;
  const url = normalizeUrl(req.body.url);

  if (!url) return res.status(400).json({ error: 'url is required' });
  if (!authType || !['oauth', 'basic'].includes(authType)) {
    return res.status(400).json({ error: 'authType must be "oauth" or "basic"' });
  }
  if (authType === 'oauth' && (!clientId || !clientSecret)) {
    return res.status(400).json({ error: 'clientId and clientSecret are required for OAuth' });
  }

  const inst = auth.addInstance({ name, url, authType, clientId, clientSecret, username, password });
  console.log(`[Instances] Added: ${inst.name} (${inst.url})`);
  res.json({ id: inst.id, name: inst.name, url: inst.url, authType: inst.authType });
});

// PUT /api/instances/:id — update instance settings
app.put('/api/instances/:id', (req, res) => {
  const { name, url, authType, clientId, clientSecret, username, password } = req.body;
  const changes = {};
  if (name !== undefined) changes.name = name;
  if (url !== undefined) changes.url = normalizeUrl(url);
  if (authType !== undefined) changes.authType = authType;
  if (clientId !== undefined) changes.clientId = clientId;
  if (clientSecret !== undefined) changes.clientSecret = clientSecret;
  if (username !== undefined) changes.username = username;
  if (password !== undefined) changes.password = password;

  const updated = auth.updateInstance(req.params.id, changes);
  if (!updated) return res.status(404).json({ error: 'Instance not found' });

  // Reset web session when credentials change
  snClient.resetSnSession(req.params.id);
  console.log(`[Instances] Updated: ${updated.name}`);
  res.json({ ok: true });
});

// DELETE /api/instances/:id — remove an instance
app.delete('/api/instances/:id', ({ params }, res) => {
  const inst = auth.getInstance(params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  auth.deleteInstance(params.id);
  snClient.resetSnSession(params.id);
  console.log(`[Instances] Deleted: ${inst.name}`);
  res.json({ ok: true });
});

// POST /api/instances/:id/activate — set as active instance
app.post('/api/instances/:id/activate', (req, res) => {
  if (!auth.setActiveInstance(req.params.id)) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  const inst = auth.getInstance(req.params.id);
  console.log(`[Instances] Activated: ${inst.name}`);
  res.json({ ok: true });
});

// --- API: get current config + auth status ---
app.get('/api/config', async (req, res) => {
  const info = await snClient.getInstanceInfo();
  res.json(info);
});

// --- API: debug session state ---
app.get('/api/debug/session', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const inst = auth.getActiveInstance();
    const session = await snClient.getSnSession(forceRefresh, inst);
    res.json({
      instanceId: inst?.id,
      hasCookies: !!session.cookies,
      cookieNames: session.cookieNames || [],
      hasCsrf: !!session.csrfToken,
      csrfPreview: session.csrfToken ? session.csrfToken.substring(0, 30) + '...' : null,
      expiry: new Date(session.expiry).toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: fetch ScriptInclude source code for debugging ---
app.get('/api/scriptinclude-info/:name', async (req, res) => {
  try {
    const data = await snClient.getScriptIncludeInfo(req.params.name);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: call a ScriptInclude via GlideAjax (xmlhttp.do) ---
app.post('/api/scriptinclude', async (req, res) => {
  const { scriptInclude, method, params } = req.body;

  if (!scriptInclude || !method) {
    return res.status(400).json({ error: 'scriptInclude and method are required' });
  }

  try {
    const result = await snClient.callScriptInclude({ scriptInclude, method, params });
    res.json(result);
  } catch (err) {
    console.error('[SN Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// --- API: fetch table structure and relationships ---
app.get('/api/table-structure/:tableName', async (req, res) => {
  try {
    const result = await snClient.getTableStructure(req.params.tableName);
    res.json(result);
  } catch (err) {
    console.error('[Table Structure Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// --- API: call ServiceNow REST Table API ---
app.post('/api/rest', async (req, res) => {
  const { path: apiPath, method: httpMethod = 'GET', body: reqBody } = req.body;

  if (!apiPath) {
    return res.status(400).json({ error: 'path is required' });
  }

  try {
    const result = await snClient.restApiCall({ apiPath, httpMethod, body: reqBody });
    res.json({ status: result.status, contentType: result.contentType, body: result.data, url: result.url });
  } catch (err) {
    console.error('[SN REST Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// --- File-backed log store (max 500 entries, newest first) ---
const MAX_LOGS = 500;
const LOGS_FILE = path.join(__dirname, '..', 'logs.json');

function loadLogsFromDisk() {
  try {
    return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveLogsToDisk(logs) {
  fs.writeFile(LOGS_FILE, JSON.stringify(logs), () => {}); // async, fire-and-forget
}

const logStore = loadLogsFromDisk();

app.get('/api/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  res.json({ logs: logStore.slice(0, limit) });
});

app.post('/api/logs', (req, res) => {
  const entry = req.body;
  if (!entry || !entry.tool) return res.status(400).json({ error: 'tool is required' });
  logStore.unshift({ id: Date.now() + Math.random(), ...entry });
  if (logStore.length > MAX_LOGS) logStore.length = MAX_LOGS;
  saveLogsToDisk(logStore);
  res.json({ ok: true });
});

app.delete('/api/logs', (req, res) => {
  logStore.length = 0;
  saveLogsToDisk(logStore);
  res.json({ ok: true });
});

// --- Start ---
app.listen(PORT, () => {
  const active = auth.getActiveInstance();
  console.log(`\nSIMON running at http://localhost:${PORT}`);
  if (active) {
    console.log(`Active instance: ${active.name} (${active.url})`);
    console.log(`Auth method:     ${active.authType}`);
  } else {
    console.log('No instance configured — open http://localhost:' + PORT + ' to add one');
  }
});
