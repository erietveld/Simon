const auth = require('./sn-auth');

// Per-instance web sessions (for xmlhttp.do — needs cookies + CSRF)
const snSessions = new Map(); // instanceId -> session

function collectCookies(response, jar) {
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+)=([^;]*)/);
    if (match) jar[match[1]] = match[2];
  }
  return setCookies.length;
}

function buildCookieString(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function getSessionState(instanceId) {
  return snSessions.get(instanceId) || { cookies: null, csrfToken: null, expiry: 0 };
}

async function getSnSession(forceRefresh = false, inst) {
  if (!inst) throw new Error('No ServiceNow instance provided');

  const existing = getSessionState(inst.id);
  const now = Date.now();

  if (!forceRefresh && existing.cookies && existing.csrfToken && now < existing.expiry) {
    return existing;
  }

  console.log(`[SN Session:${inst.id}] Establishing new web session...`);
  const authHeader = await auth.getAuthHeader(inst);
  const cookieJar = {};

  // Step 1: Hit a WEB page with Bearer auth to establish a web session.
  const step1Res = await fetch(`${inst.url}/navpage.do`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'text/html',
    },
    redirect: 'manual',
  });
  let count = collectCookies(step1Res, cookieJar);
  console.log(`[SN Session:${inst.id}] Step 1 (navpage.do): status=${step1Res.status}, cookies=${count}`);

  // Follow redirect — read HTML to extract g_ck (CSRF token)
  let csrfToken = '';
  if (step1Res.status >= 300 && step1Res.status < 400) {
    const loc = step1Res.headers.get('location');
    if (loc) {
      const url = loc.startsWith('http') ? loc : `${inst.url}${loc}`;
      console.log(`[SN Session:${inst.id}] Step 1b: following redirect to ${url}`);
      const step1bRes = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Cookie: buildCookieString(cookieJar),
          Accept: 'text/html',
        },
      });
      count = collectCookies(step1bRes, cookieJar);
      const html = await step1bRes.text();
      console.log(`[SN Session:${inst.id}] Step 1b: status=${step1bRes.status}, +${count} cookies`);

      const gckMatch = html.match(/var\s+g_ck\s*=\s*['"]([^'"]+)['"]/);
      const ckMatch = html.match(/name="ck"\s+value="([^"]+)"/);
      const windowCkMatch = html.match(/window\.g_ck\s*=\s*['"]([^'"]+)['"]/);
      if (gckMatch?.[1]) csrfToken = gckMatch[1];
      else if (ckMatch?.[1]) csrfToken = ckMatch[1];
      else if (windowCkMatch?.[1]) csrfToken = windowCkMatch[1];
    }
  }

  // Step 2: Get CSRF token via xmlhttp.do — NO Authorization header!
  const tokenRes = await fetch(`${inst.url}/xmlhttp.do?sysparm_processor=GetSessionDetails`, {
    method: 'GET',
    headers: {
      Cookie: buildCookieString(cookieJar),
      Accept: '*/*',
    },
  });

  count = collectCookies(tokenRes, cookieJar);
  const tokenBody = await tokenRes.text();
  console.log(`[SN Session:${inst.id}] Step 2 (GetSessionDetails): status=${tokenRes.status}`);

  if (!csrfToken) {
    const ckMatch = tokenBody.match(/name="ck"\s+value="([^"]+)"/);
    const gckMatch = tokenBody.match(/g_ck\s*=\s*['"]([^'"]+)['"]/);
    csrfToken = ckMatch?.[1] || gckMatch?.[1] || '';
  }

  if (!csrfToken) {
    csrfToken = cookieJar['glide_session_store'] || '';
    if (csrfToken) console.log(`[SN Session:${inst.id}] Using glide_session_store as CSRF fallback`);
  }

  const session = {
    cookies: buildCookieString(cookieJar),
    csrfToken,
    cookieNames: Object.keys(cookieJar),
    expiry: now + 15 * 60 * 1000,
  };
  snSessions.set(inst.id, session);
  return session;
}

