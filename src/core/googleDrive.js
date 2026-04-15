// Google Drive 備份模組 — 透過 Cloudflare Worker OAuth2 後端實現永久登入

const WORKER_BASE = 'https://my-pwa-backend.misikyg.workers.dev';
const WORKER_ORIGIN = new URL(WORKER_BASE).origin;
const IDB_NAME = 'dress-up-doll-auth';
const IDB_STORE = 'auth';
const KEY_TOKEN = 'gd_token';
const KEY_SESSION = 'gd_session';
const KEY_REFRESH = 'gd_refresh';
const KEY_FOLDER = 'gd_folder';
const MAX_BACKUPS = 5;
const FOLDER_NAME = 'dress-up-doll';
const TOKEN_EARLY_EXPIRY_MS = 5 * 60 * 1000;
const PROACTIVE_REFRESH_BEFORE_MS = 5 * 60 * 1000;
const AUTH_REQUIRED_CODE = 'AUTH_REQUIRED';
const TOKEN_LIFETIME_OVERRIDE_S = 0;

let currentToken = null;
let tokenExpiry = 0;
let cachedFolderId = null;
let _refreshTimer = null;
let _silentRefreshPromise = null;

// ── IndexedDB 通用操作 ──

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbGet(key) {
  try {
    const db = await _openDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    const result = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return result || null;
  } catch { return null; }
}

async function _idbSet(key, value) {
  try {
    const db = await _openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  } catch {}
}

async function _idbDel(key) {
  try {
    const db = await _openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  } catch {}
}

// ── localStorage + IndexedDB 雙層快取工具 ──

function _lsSet(key, value) {
  try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch {}
}

function _lsGet(key, parse = true) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (parse ? JSON.parse(raw) : raw) : null;
  } catch { return null; }
}

