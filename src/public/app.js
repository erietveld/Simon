// --- Tabs ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'instances') loadInstances();
  });
});

// --- Load config + auth status ---
function loadConfig() {
  fetch('/api/config')
    .then(r => r.json())
    .then(cfg => {
      const info = document.getElementById('connection-info');
      const actions = document.getElementById('auth-actions');

      if (cfg.authMethod === 'oauth') {
        if (cfg.loggedIn) {
          info.innerHTML = `<span class="instance">${cfg.instance}</span> &middot; <span class="auth">OAuth</span>`;
          actions.innerHTML = '<a href="/auth/logout" class="auth-btn logout">Logout</a>';
        } else {
          info.innerHTML = `<span class="instance">${cfg.instance}</span> &middot; <span class="not-logged-in">Not logged in</span>`;
          actions.innerHTML = '<a href="/auth/login" class="auth-btn login">Login with ServiceNow</a>';
        }
      } else if (cfg.authMethod === 'basic') {
        info.innerHTML = `<span class="instance">${cfg.instance}</span> &middot; <span class="auth">Basic Auth</span> &middot; ${cfg.user}`;
        actions.innerHTML = '';
      } else {
        info.innerHTML = '<span style="color:#f85149">No instance configured</span>';
        actions.innerHTML = '';
      }
    })
    .catch(() => {
      document.getElementById('connection-info').textContent = 'Could not load config';
    });
}
loadConfig();

// --- Instances Tab ---

let editingInstanceId = null;
let selectedAuthType = 'oauth';

async function loadInstances() {
  const listEl = document.getElementById('instance-list');
  listEl.innerHTML = '<div style="color:#8b949e;font-size:13px">Loading...</div>';

  try {
    const res = await fetch('/api/instances');
    const data = await res.json();

    if (!data.instances || data.instances.length === 0) {
      listEl.innerHTML = '<div style="color:#8b949e;font-size:13px">No instances configured. Click "+ Add Instance" to get started.</div>';
      return;
    }

    listEl.innerHTML = data.instances.map(inst => renderInstanceCard(inst)).join('');
  } catch (err) {
    listEl.innerHTML = `<div style="color:#f85149;font-size:13px">Error loading instances: ${err.message}</div>`;
  }
}

function renderInstanceCard(inst) {
  const authTag = inst.authType === 'oauth'
    ? '<span class="tag oauth">OAuth</span>'
    : '<span class="tag basic">Basic Auth</span>';

  const loginTag = inst.loggedIn
    ? '<span class="tag logged-in">Logged in</span>'
    : (inst.authType === 'oauth' ? '<span class="tag logged-out">Not logged in</span>' : '');

  const activeClass = inst.isActive ? ' active-instance' : '';
  const activeBadge = inst.isActive ? '<span class="active-badge">ACTIVE</span>' : '';

  const loginBtn = inst.authType === 'oauth'
    ? (inst.loggedIn
        ? `<a href="/auth/logout?instanceId=${inst.id}" class="auth-btn logout" style="font-size:12px;padding:5px 12px;">Logout</a>`
        : `<a href="/auth/login?instanceId=${inst.id}" class="auth-btn login" style="font-size:12px;padding:5px 12px;">Login</a>`)
    : '';

  const activateBtn = inst.isActive
    ? ''
    : `<button class="secondary" onclick="activateInstance('${inst.id}')" style="font-size:12px;padding:5px 12px;">Set Active</button>`;

  return `
    <div class="instance-card${activeClass}" id="inst-card-${inst.id}">
      <div class="instance-info">
        <div class="instance-name">${escHtml(inst.name)} ${activeBadge}</div>
        <div class="instance-url">${escHtml(inst.url)}</div>
        <div class="instance-meta">${authTag} ${loginTag}</div>
      </div>
      <div class="instance-actions">
        ${loginBtn}
        ${activateBtn}
        <button class="secondary" onclick="showEditInstance('${inst.id}')" style="font-size:12px;padding:5px 12px;">Edit</button>
        <button class="danger" onclick="deleteInstance('${inst.id}', '${escHtml(inst.name)}')" style="font-size:12px;padding:5px 12px;">Delete</button>
      </div>
    </div>`;
}

async function activateInstance(id) {
  await fetch(`/api/instances/${id}/activate`, { method: 'POST' });
  loadInstances();
  loadConfig();
}

