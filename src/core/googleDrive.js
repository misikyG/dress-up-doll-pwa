const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const STORAGE_KEY = 'google_drive_auth';
const MAX_BACKUPS = 5;

let tokenClient = null;
let gapiReady = false;
let initializing = null;
let currentToken = null;
let tokenExpiry = 0;

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

    await window.gapi.client.drive.files.list({
      pageSize: 1,
      spaces: 'appDataFolder',
      fields: 'files(id)'
    });

    return true;
  } catch {
    clearAuthState();
    return false;
  }
}

export async function ensureAccessToken() {
  ensureScriptsLoaded();
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
  const token = window.gapi.client.getToken();
  if (!token?.access_token) throw new Error('No access token available');

  const metadata = { name, parents: ['appDataFolder'] };
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([JSON.stringify(json)], { type: 'application/json' })
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.access_token}` },
      body: form,
    }
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Upload failed (${response.status}): ${errBody}`);
  }

  return response.json();
}

export async function downloadLatestJson({ name }) {
  const queryParts = [`name='${name.replace(/'/g, "\\'")}'`, "'appDataFolder' in parents"];
  const list = await window.gapi.client.drive.files.list({
    pageSize: 1,
    orderBy: 'modifiedTime desc',
    q: queryParts.join(' and '),
    fields: 'files(id, name)'
  });
  const file = list.result.files?.[0];
  if (!file) return null;

  // 使用 fetch 下載，避免 gapi 對大型回應的處理問題
  const token = window.gapi.client.getToken();
  if (!token?.access_token) throw new Error('No access token available');

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token.access_token}` } }
  );
  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Download failed (${response.status}): ${errBody}`);
  }
  return response.json();
}

export async function listBackupFiles({ name }) {
  const queryParts = [`name='${name.replace(/'/g, "\\'")}'`, "'appDataFolder' in parents"];
  const list = await window.gapi.client.drive.files.list({
    pageSize: 100,
    orderBy: 'modifiedTime desc',
    q: queryParts.join(' and '),
    fields: 'files(id, name, modifiedTime, size)'
  });
  return list.result.files || [];
}

export async function deleteFile(fileId) {
  await window.gapi.client.drive.files.delete({ fileId });
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