function _lsClear(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ── Token 快取 ──

function _saveTokenCache(accessToken, expiry) {
  const data = { access_token: accessToken, expiry };
  _lsSet(KEY_TOKEN, data);
  _idbSet(KEY_TOKEN, data);
}

async function _loadTokenCache() {
  const ls = _lsGet(KEY_TOKEN);
  if (ls?.access_token) return ls;
  const idb = await _idbGet(KEY_TOKEN);
  if (idb?.access_token) _lsSet(KEY_TOKEN, idb);
  return idb;
}

function _clearTokenCache() {
  _lsClear(KEY_TOKEN);
  _idbDel(KEY_TOKEN);
}

// ── Refresh Token 持久儲存 ──

function _saveRefreshToken(rt) {
  if (!rt) return;
  _lsSet(KEY_REFRESH, rt);
  _idbSet(KEY_REFRESH, rt);
}

async function _loadRefreshToken() {
  const ls = _lsGet(KEY_REFRESH, false);
  if (ls) return ls;
  const idb = await _idbGet(KEY_REFRESH);
  if (idb) _lsSet(KEY_REFRESH, idb);
  return idb;
}

function _clearRefreshToken() {
  _lsClear(KEY_REFRESH);
  _idbDel(KEY_REFRESH);
}

// ── Session 持久化 ──

function _saveSession(email) {
  const info = { loggedIn: true, email: email || '', ts: Date.now() };
  _lsSet(KEY_SESSION, info);
  _idbSet(KEY_SESSION, info);
}

async function _loadSession() {
  const ls = _lsGet(KEY_SESSION);
  if (ls?.loggedIn) return ls;
  const idb = await _idbGet(KEY_SESSION);
  if (idb?.loggedIn) _lsSet(KEY_SESSION, idb);
  return idb;
}

function _clearSession() {
  _lsClear(KEY_SESSION);
  _idbDel(KEY_SESSION);
}

// ── Token 靜默刷新 ──

function _authRequiredError(message, cause) {
  const err = new Error(message);
  err.code = AUTH_REQUIRED_CODE;
  if (cause) err.cause = cause;
  return err;
}

function _computeExpiry(expiresIn) {
  const lifetime = TOKEN_LIFETIME_OVERRIDE_S > 0 ? TOKEN_LIFETIME_OVERRIDE_S : (expiresIn || 3600);
  return Date.now() + lifetime * 1000 - TOKEN_EARLY_EXPIRY_MS;
}

async function _refreshAccessToken(refreshToken) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`${WORKER_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.access_token) {
        // Google 回傳 invalid_grant → refresh_token 永久失效，需重新登入
        if (data.error === 'invalid_grant') {
          throw _authRequiredError('refresh_token 已失效，需要重新登入');
        }
        throw new Error(data.error || 'refresh_failed');
      }
      currentToken = data.access_token;
      tokenExpiry = _computeExpiry(data.expires_in);
      _saveTokenCache(currentToken, tokenExpiry);
      return data;
    } catch (err) {
      lastError = err;
      // 永久性失敗不重試
      if (err.code === AUTH_REQUIRED_CODE) throw err;
      // 第一次失敗後等 1 秒重試
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

// 去重：多個併發呼叫共用同一次 refresh
async function _silentRefresh(refreshToken) {
  if (_silentRefreshPromise) return _silentRefreshPromise;
  _silentRefreshPromise = _refreshAccessToken(refreshToken).finally(() => {
    _silentRefreshPromise = null;
  });
  return _silentRefreshPromise;
}

// ── 主動預刷新 ──

function _scheduleProactiveRefresh(refreshToken) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const refreshAt = tokenExpiry - Date.now() - PROACTIVE_REFRESH_BEFORE_MS;
  const delay = Math.max(refreshAt, 500); // 即使已逾時也盡快刷新（但不同步阻塞）
  _refreshTimer = setTimeout(async () => {
    try {
      await _silentRefresh(refreshToken);
      _scheduleProactiveRefresh(refreshToken);
    } catch {
      // 刷新失敗，30 秒後重試（避免放棄整個預刷新鏈）
      _refreshTimer = setTimeout(() => _scheduleProactiveRefresh(refreshToken), 30000);
    }
  }, delay);
}

// ── 彈窗式首次登入 ──

function _openLoginPopup() {
  return new Promise((resolve, reject) => {
    const loginUrl = `${WORKER_BASE}/auth/login?pwa_origin=${encodeURIComponent(location.origin)}`;
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(loginUrl, 'google-auth', `width=${width},height=${height},left=${left},top=${top},popup=yes`);

    if (!popup) return reject(new Error('popup_blocked'));

    let settled = false, timer = null, pollTimer = null;

    function cleanup() {
      if (timer) clearTimeout(timer);
      if (pollTimer) clearInterval(pollTimer);
      timer = pollTimer = null;
      window.removeEventListener('message', handler);
    }

    function settle(fn, value) {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    }

    timer = setTimeout(() => settle(reject, new Error('login_timeout')), 120000);

    function handler(event) {
      if (event.origin !== WORKER_ORIGIN) return;
      if (!event.data || event.data.type !== 'GOOGLE_AUTH_CALLBACK') return;
      const payload = event.data.payload || {};
      if (payload.error) {
        const msg = payload.error_description ? `${payload.error}: ${payload.error_description}` : payload.error;
        settle(reject, new Error(msg));
      } else if (!payload.access_token) {
        settle(reject, new Error('missing_access_token'));
      } else {
        settle(resolve, payload);
      }
    }

    window.addEventListener('message', handler);
    pollTimer = setInterval(() => { if (popup.closed) settle(reject, new Error('popup_closed')); }, 250);
  });
}

// ── 公開 API：認證 ──

export function isTokenValid() {
  return !!currentToken && Date.now() < tokenExpiry;
}

export function isAuthRequiredError(err) {
  return !!err && err.code === AUTH_REQUIRED_CODE;
}

// 頁面載入時恢復登入狀態，過期則背景靜默刷新
export async function tryRestoreSession() {
  const session = await _loadSession();
  if (!session?.loggedIn) return false;

  const cached = await _loadTokenCache();
  const refreshToken = await _loadRefreshToken();

  if (cached?.access_token && cached?.expiry && Date.now() < cached.expiry) {
    currentToken = cached.access_token;
    tokenExpiry = cached.expiry;
    if (refreshToken) _scheduleProactiveRefresh(refreshToken);
  } else if (refreshToken) {
    try {
      await _silentRefresh(refreshToken);
      _scheduleProactiveRefresh(refreshToken);
    } catch {
      // 靜默刷新失敗，保留 session 標記以便下次操作時再重試
    }
  } else {
    return false;
  }

  return 'remembered';
}

export function hasPreviousAuth() {
  try { return !!JSON.parse(localStorage.getItem(KEY_SESSION))?.loggedIn; } catch { return false; }
}

export async function hasPreviousAuthAsync() {
  return !!(await _loadSession())?.loggedIn;
}

// 互動式登入（彈窗授權），成功後取得 refresh_token 實現永久登入
export async function interactiveSignIn() {
  const result = await _openLoginPopup();
  currentToken = result.access_token;
  tokenExpiry = _computeExpiry(result.expires_in);
  _saveSession(result.email);
  _saveTokenCache(currentToken, tokenExpiry);
  if (result.refresh_token) {
    _saveRefreshToken(result.refresh_token);
    _scheduleProactiveRefresh(result.refresh_token);
  }
  return result;
}

// 確保有效 access token：有效→返回，過期→靜默刷新，無 token→拋 AUTH_REQUIRED
export async function ensureAccessToken() {
  if (isTokenValid()) return { access_token: currentToken };

  const session = await _loadSession();
  if (!session?.loggedIn) throw _authRequiredError('尚未登入');

  const refreshToken = await _loadRefreshToken();
  if (!refreshToken) throw _authRequiredError('缺少 refresh_token，需要重新登入');

  try {
    await _silentRefresh(refreshToken);
    _scheduleProactiveRefresh(refreshToken);
    return { access_token: currentToken };
  } catch (err) {
    // refresh_token 永久失效 → 需要重新登入
    if (err.code === AUTH_REQUIRED_CODE) throw err;
    // 暫時性失敗（網路等）→ 不觸發登出，僅拋出一般錯誤
    throw new Error('靜默刷新暫時失敗：' + (err.message || ''));
  }
}

// 確保 token 有效，允許時 fallback 互動式登入
export async function ensureAccessTokenOrInteractive(options = {}) {
  try {
    return await ensureAccessToken();
  } catch (err) {
    if (!options.allowInteractive) throw err;
  }
  await interactiveSignIn();
  return { access_token: currentToken };
}

export function signOut() {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  _loadRefreshToken().then((rt) => {
    if (rt) {
      fetch(`${WORKER_BASE}/auth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rt }),
      }).catch(() => {});
    }
  });
  currentToken = null;
  tokenExpiry = 0;
  cachedFolderId = null;
  _clearTokenCache();
  _clearRefreshToken();
  _clearSession();
  _idbDel(KEY_FOLDER);
}

