const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const STORAGE_KEY = 'google_drive_auth';
const MAX_BACKUPS = 5;

let tokenClient = null;
let gapiReady = false;
let initializing = null;
let currentToken = null;
let tokenExpiry = 0;
let storedClientId = null;

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
      'https://www.googleapis.com/drive/v3/files?pageSize=1&spaces=appDataFolder&fields=files(id)',
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

export async function uploadJsonFile({ name, json }) {
  if (!currentToken) throw new Error('No access token available');

  const metadata = JSON.stringify({ name, parents: ['appDataFolder'] });
  const fileBody = JSON.stringify(json);

  // Step 1: 發起 resumable upload（無 5MB 大小限制）
  const initResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/json; charset=UTF-8',
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
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: fileBody,
  });

  if (!uploadResp.ok) {
    const errBody = await uploadResp.text().catch(() => '');
    throw new Error(`Upload failed (${uploadResp.status}): ${errBody}`);
  }

  return uploadResp.json();
}

export async function downloadLatestJson({ name }) {
  if (!currentToken) throw new Error('No access token available');

  // 使用 fetch 列出檔案，避免依賴 gapi.client.drive 可能未初始化的問題
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and 'appDataFolder' in parents`);
  const listResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=1&orderBy=modifiedTime%20desc&q=${q}&spaces=appDataFolder&fields=files(id,name)`,
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
  return response.json();
}

export async function listBackupFiles({ name }) {
  if (!currentToken) throw new Error('No access token available');

  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and 'appDataFolder' in parents`);
  const listResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=100&orderBy=modifiedTime%20desc&q=${q}&spaces=appDataFolder&fields=files(id,name,modifiedTime,size)`,
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
