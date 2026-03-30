const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'google_drive_auth';
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

const saveAuthState = (token, expiry) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      hasAuth: true,
      access_token: token,
      expiry,
      ts: Date.now()
    }));
  } catch { /* ignore */ }
};

const loadAuthState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const clearAuthState = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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

export async function tryRestoreSession(clientId) {
  const state = loadAuthState();
  if (!state?.access_token || !state?.expiry) return false;
  if (Date.now() >= state.expiry) {
    clearAuthState();
    return false;
  }
  try {
    await ensureGoogleClient(clientId);
    currentToken = state.access_token;
    tokenExpiry = state.expiry;
    window.gapi.client.setToken({ access_token: currentToken });

    // 用 fetch 驗證 token 有效性，避免依賴 gapi.client.drive
    const testResp = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)',
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );
    if (!testResp.ok) throw new Error('Token validation failed');

    return true;
  } catch {
    clearAuthState();
    return false;
  }
}

export async function ensureAccessToken() {
  ensureScriptsLoaded();
  if (storedClientId) await ensureGoogleClient(storedClientId);
  if (!tokenClient) throw new Error('Google client not initialized');

  if (isTokenValid()) {
    window.gapi.client.setToken({ access_token: currentToken });
    return { access_token: currentToken };
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
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

  // 同時搜尋壓縮版與非壓縮版
  const q = encodeURIComponent(
    `(name='${baseName}.json.gz' or name='${safeName}') and '${folderId}' in parents and trashed=false`
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
  const safeName = name.replace(/'/g, "\\'");

  const q = encodeURIComponent(
    `(name='${baseName}.json.gz' or name='${safeName}') and '${folderId}' in parents and trashed=false`
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