// ── 自動重試 401 的 fetch 包裝 ──

async function _authorizedFetch(url, options = {}) {
  const makeHeaders = () => ({ ...options.headers, Authorization: `Bearer ${currentToken}` });
  let resp = await fetch(url, { ...options, headers: makeHeaders() });
  if (resp.status === 401) {
    const rt = await _loadRefreshToken();
    if (rt) {
      try {
        await _silentRefresh(rt);
        _scheduleProactiveRefresh(rt);
        resp = await fetch(url, { ...options, headers: makeHeaders() });
      } catch { /* 重試失敗，返回原始 401 回應 */ }
    }
  }
  return resp;
}

// ── Google Drive 資料夾管理 ──

async function ensureFolder() {
  if (!currentToken) throw new Error('No access token available');
  if (cachedFolderId) return cachedFolderId;

  const stored = await _idbGet(KEY_FOLDER);
  if (stored?.folderId) { cachedFolderId = stored.folderId; return cachedFolderId; }

  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const listResp = await _authorizedFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
  );
  if (!listResp.ok) throw new Error(`Search folder failed (${listResp.status})`);
  const listData = await listResp.json();

  if (listData.files?.length > 0) {
    cachedFolderId = listData.files[0].id;
  } else {
    const createResp = await _authorizedFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!createResp.ok) throw new Error(`Create folder failed (${createResp.status})`);
    cachedFolderId = (await createResp.json()).id;
  }

  _idbSet(KEY_FOLDER, { folderId: cachedFolderId });
  return cachedFolderId;
}

// ── Gzip 壓縮 / 解壓縮 ──

async function compressToGzip(str) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const blob = new Blob([new TextEncoder().encode(str)]);
    return new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  } catch { return null; }
}

