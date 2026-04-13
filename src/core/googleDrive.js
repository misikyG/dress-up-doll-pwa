import { auth } from './firebase.js';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY = 'google_drive_auth';
const IDB_NAME = 'dress-up-doll-auth';
const IDB_STORE = 'auth';
const IDB_KEY = 'google_drive_auth';
const MAX_BACKUPS = 5;
const FOLDER_NAME = 'dress-up-doll';

let currentToken = null;
let tokenExpiry = 0;
let cachedFolderId = null;

// ---- Firebase Auth 狀態監聽 ----

let _authReadyResolve;
const _authReadyPromise = new Promise(resolve => { _authReadyResolve = resolve; });
let _firebaseUser = undefined; // undefined = 尚未載入

onAuthStateChanged(auth, (user) => {
  _firebaseUser = user;
  if (!user) {
    // 使用者登出 → 清除 token 快取
    currentToken = null;
    tokenExpiry = 0;
    cachedFolderId = null;
    _clearTokenCache();
  }
  _authReadyResolve(user);
});

/** 等待 Firebase Auth 完成初始化（第一次 onAuthStateChanged 觸發） */
async function waitForAuth() {
  if (_firebaseUser !== undefined) return _firebaseUser;
  return _authReadyPromise;
}

// ---- Token 快取（localStorage + IndexedDB 雙重持久化）----
// 用於快取 Google access token，讓頁面重整後 1 小時內不用再開 popup

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

function _saveTokenCache(token, expiry) {
  const data = { access_token: token, expiry };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  _saveToIDB(data);
}

async function _loadTokenCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const idb = await _loadFromIDB();
  if (idb) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(idb)); } catch { /* ignore */ }
  }
  return idb;
}

function _clearTokenCache() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  _clearIDB();
}

// ---- 公開 API：認證 ----

export function isTokenValid() {
  return !!currentToken && Date.now() < tokenExpiry;
}

/**
 * 等待 Firebase Auth 初始化後，回傳是否有登入中的使用者。
 * 不觸發任何 popup，不做任何 API 呼叫。
 */
export async function tryRestoreSession() {
  const user = await waitForAuth();
  if (!user) return false;

  // 嘗試從快取恢復 Google access token（頁面重整後 1 小時內有效）
  const cached = await _loadTokenCache();
  if (cached?.access_token && cached?.expiry && Date.now() < cached.expiry) {
    currentToken = cached.access_token;
    tokenExpiry = cached.expiry;
  }

  return 'remembered';
}

/** 同步檢查（Firebase 初始化完成後才準確） */
export function hasPreviousAuth() {
  return !!auth.currentUser;
}

/** 非同步版本（等待 Firebase 初始化） */
export async function hasPreviousAuthAsync() {
  const user = await waitForAuth();
  return !!user;
}

/**
 * 互動式登入：開啟 Google 登入彈窗，取得 access token。
 * 首次使用或需要重新授權時呼叫。
 */
export async function interactiveSignIn() {
  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error('未取得 Google access token');

  currentToken = credential.accessToken;
  tokenExpiry = Date.now() + 3540000; // ~59 分鐘（Google access token 有效期約 1 小時）
  _saveTokenCache(currentToken, tokenExpiry);
  return result;
}

/**
 * 確保有有效的 access token。
 * - 有快取且未過期 → 直接用
 * - 快取過期但有 Firebase 使用者 → 開 popup 取新 token（若 Google session 還在會快速自動完成）
 * - 無 Firebase 使用者 → 拋出錯誤
 */
export async function ensureAccessToken() {
  if (isTokenValid()) {
    return { access_token: currentToken };
  }

  if (!auth.currentUser) throw new Error('尚未登入');

  // Token 過期 → 用 signInWithPopup 取得新 token
  // 設定 login_hint 讓 Google 自動選擇帳號，減少使用者操作
  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);
  provider.setCustomParameters({ login_hint: auth.currentUser.email });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error('未取得 Google access token');

  currentToken = credential.accessToken;
  tokenExpiry = Date.now() + 3540000;
  _saveTokenCache(currentToken, tokenExpiry);
  return { access_token: currentToken };
}

/**
 * 確保有效 token：先嘗試快取/靜默取得，失敗則 fallback 到完整互動式登入。
 * 是雲端操作的主要進入點 — 使用者不會因 token 過期而被登出。
 */
export async function ensureAccessTokenOrInteractive() {
  try {
    return await ensureAccessToken();
  } catch {
    return await interactiveSignIn();
  }
}

export function signOut() {
  currentToken = null;
  tokenExpiry = 0;
  cachedFolderId = null;
  _clearTokenCache();
  firebaseSignOut(auth).catch(() => {});
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
