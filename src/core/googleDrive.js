const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'google_drive_auth';
const IDB_NAME = 'dress-up-doll-auth';
const IDB_STORE = 'auth';
const IDB_KEY = 'google_drive_auth';
const MAX_BACKUPS = 5;
const FOLDER_NAME = 'dress-up-doll';

let tokenClient = null;
let gapiReady = false;
let initializing = null;
let currentToken = null;
let tokenExpiry = 0;
let storedClientId = null;
let cachedFolderId = null;

const ensureScriptsLoaded = () => {
  if (typeof window === 'undefined') throw new Error('Google APIs unavailable in SSR');
  if (!window.gapi || !window.google) throw new Error('Google API scripts not loaded');
};

// ---- IndexedDB 持久化（比 localStorage 在 iOS Safari/PWA 更持久）----

function _openAuthDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _saveToIDB(data) {
  try {
    const db = await _openAuthDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { /* ignore */ }
}

async function _loadFromIDB() {
  try {
    const db = await _openAuthDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    const result = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    db.close();
    return result || null;
  } catch { return null; }
}

async function _clearIDB() {
  try {
    const db = await _openAuthDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  } catch { /* ignore */ }
}

// ---- 雙重持久化：localStorage + IndexedDB ----

const saveAuthState = (token, expiry) => {
  const data = { hasAuth: true, ts: Date.now() };
  if (token) {
    data.access_token = token;
    data.expiry = expiry;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  _saveToIDB(data); // fire-and-forget async
};

const loadAuthState = () => {
  // 同步讀取 localStorage（快速路徑）
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
};

/** 非同步讀取：localStorage 失效時從 IndexedDB fallback */
const loadAuthStateAsync = async () => {
  const ls = loadAuthState();
  if (ls) return ls;
  // localStorage 被清了（iOS ITP），從 IndexedDB 恢復
  const idb = await _loadFromIDB();
  if (idb) {
    // 順便寫回 localStorage
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(idb)); } catch { /* ignore */ }
  }
  return idb;
};

const clearAuthState = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  _clearIDB(); // fire-and-forget async
  currentToken = null;
  tokenExpiry = 0;
  cachedFolderId = null;
};

export async function ensureGoogleClient(clientId) {
  if (clientId) storedClientId = clientId;
  ensureScriptsLoaded();
  if (gapiReady && tokenClient) return;
  if (initializing) return initializing;

  initializing = new Promise((resolve, reject) => {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({ discoveryDocs: [DRIVE_DISCOVERY] });
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: () => {}
        });
        gapiReady = true;
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        initializing = null;
      }
    });
  });

  return initializing;
}

export function isTokenValid() {
  return !!currentToken && Date.now() < tokenExpiry;
}

export function hasPreviousAuth() {
  const state = loadAuthState();
  return !!state?.hasAuth;
}

/** 非同步版本：會查 IndexedDB fallback（iOS localStorage 被清時） */
export async function hasPreviousAuthAsync() {
  const state = await loadAuthStateAsync();
  return !!state?.hasAuth;
}

/**
 * 嘗試恢復 session — 純本地檢查，絕不觸發 Google OAuth 彈窗。
 * 回傳 'remembered' → 之前有登入過，UI 顯示為已連線；操作時再靜默/互動取得 token
 * 回傳 false → 從未登入
 *
 * 注意：不會嘗試刷新 token，避免頁面載入時彈出 Google 登入視窗。
 */
export async function tryRestoreSession(clientId) {
  if (clientId) storedClientId = clientId;
  const state = await loadAuthStateAsync();
  if (!state?.hasAuth) return false;

  // 嘗試初始化 gapi client（不會觸發 OAuth 彈窗）
  try {
    await ensureGoogleClient(clientId);
  } catch { /* ignore */ }

  // 檢查是否有未過期的 token 可直接使用
  if (state.access_token && state.expiry && Date.now() < state.expiry) {
    currentToken = state.access_token;
    tokenExpiry = state.expiry;
    try { window.gapi?.client?.setToken({ access_token: currentToken }); } catch { /* ignore */ }
    return 'remembered';
  }

  // token 過期或不存在，但 hasAuth flag 在 → 使用者操作時再取 token
  return 'remembered';
}