async function decompressGzip(blob) {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  } catch { return null; }
}

// ── 上傳 / 下載 / 列表 ──

// 上傳 JSON 備份至 Google Drive（支援 gzip）
export async function uploadJsonFile({ name, json }) {
  await ensureAccessTokenOrInteractive();
  const folderId = await ensureFolder();
  const jsonStr = JSON.stringify(json);

  let uploadBlob, contentType, fileName;
  const compressed = await compressToGzip(jsonStr);
  if (compressed) {
    uploadBlob = compressed;
    contentType = 'application/gzip';
    fileName = name.replace(/\.json$/, '') + '.json.gz';
  } else {
    uploadBlob = new Blob([jsonStr], { type: 'application/json; charset=UTF-8' });
    contentType = 'application/json; charset=UTF-8';
    fileName = name;
  }

  const initResp = await _authorizedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(uploadBlob.size),
    },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  });
  if (!initResp.ok) throw new Error(`Upload init failed (${initResp.status})`);

  const uploadUrl = initResp.headers.get('Location');
  if (!uploadUrl) throw new Error('No resumable upload URL returned');

  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: uploadBlob,
  });
  if (!uploadResp.ok) throw new Error(`Upload failed (${uploadResp.status})`);
  return uploadResp.json();
}

// 下載最新 JSON 備份
export async function downloadLatestJson({ name }) {
  await ensureAccessTokenOrInteractive();
  const folderId = await ensureFolder();
  const baseName = name.replace(/\.json$/, '').replace(/'/g, "\\'");

  const q = encodeURIComponent(`(name contains '${baseName}') and '${folderId}' in parents and trashed=false`);
  const listResp = await _authorizedFetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=1&orderBy=modifiedTime%20desc&q=${q}&fields=files(id,name)`,
  );
  if (!listResp.ok) throw new Error(`List files failed (${listResp.status})`);

  const file = (await listResp.json()).files?.[0];
  if (!file) return null;

  const response = await _authorizedFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
  );
  if (!response.ok) throw new Error(`Download failed (${response.status})`);

  if (file.name.endsWith('.gz')) {
    const blob = await response.blob();
    const decompressed = await decompressGzip(blob);
    if (decompressed) return JSON.parse(decompressed);
    return JSON.parse(await blob.text());
  }
  return response.json();
}

// 列出所有備份檔案
export async function listBackupFiles({ name }) {
  await ensureAccessTokenOrInteractive();
  const folderId = await ensureFolder();
  const baseName = name.replace(/\.json$/, '').replace(/'/g, "\\'");

  const q = encodeURIComponent(`(name contains '${baseName}') and '${folderId}' in parents and trashed=false`);
  const listResp = await _authorizedFetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=100&orderBy=modifiedTime%20desc&q=${q}&fields=files(id,name,modifiedTime,size)`,
  );
  if (!listResp.ok) throw new Error(`List files failed (${listResp.status})`);
  return (await listResp.json()).files || [];
}

// 刪除指定備份檔案
export async function deleteFile(fileId) {
  await ensureAccessTokenOrInteractive();
  const resp = await _authorizedFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 204) throw new Error(`Delete failed (${resp.status})`);
}

// 清理舊備份，僅保留最新 keep 個
export async function pruneOldBackups({ name, keep = MAX_BACKUPS } = {}) {
  const files = await listBackupFiles({ name });
  if (files.length <= keep) return 0;
  let deleted = 0;
  for (const f of files.slice(keep)) {
    try { await deleteFile(f.id); deleted++; } catch (err) { console.warn('刪除舊備份失敗:', f.id, err); }
  }
  return deleted;
}

// ── 頁籤回到前景時自動刷新過期 token ──

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    // 尚未登入 → 不處理
    const session = await _loadSession();
    if (!session?.loggedIn) return;
    // token 仍然充裕 → 不處理
    if (currentToken && Date.now() < tokenExpiry - PROACTIVE_REFRESH_BEFORE_MS) return;
    const rt = await _loadRefreshToken();
    if (!rt) return;
    try {
      await _silentRefresh(rt);
      _scheduleProactiveRefresh(rt);
    } catch { /* 靜默失敗，下次操作時再重試 */ }
  });
}
