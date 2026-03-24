// --- Tabs ---
let logsAutoRefreshTimer = null;

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

    if (tab.dataset.tab === 'instances') loadInstances();
    if (tab.dataset.tab === 'logs') {
      loadLogs();
      startLogsAutoRefresh();
    } else {
      stopLogsAutoRefresh();
    }
  });
});


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

    listEl.innerHTML = `
      <table class="instance-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>URL</th>
            <th>Auth</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.instances.map(inst => renderInstanceRow(inst)).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    listEl.innerHTML = `<div style="color:#f85149;font-size:13px">Error loading instances: ${err.message}</div>`;
  }
}

function renderInstanceRow(inst) {
  const authBadge = inst.authType === 'oauth'
    ? '<span class="tag oauth">OAuth</span>'
    : '<span class="tag basic">Basic</span>';

  const statusBadge = inst.loggedIn
    ? '<span class="tag logged-in">Logged in</span>'
    : (inst.authType === 'oauth' ? '<span class="tag logged-out">Not logged in</span>' : '<span style="color:#8b949e;font-size:11px">—</span>');

  const loginBtn = inst.authType === 'oauth'
    ? (inst.loggedIn
        ? `<a href="/auth/logout?instanceId=${inst.id}" class="row-btn logout-btn">Logout</a>`
        : `<a href="/auth/login?instanceId=${inst.id}" class="row-btn login-btn">Login</a>`)
    : '';

  return `
    <tr class="inst-row" id="inst-row-${inst.id}">
      <td class="inst-name-cell">${escHtml(inst.name)}</td>
      <td class="inst-url-cell" title="${escHtml(inst.url)}">${escHtml(inst.url)}</td>
      <td>${authBadge}</td>
      <td>${statusBadge}</td>
      <td class="inst-actions-cell">
        ${loginBtn}
        <button class="row-btn" onclick="showEditInstance('${inst.id}')">Edit</button>
        <button class="row-btn danger-btn" onclick="deleteInstance('${inst.id}', '${escHtml(inst.name)}')">Delete</button>
      </td>
    </tr>`;
}

async function deleteInstance(id, name) {
  if (!confirm(`Delete instance "${name}"? This cannot be undone.`)) return;
  await fetch(`/api/instances/${id}`, { method: 'DELETE' });
  loadInstances();
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
  document.getElementById('inst-client-secret').value = '';
  document.getElementById('inst-username').value = inst.username || '';
  document.getElementById('inst-password').value = '';
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
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    saveBtn.disabled = false;
  }
}

// Load instances on startup (default tab)
loadInstances();

// --- Name → URL auto-populate ---
document.getElementById('inst-name').addEventListener('input', function () {
  const urlField = document.getElementById('inst-url');
  if (!urlField.value.trim()) {
    const slug = this.value.trim();
    if (slug) {
      urlField.value = `https://${slug}.service-now.com`;
      updateOAuthSetupLink();
    }
  }
});

// --- URL normalization on blur ---
document.getElementById('inst-url').addEventListener('blur', function () {
  let v = this.value.trim();
  if (!v) return;
  v = v.replace(/\/+$/, '');
  if (!v.startsWith('http://') && !v.startsWith('https://')) v = 'https://' + v;
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

// --- Logs Tab ---

function startLogsAutoRefresh() {
  stopLogsAutoRefresh();
  logsAutoRefreshTimer = setInterval(loadLogs, 5000);
}

function stopLogsAutoRefresh() {
  if (logsAutoRefreshTimer) {
    clearInterval(logsAutoRefreshTimer);
    logsAutoRefreshTimer = null;
  }
}

async function loadLogs() {
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    renderLogs(data.logs || []);
  } catch (err) {
    document.getElementById('log-table-wrap').innerHTML =
      `<div class="log-empty" style="color:#f85149">Error loading logs: ${escHtml(err.message)}</div>`;
  }
}

async function clearLogs() {
  if (!confirm('Clear all logs?')) return;
  await fetch('/api/logs', { method: 'DELETE' });
  loadLogs();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const toolColors = {
  sn_query: '#58a6ff',
  sn_get_record: '#79c0ff',
  sn_create_record: '#3fb950',
  sn_update_record: '#d2a8ff',
  sn_delete_record: '#f85149',
  sn_table_structure: '#ffa657',
  sn_script_include: '#e3b341',
  sn_rest_api: '#f0883e',
  sn_instance_info: '#8b949e',
  sn_switch_update_set: '#8b949e',
};

function renderLogs(logs) {
  const wrap = document.getElementById('log-table-wrap');
  const countEl = document.getElementById('log-count');

  countEl.textContent = logs.length ? `${logs.length} entries` : '';

  if (logs.length === 0) {
    wrap.innerHTML = '<div class="log-empty">No tool calls logged yet.</div>';
    return;
  }

  const rows = logs.map((entry, i) => {
    const color = toolColors[entry.tool] || '#c9d1d9';
    const rowClass = entry.isError ? 'log-row log-row-error' : 'log-row';
    const flags = [
      entry.truncated ? '<span class="log-flag trunc" title="Response was truncated">T</span>' : '',
      entry.isError ? '<span class="log-flag error" title="Error response">E</span>' : '',
    ].filter(Boolean).join('');

    const instName = entry.instance ? escHtml(entry.instance.name) : '<span style="color:#8b949e">—</span>';
    const ms = entry.durationMs != null ? entry.durationMs : '—';

    return `
      <tr class="${rowClass}" onclick="toggleLog(${i})" id="log-row-${i}">
        <td class="log-time">${formatTime(entry.timestamp)}</td>
        <td><span class="log-tool-badge" style="color:${color}">${escHtml(entry.tool)}</span></td>
        <td class="log-inst">${instName}</td>
        <td class="log-size">${formatSize(entry.requestSize || 0)}</td>
        <td class="log-size">${formatSize(entry.responseSize || 0)}</td>
        <td>${flags}</td>
        <td class="log-ms">${ms}</td>
      </tr>
      <tr class="log-detail hidden" id="log-detail-${i}">
        <td colspan="7">
          <div class="log-detail-inner">
            <div class="log-detail-col">
              <div class="log-detail-label">Request · ${entry.instance ? escHtml(entry.instance.url) : '—'}</div>
              <pre class="log-detail-pre">${escHtml(JSON.stringify(entry.request, null, 2))}</pre>
            </div>
            <div class="log-detail-col">
              <div class="log-detail-label">Response${entry.truncated ? ' <span class="log-flag trunc">truncated</span>' : ''}</div>
              <pre class="log-detail-pre">${escHtml(entry.response || '(empty)')}</pre>
            </div>
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="log-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Tool</th>
          <th>Instance</th>
          <th>Req</th>
          <th>Resp</th>
          <th></th>
          <th>ms</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function toggleLog(i) {
  const detail = document.getElementById(`log-detail-${i}`);
  if (detail) detail.classList.toggle('hidden');
}

// --- Helpers ---
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
