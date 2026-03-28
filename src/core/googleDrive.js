const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const STORAGE_KEY = 'google_drive_auth';
const MAX_BACKUPS = 5;

let tokenClient = null;
let gapiReady = false;
let initializing = null;
let currentToken = null;
let tokenExpiry = 0;

/* ── 內部工具 ── */

const ensureScriptsLoaded = () => {
  if (typeof window === 'undefined') throw new Error('Google APIs unavailable in SSR');
  if (!window.gapi || !window.google) throw new Error('Google API scripts not loaded');
};

/**
 * 儲存認證狀態，包含 access_token 與到期時間。
 * 這讓重新整理（F5）後仍能保持登入。
 */
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

/* ── 初始化 ── */

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

/* ── Token 管理 ── */

/** 檢查目前是否有有效的 access token */
export function isTokenValid() {
  return !!currentToken && Date.now() < tokenExpiry;
}

/** 檢查使用者是否曾經登入過（localStorage 記錄） */
export function hasPreviousAuth() {
  const state = loadAuthState();
  return !!state?.hasAuth;
}

/**
 * 嘗試從 localStorage 恢復 token（不觸發任何 OAuth 彈窗）。
 * 只在 token 尚未過期時才能成功。
 * @returns {boolean} true 代表成功恢復，false 代表需要重新登入。
 */
export async function tryRestoreSession(clientId) {
  const state = loadAuthState();
  if (!state?.access_token || !state?.expiry) return false;
  // token 已過期
  if (Date.now() >= state.expiry) {
    clearAuthState();
    return false;
  }
  try {
    await ensureGoogleClient(clientId);
    // 直接設定儲存的 token，不觸發 popup
    currentToken = state.access_token;
    tokenExpiry = state.expiry;
    window.gapi.client.setToken({ access_token: currentToken });

    // 快速驗證 token 是否真的還有效（輕量 API 呼叫）
    await window.gapi.client.drive.files.list({
      pageSize: 1,
      spaces: 'appDataFolder',
      fields: 'files(id)'
    });

    return true;
  } catch {
    // token 已失效（被撤銷或過期）
    clearAuthState();
    return false;
  }
}

export async function ensureAccessToken() {
  ensureScriptsLoaded();
  if (!tokenClient) throw new Error('Google client not initialized');

  // 如果 token 還有效就直接用
  if (isTokenValid()) {
    window.gapi.client.setToken({ access_token: currentToken });
    return { access_token: currentToken };
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      // 儲存 token 與到期時間
      currentToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000; // 提前 1 分鐘
      saveAuthState(currentToken, tokenExpiry);
      resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * 互動式登入（由使用者點擊觸發）。
 * 使用 prompt: 'consent' 以確保顯示 Google 登入畫面。
 */
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
    // 使用 'consent' 確保顯示 Google 帳號選擇/授權畫面
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * 嘗試靜默登入（不彈出授權視窗）。
 * 若使用者曾授權過，瀏覽器通常會自動給予新 token。
 * 回傳 true 代表成功，false 代表需要互動式登入。
 */
export async function trySilentAuth(clientId) {
  try {
    await ensureGoogleClient(clientId);
    await ensureAccessToken();
    return true;
  } catch {
    return false;
  }
}

/** 登出並撤銷授權 */
export function signOut() {
  if (currentToken) {
    try {
      window.google.accounts.oauth2.revoke(currentToken, () => {});
    } catch { /* ignore */ }
  }
  clearAuthState();
  // 清除 gapi token
  try { window.gapi?.client?.setToken(null); } catch { /* ignore */ }
}

/* ── 檔案操作 ── */

/**
 * 上傳 JSON 檔案到 Google Drive appDataFolder。
 * 使用 fetch + FormData 以避免 btoa() 大小限制與 gapi multipart 編碼問題。
 */
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

/**
 * 列出雲端所有指定名稱的備份檔案，按修改時間降序。
 */
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

/**
 * 刪除指定的 Google Drive 檔案。
 */
export async function deleteFile(fileId) {
  await window.gapi.client.drive.files.delete({ fileId });
}

/**
 * 僅保留最新的 N 筆備份，刪除其餘。
 * @returns {number} 刪除的檔案數量
 */
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