export async function ensureAccessToken() {
  ensureScriptsLoaded();
  if (storedClientId) await ensureGoogleClient(storedClientId);
  if (!tokenClient) throw new Error('Google client not initialized');

  if (isTokenValid()) {
    window.gapi.client.setToken({ access_token: currentToken });
    return { access_token: currentToken };
  }

  // 靜默請求新 token（prompt: '' 不彈窗）
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Token request timed out'));
    }, 15000);
    tokenClient.callback = (resp) => {
      clearTimeout(timeoutId);
      if (resp.error) return reject(resp);
      currentToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000; // 提前 1 分鐘
      window.gapi.client.setToken({ access_token: currentToken });
      saveAuthState(currentToken, tokenExpiry);
      resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * 確保取得有效 token：先嘗試靜默刷新，失敗則自動 fallback 到互動式登入。
 * 這是雲端操作應呼叫的主要方法 — 使用者不會因為 token 過期而「被登出」。
 */
export async function ensureAccessTokenOrInteractive(clientId) {
  if (clientId) storedClientId = clientId;
  try {
    return await ensureAccessToken();
  } catch {
    // 靜默刷新失敗（Google session cookie 過期等）→ 互動式重新授權
    return await interactiveSignIn(storedClientId);
  }
}

export async function interactiveSignIn(clientId) {
  await ensureGoogleClient(clientId);
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      currentToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
      window.gapi.client.setToken({ access_token: currentToken });
      saveAuthState(currentToken, tokenExpiry);
      resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function trySilentAuth(clientId) {
  try {
    await ensureGoogleClient(clientId);
    await ensureAccessToken();
    return true;
  } catch {
    return false;
  }
}

export function signOut() {
  if (currentToken) {
    try {
      window.google.accounts.oauth2.revoke(currentToken, () => {});
    } catch { /* ignore */ }
  }
  clearAuthState();
  try { window.gapi?.client?.setToken(null); } catch { /* ignore */ }
}

// ---- 可見資料夾管理 ----

async function ensureFolder() {
  if (!currentToken) throw new Error('No access token available');
  if (cachedFolderId) return cachedFolderId;

  // 搜尋現有資料夾
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const listResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${currentToken}` } }
  );
  if (!listResp.ok) {
    const errBody = await listResp.text().catch(() => '');
    throw new Error(`Search folder failed (${listResp.status}): ${errBody}`);
  }
  const listData = await listResp.json();

  if (listData.files?.length > 0) {
    cachedFolderId = listData.files[0].id;
    return cachedFolderId;
  }

  // 建立資料夾
  const createResp = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  if (!createResp.ok) {
    const errBody = await createResp.text().catch(() => '');
    throw new Error(`Create folder failed (${createResp.status}): ${errBody}`);
  }
  const folderData = await createResp.json();
  cachedFolderId = folderData.id;
  return cachedFolderId;
}

// ---- Gzip 壓縮 / 解壓縮（加速上傳下載）----

async function compressToGzip(str) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const blob = new Blob([new TextEncoder().encode(str)]);
    const cs = new CompressionStream('gzip');
    const compressedStream = blob.stream().pipeThrough(cs);
    return new Response(compressedStream).blob();
  } catch {
    return null;
  }
}

async function decompressGzip(blob) {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const ds = new DecompressionStream('gzip');
    const decompressedStream = blob.stream().pipeThrough(ds);
    return new Response(decompressedStream).text();
  } catch {
    return null;
  }
}

// ---- 上傳 / 下載 / 列表 ----

export async function uploadJsonFile({ name, json }) {
  if (!currentToken) throw new Error('No access token available');

  const folderId = await ensureFolder();
  const jsonStr = JSON.stringify(json);

  // 嘗試 gzip 壓縮以加速網路傳輸
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

  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  // Step 1: 發起 resumable upload
  const initResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(uploadBlob.size),
      },
      body: metadata,
    }
  );

  if (!initResp.ok) {
    const errBody = await initResp.text().catch(() => '');
    throw new Error(`Upload init failed (${initResp.status}): ${errBody}`);
  }

  const uploadUrl = initResp.headers.get('Location');
  if (!uploadUrl) throw new Error('No resumable upload URL returned');

  // Step 2: 上傳檔案內容
  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: uploadBlob,
  });

  if (!uploadResp.ok) {
    const errBody = await uploadResp.text().catch(() => '');
    throw new Error(`Upload failed (${uploadResp.status}): ${errBody}`);
  }

  return uploadResp.json();
}

export async function downloadLatestJson({ name }) {
  if (!currentToken) throw new Error('No access token available');

  const folderId = await ensureFolder();
  const baseName = name.replace(/\.json$/, '').replace(/'/g, "\\'");
  const safeName = name.replace(/'/g, "\\'");

  // 搜尋所有 doll-backup 相關檔案（含時間編碼格式如 doll-backup-0730AM）
  const q = encodeURIComponent(
    `(name contains '${baseName}') and '${folderId}' in parents and trashed=false`
  );
  const listResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=1&orderBy=modifiedTime%20desc&q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${currentToken}` } }
  );
  if (!listResp.ok) {
    const errBody = await listResp.text().catch(() => '');
    throw new Error(`List files failed (${listResp.status}): ${errBody}`);
  }
  const listData = await listResp.json();
  const file = listData.files?.[0];
  if (!file) return null;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${currentToken}` } }
  );
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Download failed (${response.status}): ${errBody}`);
  }

  // 若為 gzip 壓縮檔則解壓縮
  if (file.name.endsWith('.gz')) {
    const blob = await response.blob();
    const decompressed = await decompressGzip(blob);
    if (decompressed) return JSON.parse(decompressed);
    // 若解壓失敗，嘗試直接解析
    return JSON.parse(await blob.text());
  }

  return response.json();
}

export async function listBackupFiles({ name }) {
  if (!currentToken) throw new Error('No access token available');

  const folderId = await ensureFolder();
  const baseName = name.replace(/\.json$/, '').replace(/'/g, "\\'");

  const q = encodeURIComponent(
    `(name contains '${baseName}') and '${folderId}' in parents and trashed=false`
  );
  const listResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=100&orderBy=modifiedTime%20desc&q=${q}&fields=files(id,name,modifiedTime,size)`,
    { headers: { Authorization: `Bearer ${currentToken}` } }
  );
  if (!listResp.ok) {
    const errBody = await listResp.text().catch(() => '');
    throw new Error(`List files failed (${listResp.status}): ${errBody}`);
  }
  const listData = await listResp.json();
  return listData.files || [];
}

export async function deleteFile(fileId) {
  if (!currentToken) throw new Error('No access token available');

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentToken}` },
    }
  );
  if (!resp.ok && resp.status !== 204) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Delete failed (${resp.status}): ${errBody}`);
  }
}

export async function pruneOldBackups({ name, keep = MAX_BACKUPS } = {}) {
  const files = await listBackupFiles({ name });
  if (files.length <= keep) return 0;

  const toDelete = files.slice(keep);
  let deleted = 0;
  for (const f of toDelete) {
    try {
      await deleteFile(f.id);
      deleted++;
    } catch (err) {
      console.warn('刪除舊備份失敗:', f.id, err);
    }
  }
  return deleted;
}
