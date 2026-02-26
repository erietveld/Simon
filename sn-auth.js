const fs = require('fs');
const path = require('path');

const INSTANCES_FILE = path.join(__dirname, 'instances.json');

function generateId() {
  return 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// --- Persistence ---

function loadData() {
  try {
    if (fs.existsSync(INSTANCES_FILE)) {
      return JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Auth] Failed to load instances.json:', err.message);
  }
  return { activeInstanceId: null, instances: [] };
}

function saveData(data) {
  try {
    fs.writeFileSync(INSTANCES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Auth] Failed to save instances.json:', err.message);
  }
}

// --- Instance management ---

function getInstances() {
  return loadData();
}

function getActiveInstance() {
  const data = loadData();
  return data.instances.find(i => i.id === data.activeInstanceId)
    || data.instances[0]
    || null;
}

function getInstance(id) {
  return loadData().instances.find(i => i.id === id) || null;
}

function addInstance(cfg) {
  const data = loadData();
  const id = generateId();
  const inst = {
    id,
    name: cfg.name || 'New Instance',
    url: (cfg.url || '').replace(/\/+$/, ''),
    authType: cfg.authType,
  };

  if (cfg.authType === 'oauth') {
    inst.clientId = cfg.clientId || '';
    inst.clientSecret = cfg.clientSecret || '';
    inst.session = { accessToken: null, refreshToken: null, tokenExpiry: 0 };
  } else {
    inst.username = cfg.username || '';
    inst.password = cfg.password || '';
  }

  data.instances.push(inst);
  if (!data.activeInstanceId) data.activeInstanceId = id;
  saveData(data);
  return inst;
}

function updateInstance(id, changes) {
  const data = loadData();
  const idx = data.instances.findIndex(i => i.id === id);
  if (idx === -1) return null;

  // Never overwrite session or id via update
  const { session, id: _id, ...safe } = changes;
  if (safe.url) safe.url = safe.url.replace(/\/+$/, '');
  data.instances[idx] = { ...data.instances[idx], ...safe };
  saveData(data);
  return data.instances[idx];
}

function deleteInstance(id) {
  const data = loadData();
  data.instances = data.instances.filter(i => i.id !== id);
  if (data.activeInstanceId === id) {
    data.activeInstanceId = data.instances[0]?.id || null;
  }
  saveData(data);
  return true;
}

function setActiveInstance(id) {
  const data = loadData();
  if (!data.instances.find(i => i.id === id)) return false;
  data.activeInstanceId = id;
  saveData(data);
  return true;
}

function saveInstanceSession(id, session) {
  const data = loadData();
  const idx = data.instances.findIndex(i => i.id === id);
  if (idx === -1) return;
  data.instances[idx].session = session;
  saveData(data);
}

// --- Auth helpers ---

function isLoggedIn(inst) {
  if (!inst) return false;
  if (inst.authType !== 'oauth') return !!(inst.username);
  const s = inst.session || {};
  return !!(s.accessToken && Date.now() < s.tokenExpiry) || !!(s.refreshToken);
}

function useOAuth(inst) {
  return inst?.authType === 'oauth';
}

function getBasicAuthHeader(inst) {
  return 'Basic ' + Buffer.from(`${inst.username}:${inst.password}`).toString('base64');
}

async function refreshAccessToken(inst) {
  const s = inst.session || {};
  if (!s.refreshToken) return null;

  console.log(`[OAuth:${inst.id}] Refreshing access token...`);
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: inst.clientId,
    client_secret: inst.clientSecret,
    refresh_token: s.refreshToken,
  });

  const res = await fetch(`${inst.url}/oauth_token.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    console.error(`[OAuth:${inst.id}] Refresh failed:`, res.status);
    saveInstanceSession(inst.id, { accessToken: null, refreshToken: null, tokenExpiry: 0 });
    return null;
  }

  const data = await res.json();
  if (data.error) {
    console.error(`[OAuth:${inst.id}] Refresh error:`, data.error);
    saveInstanceSession(inst.id, { accessToken: null, refreshToken: null, tokenExpiry: 0 });
    return null;
  }

  const newSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || s.refreshToken,
    tokenExpiry: Date.now() + data.expires_in * 1000,
  };
  saveInstanceSession(inst.id, newSession);
  console.log(`[OAuth:${inst.id}] Token refreshed`);
  return { ...inst, session: newSession };
}

async function getAuthHeader(inst) {
  if (!inst) {
    inst = getActiveInstance();
    if (!inst) throw new Error('No ServiceNow instance configured. Add one via http://localhost:3001');
  }

  if (inst.authType !== 'oauth') return getBasicAuthHeader(inst);

  // Re-read from disk to get latest session (MCP and Express may run in different processes)
  const fresh = getInstance(inst.id);
  if (fresh) inst = fresh;

  const session = inst.session || {};
  if (Date.now() >= (session.tokenExpiry || 0) - 30000) {
    const refreshed = await refreshAccessToken(inst);
    if (!refreshed) {
      throw new Error(`Not logged in to ${inst.url}. Please authenticate via http://localhost:3001`);
    }
    return `Bearer ${refreshed.session.accessToken}`;
  }

  return `Bearer ${session.accessToken}`;
}

module.exports = {
  getInstances,
  getActiveInstance,
  getInstance,
  addInstance,
  updateInstance,
  deleteInstance,
  setActiveInstance,
  saveInstanceSession,
  isLoggedIn,
  useOAuth,
  getAuthHeader,
};