function resetSnSession(instanceId) {
  if (instanceId) {
    snSessions.delete(instanceId);
  } else {
    snSessions.clear();
  }
}

function getSnSessionState(instanceId) {
  return getSessionState(instanceId);
}

// --- ServiceNow API operations ---

async function queryRecords({ table, query, fields, limit, offset, orderBy, orderDir, displayValue, inst }) {
  const authHeader = await auth.getAuthHeader(inst);
  const params = new URLSearchParams();
  if (query) params.set('sysparm_query', query);
  if (fields) params.set('sysparm_fields', Array.isArray(fields) ? fields.join(',') : fields);
  if (limit != null) params.set('sysparm_limit', String(limit));
  if (offset != null) params.set('sysparm_offset', String(offset));
  if (orderBy) params.set('sysparm_orderby', orderDir === 'desc' ? `${orderBy}DESC` : orderBy);
  if (displayValue) params.set('sysparm_display_value', displayValue);

  const url = `${inst.url}/api/now/table/${encodeURIComponent(table)}?${params.toString()}`;
  console.log(`[SN Query] ${url}`);

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  const body = await res.json();
  return { status: res.status, data: body, url };
}

async function getRecord({ table, sysId, fields, displayValue, inst }) {
  const authHeader = await auth.getAuthHeader(inst);
  const params = new URLSearchParams();
  if (fields) params.set('sysparm_fields', Array.isArray(fields) ? fields.join(',') : fields);
  if (displayValue) params.set('sysparm_display_value', displayValue);

  const url = `${inst.url}/api/now/table/${encodeURIComponent(table)}/${sysId}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  const body = await res.json();
  return { status: res.status, data: body, url };
}

async function createRecord({ table, fields, transactionScope, inst }) {
  const authHeader = await auth.getAuthHeader(inst);
  const params = new URLSearchParams();
  if (transactionScope) params.set('sysparm_transaction_scope', transactionScope);
  const qs = params.toString();
  const url = `${inst.url}/api/now/table/${encodeURIComponent(table)}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  });

  const body = await res.json();
  return { status: res.status, data: body, url };
}

async function updateRecord({ table, sysId, fields, transactionScope, inst }) {
  const authHeader = await auth.getAuthHeader(inst);
  const params = new URLSearchParams();
  if (transactionScope) params.set('sysparm_transaction_scope', transactionScope);
  const qs = params.toString();
  const url = `${inst.url}/api/now/table/${encodeURIComponent(table)}/${sysId}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  });

  const body = await res.json();
  return { status: res.status, data: body, url };
}

async function switchUpdateSet({ sys_id, name, inst }) {
  const authHeader = await auth.getAuthHeader(inst);

  // Resolve name → sys_id if needed
  let targetSysId = sys_id;
  let targetName = name;
  if (!targetSysId) {
    if (!name) throw new Error('Either sys_id or name must be provided');
    const qp = new URLSearchParams({
      sysparm_query: `name=${name}^state=in progress`,
      sysparm_fields: 'sys_id,name',
      sysparm_limit: '1',
    });
    const searchUrl = `${inst.url}/api/now/table/sys_update_set?${qp.toString()}`;
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    const searchData = await searchRes.json();
    const record = searchData.result?.[0];
    if (!record) throw new Error(`Update set not found or not in progress: "${name}"`);
    targetSysId = record.sys_id;
    targetName = record.name;
  }

  // Find current user's update set preference record
  const prefQuery = new URLSearchParams({
    sysparm_query: 'name=sys_update_set^user=javascript:gs.getUserID()',
    sysparm_fields: 'sys_id,value',
    sysparm_limit: '1',
  });
  const prefUrl = `${inst.url}/api/now/table/sys_user_preference?${prefQuery.toString()}`;
  const prefRes = await fetch(prefUrl, {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  const prefData = await prefRes.json();
  const existing = prefData.result?.[0];

  let writeRes;
  if (existing) {
    // PATCH existing preference
    const patchUrl = `${inst.url}/api/now/table/sys_user_preference/${existing.sys_id}`;
    writeRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { Authorization: authHeader, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: targetSysId }),
    });
  } else {
    // Create new preference record
    const postUrl = `${inst.url}/api/now/table/sys_user_preference`;
    writeRes = await fetch(postUrl, {
      method: 'POST',
      headers: { Authorization: authHeader, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'sys_update_set', value: targetSysId }),
    });
  }

  const writeBody = await writeRes.json();
  return { status: writeRes.status, data: { sys_id: targetSysId, name: targetName, raw: writeBody } };
}

async function deleteRecord({ table, sysId, inst }) {
  const authHeader = await auth.getAuthHeader(inst);
  const url = `${inst.url}/api/now/table/${encodeURIComponent(table)}/${sysId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });

  let body = null;
  const text = await res.text();
  try { body = JSON.parse(text); } catch { /* 204 No Content is fine */ }
  return { status: res.status, data: body, url };
}