async function deleteInstance(id, name) {
  if (!confirm(`Delete instance "${name}"? This cannot be undone.`)) return;
  await fetch(`/api/instances/${id}`, { method: 'DELETE' });
  loadInstances();
  loadConfig();
}

// --- Modal ---

function selectAuthType(type) {
  selectedAuthType = type;
  document.getElementById('auth-btn-oauth').classList.toggle('selected', type === 'oauth');
  document.getElementById('auth-btn-basic').classList.toggle('selected', type === 'basic');
  document.getElementById('oauth-fields').classList.toggle('hidden', type !== 'oauth');
  document.getElementById('basic-fields').classList.toggle('hidden', type !== 'basic');
}

function showAddInstance() {
  editingInstanceId = null;
  document.getElementById('modal-title').textContent = 'Add Instance';
  document.getElementById('modal-save-btn').textContent = 'Add Instance';
  document.getElementById('inst-name').value = '';
  document.getElementById('inst-url').value = '';
  document.getElementById('inst-client-id').value = '';
  document.getElementById('inst-client-secret').value = '';
  document.getElementById('inst-username').value = '';
  document.getElementById('inst-password').value = '';
  selectAuthType('oauth');
  updateOAuthSetupLink();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('inst-name').focus();
}

async function showEditInstance(id) {
  const res = await fetch('/api/instances');
  const data = await res.json();
  const inst = data.instances.find(i => i.id === id);
  if (!inst) return;

  editingInstanceId = id;
  document.getElementById('modal-title').textContent = 'Edit Instance';
  document.getElementById('modal-save-btn').textContent = 'Save Changes';
  document.getElementById('inst-name').value = inst.name;
  document.getElementById('inst-url').value = inst.url;
  document.getElementById('inst-client-id').value = inst.clientId || '';
  document.getElementById('inst-client-secret').value = ''; // don't prefill secret
  document.getElementById('inst-username').value = inst.username || '';
  document.getElementById('inst-password').value = ''; // don't prefill password
  selectAuthType(inst.authType);
  updateOAuthSetupLink();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('inst-name').focus();
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

async function saveInstance() {
  const name = document.getElementById('inst-name').value.trim();
  const url = document.getElementById('inst-url').value.trim();
  const authType = selectedAuthType;
  const clientId = document.getElementById('inst-client-id').value.trim();
  const clientSecret = document.getElementById('inst-client-secret').value.trim();
  const username = document.getElementById('inst-username').value.trim();
  const password = document.getElementById('inst-password').value;

  if (!name) { alert('Name is required'); return; }
  if (!url) { alert('Instance URL is required'); return; }
  if (authType === 'oauth' && !clientId) { alert('OAuth Client ID is required'); return; }
  if (!editingInstanceId && authType === 'oauth' && !clientSecret) {
    alert('OAuth Client Secret is required'); return;
  }
  if (!editingInstanceId && authType === 'basic' && !username) {
    alert('Username is required'); return;
  }

  const body = { name, url, authType };
  if (authType === 'oauth') {
    body.clientId = clientId;
    if (clientSecret) body.clientSecret = clientSecret;
  } else {
    body.username = username;
    if (password) body.password = password;
  }

  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.disabled = true;

  try {
    let res;
    if (editingInstanceId) {
      res = await fetch(`/api/instances/${editingInstanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    const data = await res.json();
    if (!res.ok) { alert('Error: ' + (data.error || res.status)); return; }

    hideModal();
    loadInstances();
    loadConfig();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    saveBtn.disabled = false;
  }
}

// Load instances when the tab is active on page load (if it's the default)
if (document.querySelector('.tab[data-tab="instances"]').classList.contains('active')) {
  loadInstances();
}

// --- Params ---
function addParam(name = '', value = '') {
  const tbody = document.querySelector('#si-params tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="sysparm_..." value="${name}" class="param-name"></td>
    <td><input type="text" placeholder="value" value="${value}" class="param-value"></td>
    <td><button class="remove-param" onclick="this.closest('tr').remove()">&times;</button></td>
  `;
  tbody.appendChild(tr);
}

function getParams() {
  const params = {};
  document.querySelectorAll('#si-params tbody tr').forEach(tr => {
    const name = tr.querySelector('.param-name').value.trim();
    const value = tr.querySelector('.param-value').value.trim();
    if (name) params[name] = value;
  });
  return params;
}

// --- ScriptInclude call ---
async function runScriptInclude() {
  const scriptInclude = document.getElementById('si-name').value.trim();
  const method = document.getElementById('si-method').value.trim();
  const params = getParams();

  if (!scriptInclude || !method) return alert('ScriptInclude name and method are required');

  const btn = document.getElementById('si-run');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running...';

  const respCard = document.getElementById('si-response');
  respCard.classList.remove('hidden');
  document.getElementById('si-status').innerHTML = '<span class="status-badge pending">Pending</span>';
  document.getElementById('si-body').textContent = 'Waiting for response...';
  document.getElementById('si-url').textContent = '';

  try {
    const res = await fetch('/api/scriptinclude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptInclude, method, params }),
    });

    const data = await res.json();

    if (data.error) {
      document.getElementById('si-status').innerHTML = '<span class="status-badge error">Error</span>';
      document.getElementById('si-body').textContent = data.error;
    } else {
      const ok = data.status >= 200 && data.status < 300;
      document.getElementById('si-status').innerHTML =
        `<span class="status-badge ${ok ? 'ok' : 'error'}">${data.status}</span>`;
      document.getElementById('si-url').textContent = data.url;
      document.getElementById('si-body').textContent = formatBody(data.body, data.contentType);
    }
  } catch (err) {
    document.getElementById('si-status').innerHTML = '<span class="status-badge error">Error</span>';
    document.getElementById('si-body').textContent = err.message;
  }

  btn.disabled = false;
  btn.textContent = 'Run';
}

function runQuickTest(name, method) {
  document.getElementById('si-name').value = name;
  document.getElementById('si-method').value = method;
  document.querySelector('#si-params tbody').innerHTML = '';
  runScriptInclude();
}

// --- REST call ---
async function runRest() {
  const apiPath = document.getElementById('rest-path').value.trim();
  const httpMethod = document.getElementById('rest-method').value;
  const bodyStr = document.getElementById('rest-body').value.trim();

  if (!apiPath) return alert('Path is required');

  const btn = document.getElementById('rest-run');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running...';

  const respCard = document.getElementById('rest-response');
  respCard.classList.remove('hidden');
  document.getElementById('rest-status').innerHTML = '<span class="status-badge pending">Pending</span>';
  document.getElementById('rest-body-out').textContent = 'Waiting for response...';
  document.getElementById('rest-url').textContent = '';

  let body = null;
  if (bodyStr && httpMethod !== 'GET') {
    try { body = JSON.parse(bodyStr); }
    catch { return alert('Invalid JSON in request body'); }
  }

  try {
    const res = await fetch('/api/rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: apiPath, method: httpMethod, body }),
    });

    const data = await res.json();

    if (data.error) {
      document.getElementById('rest-status').innerHTML = '<span class="status-badge error">Error</span>';
      document.getElementById('rest-body-out').textContent = data.error;
    } else {
      const ok = data.status >= 200 && data.status < 300;
      document.getElementById('rest-status').innerHTML =
        `<span class="status-badge ${ok ? 'ok' : 'error'}">${data.status}</span>`;
      document.getElementById('rest-url').textContent = data.url;
      const display = typeof data.body === 'object' ? JSON.stringify(data.body, null, 2) : data.body;
      document.getElementById('rest-body-out').textContent = display;
    }
  } catch (err) {
    document.getElementById('rest-status').innerHTML = '<span class="status-badge error">Error</span>';
    document.getElementById('rest-body-out').textContent = err.message;
  }

  btn.disabled = false;
  btn.textContent = 'Run';
}

function runQuickRest(method, path) {
  document.getElementById('rest-method').value = method;
  document.getElementById('rest-path').value = path;
  document.getElementById('rest-body').value = '';
  runRest();
}

// --- Debug ---
async function loadSessionInfo(forceRefresh = false) {
  const el = document.getElementById('debug-session');
  el.textContent = 'Loading...';
  try {
    const res = await fetch(`/api/debug/session?refresh=${forceRefresh}`);
    const data = await res.json();
    el.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    el.textContent = 'Error: ' + err.message;
  }
}

async function loadScriptInfo() {
  const name = document.getElementById('debug-si-name').value.trim();
  if (!name) return alert('Enter a ScriptInclude name');

  const bodyEl = document.getElementById('debug-si-body');
  const statusEl = document.getElementById('debug-si-status');
  const metaEl = document.getElementById('debug-si-meta');

  bodyEl.textContent = 'Fetching...';
  statusEl.innerHTML = '<span class="status-badge pending">Loading</span>';
  metaEl.textContent = '';

  try {
    const res = await fetch(`/api/scriptinclude-info/${encodeURIComponent(name)}`);
    const data = await res.json();

    if (data.result && data.result.length > 0) {
      const si = data.result[0];
      statusEl.innerHTML = '<span class="status-badge ok">Found</span>';
      metaEl.textContent = `client_callable=${si.client_callable} | access=${si.access} | active=${si.active}`;
      bodyEl.textContent = si.script || '(no script body)';
    } else {
      statusEl.innerHTML = '<span class="status-badge error">Not Found</span>';
      metaEl.textContent = '';
      bodyEl.textContent = 'No ScriptInclude found with name: ' + name + '\n\nFull response:\n' + JSON.stringify(data, null, 2);
    }
  } catch (err) {
    statusEl.innerHTML = '<span class="status-badge error">Error</span>';
    bodyEl.textContent = err.message;
  }
}

// --- Table Explorer ---
async function searchTable() {
  const search = document.getElementById('te-search').value.trim();
  if (!search) return alert('Enter a table name or label');

  const btn = document.getElementById('te-search-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  document.getElementById('te-result').classList.add('hidden');
  document.getElementById('te-suggestions').classList.add('hidden');

  try {
    const res = await fetch(`/api/table-structure/${encodeURIComponent(search)}`);
    const data = await res.json();

    if (data.error === 'Table not found') {
      document.getElementById('te-result').classList.remove('hidden');
      document.getElementById('te-table-title').textContent = 'Table not found';
      document.getElementById('te-table-meta').textContent = `No table matching "${search}"`;
      document.getElementById('te-outgoing').querySelector('.response-body').innerHTML = '';
      document.getElementById('te-incoming').querySelector('.response-body').innerHTML = '';
      document.getElementById('te-columns').querySelector('.response-body').innerHTML = '';
      document.getElementById('te-out-count').textContent = '';
      document.getElementById('te-in-count').textContent = '';
      document.getElementById('te-col-count').textContent = '';
      btn.disabled = false;
      btn.textContent = 'Search';
      return;
    }

    if (data.error) {
      alert('Error: ' + data.error);
      btn.disabled = false;
      btn.textContent = 'Search';
      return;
    }

    if (data.suggestions && data.suggestions.length > 1) {
      const sugEl = document.getElementById('te-suggestions');
      const listEl = document.getElementById('te-suggestions-list');
      listEl.innerHTML = data.suggestions.map(s =>
        `<button class="quick-btn" onclick="searchTableByName('${s.name}')">${s.name} <span style="color:#8b949e">(${s.label})</span></button>`
      ).join('');
      sugEl.classList.remove('hidden');
    }

    renderTableResult(data);
  } catch (err) {
    alert('Error: ' + err.message);
  }

  btn.disabled = false;
  btn.textContent = 'Search';
}

function searchTableByName(name) {
  document.getElementById('te-search').value = name;
  searchTable();
}

function renderTableResult(data) {
  const { table, columns, references } = data;

  document.getElementById('te-result').classList.remove('hidden');

  document.getElementById('te-table-title').textContent = `${table.label} (${table.name})`;
  let meta = `sys_id: ${table.sys_id}`;
  if (table.super_class) meta += ` | extends: ${table.super_class.name} (${table.super_class.label})`;
  document.getElementById('te-table-meta').textContent = meta;

  const outEl = document.getElementById('te-outgoing').querySelector('.response-body');
  document.getElementById('te-out-count').textContent = `(${references.outgoing.length})`;
  if (references.outgoing.length === 0) {
    outEl.innerHTML = '<span style="color:#8b949e">No outgoing references</span>';
  } else {
    outEl.innerHTML = references.outgoing.map(r =>
      `<div class="te-ref-item">
        <span class="te-ref-col">${r.column}</span>
        <span class="te-ref-arrow">&rarr;</span>
        <span class="te-ref-table" onclick="searchTableByName('${r.target_table}')">${r.target_table}</span>
        <span class="te-ref-label">${r.label}</span>
      </div>`
    ).join('');
  }

  const inEl = document.getElementById('te-incoming').querySelector('.response-body');
  document.getElementById('te-in-count').textContent = `(${references.incoming.length})`;
  if (references.incoming.length === 0) {
    inEl.innerHTML = '<span style="color:#8b949e">No incoming references</span>';
  } else {
    const grouped = {};
    for (const r of references.incoming) {
      if (!grouped[r.source_table]) grouped[r.source_table] = [];
      grouped[r.source_table].push(r);
    }
    inEl.innerHTML = Object.entries(grouped).map(([, refs]) =>
      refs.map(r =>
        `<div class="te-ref-item">
          <span class="te-ref-table" onclick="searchTableByName('${r.source_table}')">${r.source_table}</span>
          <span class="te-ref-arrow">&rarr;</span>
          <span class="te-ref-col">${r.column}</span>
          <span class="te-ref-label">${r.label}</span>
        </div>`
      ).join('')
    ).join('');
  }

  document.getElementById('te-col-count').textContent = `(${columns.length})`;
  const colEl = document.getElementById('te-columns').querySelector('.response-body');
  const sorted = [...columns].sort((a, b) => a.element.localeCompare(b.element));
  colEl.innerHTML =
    `<div class="te-col-row header"><span>Column</span><span>Type</span><span>Label</span><span>Details</span></div>` +
    sorted.map(c => {
      const isRef = !!c.reference;
      const typeClass = isRef ? 'te-col-type ref' : 'te-col-type';
      const typeClick = isRef ? ` onclick="searchTableByName('${c.reference}')"` : '';
      const typeText = isRef ? `ref → ${c.reference}` : (c.internal_type || '');
      const details = [
        c.mandatory === 'true' ? 'required' : '',
        c.active === 'false' ? 'inactive' : '',
        c.max_length ? `max:${c.max_length}` : '',
      ].filter(Boolean).join(', ');
      return `<div class="te-col-row">
        <span class="te-col-name">${c.element}</span>
        <span class="${typeClass}"${typeClick}>${typeText}</span>
        <span class="te-col-label">${c.column_label || ''}</span>
        <span class="te-col-label">${details}</span>
      </div>`;
    }).join('');
}

// --- Helpers ---
function formatBody(body, contentType) {
  try {
    const obj = JSON.parse(body);
    return JSON.stringify(obj, null, 2);
  } catch {}

  const answerMatch = body.match(/answer="([^"]*)"/);
  if (answerMatch) {
    const decoded = answerMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    try {
      const obj = JSON.parse(decoded);
      return 'Parsed from XML answer attribute:\n\n' + JSON.stringify(obj, null, 2);
    } catch {
      return 'XML answer: ' + decoded + '\n\nFull response:\n' + body;
    }
  }

  return body;
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Auto-normalize the instance URL field on blur:
//   "ervan"                    → https://ervan.service-now.com
//   "ervan.service-now.com"    → https://ervan.service-now.com
//   "https://ervan.service-now.com" → unchanged
document.getElementById('inst-url').addEventListener('blur', function () {
  let v = this.value.trim();
  if (!v) return;
  // Strip trailing slashes
  v = v.replace(/\/+$/, '');
  // Add https:// if no protocol
  if (!v.startsWith('http://') && !v.startsWith('https://')) v = 'https://' + v;
  // Add .service-now.com if it looks like just a subdomain (no dots after stripping protocol)
  const host = v.replace(/^https?:\/\//, '');
  if (!host.includes('.')) v = v + '.service-now.com';
  this.value = v;
  updateOAuthSetupLink();
});

document.getElementById('inst-url').addEventListener('input', updateOAuthSetupLink);

function updateOAuthSetupLink() {
  const link = document.getElementById('oauth-setup-link');
  if (!link) return;
  let url = document.getElementById('inst-url').value.trim().replace(/\/+$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url && !url.includes('.')) url = 'https://' + url + '.service-now.com';
    else if (url) url = 'https://' + url;
  }
  if (url) {
    link.href = url + '/now/machine-identity-console/inbound-integrations/welcome';
    link.style.opacity = '1';
  } else {
    link.href = '#';
    link.style.opacity = '0.5';
  }
}