async function getTableStructure(tableName, inst) {
  const authHeader = await auth.getAuthHeader(inst);
  const search = tableName.trim();

  let tableUrl = `${inst.url}/api/now/table/sys_db_object?sysparm_query=name=${encodeURIComponent(search)}&sysparm_fields=name,label,super_class,sys_id,sys_class_name&sysparm_limit=1`;
  let tableRes = await fetch(tableUrl, {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  let tableData = await tableRes.json();

  if (!tableData.result || tableData.result.length === 0) {
    tableUrl = `${inst.url}/api/now/table/sys_db_object?sysparm_query=labelLIKE${encodeURIComponent(search)}&sysparm_fields=name,label,super_class,sys_id,sys_class_name&sysparm_limit=10`;
    tableRes = await fetch(tableUrl, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    tableData = await tableRes.json();
  }

  if (!tableData.result || tableData.result.length === 0) {
    return { error: 'Table not found', search };
  }

  const table = tableData.result[0];
  const name = table.name;

  let parentTable = null;
  if (table.super_class && table.super_class.value) {
    const parentUrl = `${inst.url}/api/now/table/sys_db_object/${table.super_class.value}?sysparm_fields=name,label`;
    const parentRes = await fetch(parentUrl, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    const parentData = await parentRes.json();
    if (parentData.result) parentTable = parentData.result;
  }

  const dictUrl = `${inst.url}/api/now/table/sys_dictionary?sysparm_query=name=${encodeURIComponent(name)}^element!=NULL^elementISNOTEMPTY&sysparm_fields=element,column_label,internal_type,reference,max_length,mandatory,active,default_value&sysparm_limit=500`;
  const dictRes = await fetch(dictUrl, {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  const dictData = await dictRes.json();
  const columns = dictData.result || [];

  const incomingUrl = `${inst.url}/api/now/table/sys_dictionary?sysparm_query=reference=${encodeURIComponent(name)}^element!=NULL^elementISNOTEMPTY&sysparm_fields=name,element,column_label&sysparm_limit=200`;
  const incomingRes = await fetch(incomingUrl, {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  const incomingData = await incomingRes.json();
  const incomingRefs = incomingData.result || [];

  const outgoing = columns
    .filter(c => c.reference)
    .map(c => ({ column: c.element, label: c.column_label, target_table: c.reference }));

  const incoming = incomingRefs.map(r => ({
    source_table: r.name,
    column: r.element,
    label: r.column_label,
  }));

  const suggestions = tableData.result.length > 1
    ? tableData.result.map(t => ({ name: t.name, label: t.label }))
    : null;

  console.log(`[Table Structure] ${name}: ${columns.length} columns, ${outgoing.length} outgoing refs, ${incoming.length} incoming refs`);

  return {
    table: {
      name,
      label: table.label,
      super_class: parentTable,
      sys_id: table.sys_id,
    },
    columns,
    references: { outgoing, incoming },
    suggestions,
  };
}

async function callScriptInclude({ scriptInclude, method, params, inst }) {

  let session;
  try {
    session = await getSnSession(false, inst);
  } catch (sessionErr) {
    console.error('[SN Session Error]', sessionErr);
    session = { cookies: '', csrfToken: '' };
  }

  const scopeParts = scriptInclude.split('.');
  const appScope = scopeParts.length > 1 ? scopeParts.slice(0, -1).join('.') : 'global';

  const query = new URLSearchParams({
    sysparm_processor: scriptInclude,
    sysparm_name: method,
    sysparm_scope: appScope,
    sysparm_want_session_messages: 'true',
    'ni.nolog.x_referer': 'ignore',
    x_referer: appScope + '_portal.do',
  });

  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      query.set(key, value);
    }
  }

  const url = `${inst.url}/xmlhttp.do?${query.toString()}`;
  console.log(`[SN Request] ${url}`);

  const headers = {
    Accept: 'application/json, application/xml, text/xml, */*',
  };
  if (session.cookies) headers['Cookie'] = session.cookies;
  if (session.csrfToken) headers['X-UserToken'] = session.csrfToken;

  const snRes = await fetch(url, { method: 'GET', headers });
  const contentType = snRes.headers.get('content-type') || '';
  const body = await snRes.text();

  console.log(`[SN Response] ${snRes.status} ${contentType}`);

  if (body.includes('invalid token')) {
    resetSnSession(inst.id);
  }

  return { status: snRes.status, contentType, body, url };
}

async function getScriptIncludeInfo(name, inst) {
  const authHeader = await auth.getAuthHeader(inst);

  let url = `${inst.url}/api/now/table/sys_script_include?sysparm_query=api_name=${name}&sysparm_fields=name,api_name,script,client_callable,access,active&sysparm_limit=1`;
  console.log(`[SN Script Info] Fetching: ${url}`);

  let snRes = await fetch(url, {
    method: 'GET',
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  let data = await snRes.json();

  if (!data.result || data.result.length === 0) {
    const shortName = name.includes('.') ? name.split('.').pop() : name;
    url = `${inst.url}/api/now/table/sys_script_include?sysparm_query=name=${shortName}&sysparm_fields=name,api_name,script,client_callable,access,active&sysparm_limit=1`;
    console.log(`[SN Script Info] Fallback fetch: ${url}`);
    snRes = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    data = await snRes.json();
  }

  return data;
}

async function restApiCall({ apiPath, httpMethod = 'GET', body, inst }) {
  const authHeader = await auth.getAuthHeader(inst);
  const url = `${inst.url}${apiPath}`;
  console.log(`[SN REST] ${httpMethod} ${url}`);

  const fetchOpts = {
    method: httpMethod,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (body && httpMethod !== 'GET') {
    fetchOpts.body = JSON.stringify(body);
  }

  const snRes = await fetch(url, fetchOpts);
  const contentType = snRes.headers.get('content-type') || '';
  const text = await snRes.text();

  console.log(`[SN REST Response] ${snRes.status}`);

  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  return { status: snRes.status, contentType, data: parsed || text, url };
}

async function getInstanceInfo(inst) {
  if (!inst) return { instance: '(none)', authMethod: 'none', loggedIn: false, user: '(none)' };
  return {
    instance: inst.url,
    authMethod: inst.authType,
    loggedIn: auth.isLoggedIn(inst),
    user: inst.username || inst.clientId || '(oauth)',
  };
}

module.exports = {
  queryRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  getTableStructure,
  callScriptInclude,
  getScriptIncludeInfo,
  restApiCall,
  getInstanceInfo,
  switchUpdateSet,
  getSnSession,
  getSnSessionState,
  resetSnSession,
};
