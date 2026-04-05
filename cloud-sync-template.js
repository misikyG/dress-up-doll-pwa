/**
 * ============================================================
 *  Google Drive 雲端同步模組（通用模板）
 * ============================================================
 *
 *  功能：
 *   - Google OAuth2 登入 / 登出 / 自動恢復登入
 *   - Google Drive 資料夾偵測 / 自動建立
 *   - JSON 檔案上傳（含 Gzip 壓縮）與下載
 *   - 最多保留 5 筆備份，自動清理舊檔
 *
 *  使用前置條件：
 *   1. 在 Google Cloud Console 建立 OAuth2 Client ID（Web 應用程式）
 *   2. 在 HTML 中載入 Google API 腳本：
 *      <script src="https://accounts.google.com/gsi/client" async defer></script>
 *      <script src="https://apis.google.com/js/api.js" async defer></script>
 *
 *  佔位符說明（以 【PLACEHOLDER】 標示）：
 *   - 搜尋 "【PLACEHOLDER】" 找到所有需要自定義的位置
 *   - 必須替換的部分會標示 【PLACEHOLDER: 必填】
 *   - 可選替換的部分會標示 【PLACEHOLDER: 可選】
 *
 * ============================================================
 */

// ============================================================
//  googleDrive.js — 核心 Google Drive API 封裝
// ============================================================

const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

// 【PLACEHOLDER: 必填】localStorage 儲存鍵名，改成你專案的名稱以避免衝突
const STORAGE_KEY = 'your_app_google_drive_auth';

// 【PLACEHOLDER: 可選】最多保留的備份數量（目前為 5）
const MAX_BACKUPS = 5;

// 【PLACEHOLDER: 必填】Google Drive 上的資料夾名稱，改成你的專案名稱
const FOLDER_NAME = 'your-app-name';

let tokenClient = null;
let gapiReady = false;
let initializing = null;
let currentToken = null;
let tokenExpiry = 0;
let storedClientId = null;
let cachedFolderId = null;

// ---- 內部工具函式 ----

const ensureScriptsLoaded = () => {
  if (typeof window === 'undefined') throw new Error('Google APIs unavailable in SSR');
  if (!window.gapi || !window.google) throw new Error('Google API scripts not loaded');
};

const saveAuthState = (token, expiry) => {
  try {
    const data = { hasAuth: true, ts: Date.now() };
    if (token) {
      data.access_token = token;
      data.expiry = expiry;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

// ---- Google Client 初始化 ----

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

// ---- Token 管理 ----

export function isTokenValid() {
  return !!currentToken && Date.now() < tokenExpiry;
}

export function hasPreviousAuth() {
  const state = loadAuthState();
  return !!state?.hasAuth;
}

/**
 * 嘗試從 localStorage 恢復登入狀態（絕不會觸發任何 OAuth 彈窗）。
 * 只有當儲存的 token 尚未過期且驗證通過時才回傳 true。
 * token 過期時直接回傳 false，保留 hasAuth 標記供後續使用。
 */
export async function tryRestoreSession(clientId) {
  if (clientId) storedClientId = clientId;
  const state = loadAuthState();
  if (!state?.hasAuth) return false;

  const tokenExpired = !state.access_token || !state.expiry || Date.now() >= state.expiry;

  // token 已過期 → 不嘗試刷新（requestAccessToken 會彈出登入視窗）
  // 保留 hasAuth 標記，讓 UI 知道曾經登入過，使用者操作時再靜默刷新
  if (tokenExpired) {
    currentToken = null;
    tokenExpiry = 0;
    return false;
  }

  try {
    await ensureGoogleClient(clientId);

    currentToken = state.access_token;
    tokenExpiry = state.expiry;
    window.gapi.client.setToken({ access_token: currentToken });

    // 驗證 token 是否仍有效
    const testResp = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)',
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );
    if (testResp.ok) return true;

    currentToken = null;
    tokenExpiry = 0;
    return false;
  } catch {
    currentToken = null;
    tokenExpiry = 0;
    return false;
  }
}

/**
 * 確保取得有效的 access token。
 * 若 token 已過期，會嘗試靜默刷新（prompt: ''），
 * 這可能會短暫開啟 popup（當使用者有活躍 Google 瀏覽器 session 時會自動關閉）。
 * 適合在使用者主動觸發操作時（如上傳/下載按鈕）呼叫。
 */
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
      tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
      window.gapi.client.setToken({ access_token: currentToken });
      saveAuthState(currentToken, tokenExpiry);
      resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * 互動式登入（強制 consent 畫面）。
 * 適合首次登入或使用者點擊「登入」按鈕時使用。
 */
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

export function signOut() {
  if (currentToken) {
    try {
      window.google.accounts.oauth2.revoke(currentToken, () => {});
    } catch { /* ignore */ }
  }
  clearAuthState();
  try { window.gapi?.client?.setToken(null); } catch { /* ignore */ }
}

// ---- Google Drive 資料夾管理 ----

async function ensureFolder() {
  if (!currentToken) throw new Error('No access token available');
  if (cachedFolderId) return cachedFolderId;

  // 搜尋現有資料夾
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
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

// ---- 上傳 / 下載 / 列表 / 刪除 ----

export async function uploadJsonFile({ name, json }) {
  if (!currentToken) throw new Error('No access token available');

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

  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  // Resumable upload Step 1
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

  // Resumable upload Step 2
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

  if (file.name.endsWith('.gz')) {
    const blob = await response.blob();
    const decompressed = await decompressGzip(blob);
    if (decompressed) return JSON.parse(decompressed);
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


// ============================================================
//  Vue 元件整合範例（使用架構）
// ============================================================
//
//  以下範例展示如何在 Vue 3 元件中整合上方的 googleDrive 模組。
//  將下方程式碼複製到你的 Vue 元件 <script setup> 區塊中。
//
// ============================================================

/*
// ---- HTML Template ----
// 將以下 HTML 放到你的 Vue 元件 <template> 中

<div class="settings-section">
  <h4>
    <span class="section-icon">☁️</span>
    雲端同步（Google Drive）
  </h4>

  <div class="cloud-status" :class="{ connected: isGoogleReady }">
    <span class="status-dot"></span>
    <span v-if="isGoogleReady" class="status-text">已連線 Google 雲端</span>
    <span v-else class="status-text">尚未連線</span>
  </div>

  <div class="cloud-actions">
    <template v-if="!isGoogleReady">
      <button class="primary-btn" @click="connectGoogle" :disabled="isCloudBusy">
        {{ isCloudBusy ? '連線中...' : '登入 Google' }}
      </button>
    </template>
    <template v-else>
      <button class="secondary-btn" @click="uploadToDrive" :disabled="isCloudBusy">
        {{ isCloudBusy ? '處理中...' : '上傳備份到雲端' }}
      </button>
      <button class="secondary-btn" @click="syncFromDrive" :disabled="isCloudBusy">
        {{ isCloudBusy ? '處理中...' : '從雲端還原' }}
      </button>
      <label class="auto-backup-toggle">
        <input type="checkbox" :checked="autoBackupEnabled" @change="toggleAutoBackup" />
        <span>定時自動備份（每 5 分鐘）</span>
      </label>
      <p v-if="autoBackupEnabled" class="auto-backup-status hint">
        ⏱ 自動備份已啟用{{ nextAutoBackupText }}
      </p>
      <button class="danger-btn small" @click="disconnectGoogle">登出 Google</button>
    </template>
  </div>
  <p class="hint">
    備份資料存放於 Google Drive「__FOLDER_NAME__」資料夾中，最多保留最新 5 筆備份。
    <!-- 【PLACEHOLDER: 必填】將 __FOLDER_NAME__ 替換為你上方設定的 FOLDER_NAME -->
  </p>
</div>
*/

/*
// ---- Script Setup ----

import { ref, onMounted, onUnmounted } from 'vue';
import {
  ensureAccessToken,
  uploadJsonFile,
  downloadLatestJson,
  signOut,
  hasPreviousAuth,
  pruneOldBackups,
  tryRestoreSession,
  interactiveSignIn,
  isTokenValid,
  listBackupFiles,
  deleteFile as deleteGDriveFile
} from './googleDrive.js'; // 【PLACEHOLDER: 必填】調整路徑

// 【PLACEHOLDER: 必填】替換為你的 Google OAuth2 Client ID
const GOOGLE_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';

// 【PLACEHOLDER: 必填】替換為你備份檔的基本名稱
const BACKUP_FILENAME = 'your-app-backup.json';

const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 分鐘

const isGoogleReady = ref(false);
const isCloudBusy = ref(false);
const autoBackupEnabled = ref(false);
const nextAutoBackupText = ref('');
let autoBackupTimer = null;
let autoBackupCountdownTimer = null;
let autoBackupNextTime = 0;

// ---- 登入 / 登出 ----

const connectGoogle = async () => {
  isCloudBusy.value = true;
  try {
    if (hasPreviousAuth()) {
      // 曾經登入過：先嘗試靜默刷新（不強制重新授權）
      try {
        await ensureAccessToken();
        isGoogleReady.value = true;
        // 恢復自動備份設定
        try {
          const saved = localStorage.getItem('auto-backup-enabled');
          if (saved === 'true') startAutoBackup(true);
        } catch {}
        // 【PLACEHOLDER: 可選】替換為你專案的通知方式
        console.log('已重新連線 Google');
        return;
      } catch {
        // 靜默刷新失敗，執行完整互動式登入
      }
    }
    await interactiveSignIn(GOOGLE_CLIENT_ID);
    isGoogleReady.value = true;
    console.log('已登入 Google'); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
  } catch (err) {
    console.error(err);
    console.error('Google 登入失敗'); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
  } finally {
    isCloudBusy.value = false;
  }
};

const disconnectGoogle = () => {
  signOut();
  isGoogleReady.value = false;
  stopAutoBackup();
  console.log('已登出 Google'); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
};

// ---- 恢復登入狀態（onMounted 時呼叫，不會觸發任何彈窗）----

const restoreSession = async () => {
  if (isGoogleReady.value) return;
  if (!hasPreviousAuth()) return;
  isCloudBusy.value = true;
  try {
    const ok = await tryRestoreSession(GOOGLE_CLIENT_ID);
    if (ok) {
      isGoogleReady.value = true;
      try {
        const saved = localStorage.getItem('auto-backup-enabled');
        if (saved === 'true') startAutoBackup(true);
      } catch {}
    }
  } catch { /* 恢復失敗不提示 */ }
  finally { isCloudBusy.value = false; }
};

// ---- 備份檔名生成（帶時間編碼）----

const getTimestampedBackupName = () => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = String(hours).padStart(2, '0') + minutes + ampm;
  // 【PLACEHOLDER: 可選】替換備份檔名前綴
  return `your-app-backup-${timeStr}`;
};

// ---- 上傳備份 ----

const uploadToDrive = async () => {
  isCloudBusy.value = true;
  try {
    await ensureAccessToken();

    // 【PLACEHOLDER: 必填】組裝你專案的備份資料
    const payload = {
      type: 'full-backup',
      exportedAt: new Date().toISOString(),
      // ...你的資料欄位...
      // 例如：
      // settings: getSettings(),
      // records: getRecords(),
      schemaVersion: 1,
    };

    const backupName = getTimestampedBackupName();
    await uploadJsonFile({ name: `${backupName}.json`, json: payload });

    // 清理舊備份（保留最新 5 筆）
    await pruneOldBackups({ name: BACKUP_FILENAME, keep: 5 });
    // 也清理時間編碼的備份
    await pruneTimedBackups();

    console.log(`已上傳備份 ${backupName}`); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
  } catch (err) {
    console.error('雲端上傳失敗:', err);
    if (!isTokenValid()) isGoogleReady.value = false;
    // 【PLACEHOLDER: 可選】加入錯誤處理 UI
  } finally {
    isCloudBusy.value = false;
  }
};

// ---- 從雲端還原 ----

const syncFromDrive = async () => {
  isCloudBusy.value = true;
  try {
    await ensureAccessToken();
    const data = await downloadLatestJson({ name: BACKUP_FILENAME });
    if (!data) {
      console.log('雲端沒有備份檔'); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
      return;
    }
    if (!confirm('從雲端還原將覆蓋本機所有資料，確定要繼續嗎？')) return;

    // 【PLACEHOLDER: 必填】實作你專案的還原邏輯
    // 例如：
    // await clearAllData();
    // await restoreSettings(data.settings);
    // await restoreRecords(data.records);

    console.log('已從雲端同步完成'); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
  } catch (err) {
    console.error('雲端同步失敗:', err);
    if (!isTokenValid()) isGoogleReady.value = false;
    // 【PLACEHOLDER: 可選】加入錯誤處理 UI
  } finally {
    isCloudBusy.value = false;
  }
};

// ---- 自動備份 ----

const toggleAutoBackup = (event) => {
  if (event.target.checked) {
    const confirmed = confirm(
      '⚠️ 注意：啟用自動備份後，系統將每 5 分鐘自動上傳備份至雲端。\n\n' +
      '新的備份可能會覆蓋較舊的備份檔案（僅保留最新 5 筆）。\n' +
      '請確認您了解此機制，再決定是否啟用。'
    );
    if (confirmed) {
      startAutoBackup(false);
    } else {
      event.target.checked = false;
    }
  } else {
    stopAutoBackup();
  }
};

const startAutoBackup = (silent = false) => {
  autoBackupEnabled.value = true;
  try { localStorage.setItem('auto-backup-enabled', 'true'); } catch {}

  autoBackupNextTime = Date.now() + AUTO_BACKUP_INTERVAL;
  updateCountdownText();

  autoBackupCountdownTimer = setInterval(updateCountdownText, 30000);

  autoBackupTimer = setInterval(async () => {
    if (!isGoogleReady.value || isCloudBusy.value) return;
    try {
      await performAutoBackup();
      autoBackupNextTime = Date.now() + AUTO_BACKUP_INTERVAL;
    } catch (err) {
      console.warn('自動備份失敗:', err);
    }
  }, AUTO_BACKUP_INTERVAL);

  if (!silent) {
    console.log('已啟用自動備份'); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
  }
};

const stopAutoBackup = () => {
  autoBackupEnabled.value = false;
  try { localStorage.setItem('auto-backup-enabled', 'false'); } catch {}
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
  if (autoBackupCountdownTimer) { clearInterval(autoBackupCountdownTimer); autoBackupCountdownTimer = null; }
  nextAutoBackupText.value = '';
};

const updateCountdownText = () => {
  const remaining = Math.max(0, autoBackupNextTime - Date.now());
  const mins = Math.ceil(remaining / 60000);
  nextAutoBackupText.value = mins > 0 ? `（下次備份約 ${mins} 分鐘後）` : '（即將備份...）';
};

const performAutoBackup = async () => {
  isCloudBusy.value = true;
  try {
    await ensureAccessToken();

    // 【PLACEHOLDER: 必填】組裝你專案的備份資料（同 uploadToDrive）
    const payload = {
      type: 'full-backup',
      exportedAt: new Date().toISOString(),
      // ...你的資料欄位...
      schemaVersion: 1,
    };

    const backupName = getTimestampedBackupName();
    await uploadJsonFile({ name: `${backupName}.json`, json: payload });
    await pruneOldBackups({ name: BACKUP_FILENAME, keep: 5 });
    await pruneTimedBackups();

    console.log('自動備份完成'); // 【PLACEHOLDER: 可選】替換為你專案的通知方式
  } catch (err) {
    console.error('自動備份失敗:', err);
    if (!isTokenValid()) {
      isGoogleReady.value = false;
      stopAutoBackup();
    }
  } finally {
    isCloudBusy.value = false;
  }
};

const pruneTimedBackups = async () => {
  try {
    // 【PLACEHOLDER: 必填】替換 'your-app-backup' 為你的備份檔名前綴
    const files = await listBackupFiles({ name: 'your-app-backup' });
    if (files.length > 5) {
      const toDelete = files.slice(5);
      for (const f of toDelete) {
        try { await deleteGDriveFile(f.id); } catch {}
      }
    }
  } catch {}
};

// ---- 生命週期 ----

onMounted(() => {
  restoreSession(); // 不會觸發任何彈窗
});

onUnmounted(() => {
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
  if (autoBackupCountdownTimer) { clearInterval(autoBackupCountdownTimer); autoBackupCountdownTimer = null; }
});
*/


// ============================================================
//  CSS 樣式
// ============================================================
//
//  將以下 CSS 放到你的元件 <style scoped> 或全域樣式中。
//  使用 CSS 變數以便融入你的主題系統。
//
// ============================================================

/*
<!-- CSS 變數前置需求（在 :root 或你的主題系統中定義） -->
:root {
  --color-bg-main: #f5f5f5;
  --color-border: #ddd;
  --color-text-primary: #333;
  --color-text-secondary: #888;
  --color-success: #4caf50;
  --color-primary: #7c6fad;
  --color-error: #e53e3e;
  --color-warning: #f0ad4e;
  --radius-sm: 6px;
}

.cloud-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-main);
  border: 1px solid var(--color-border);
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.cloud-status .status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  flex-shrink: 0;
}

.cloud-status.connected .status-dot {
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.cloud-status .status-text {
  color: var(--color-text-secondary);
}

.cloud-status.connected .status-text {
  color: var(--color-success);
  font-weight: 600;
}

.cloud-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.auto-backup-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-primary);
  width: 100%;
  padding: 0.4rem 0;
}

.auto-backup-status {
  margin-top: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.hint {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  margin-top: 0.5rem;
}

.danger-btn.small {
  padding: 0.4rem 0.8rem;
  font-size: 0.78rem;
}

/* 手機響應式 */
@media (max-width: 600px) {
  .cloud-actions {
    flex-direction: column;
  }
  .cloud-actions button {
    width: 100%;
  }
}
*/


// ============================================================
//  登入持久化機制說明
// ============================================================
//
//  本模組的登入持久化邏輯如下：
//
//  1. 使用者登入後，access_token 與過期時間存入 localStorage
//     （鍵名為 STORAGE_KEY，格式：{ hasAuth, access_token, expiry }）
//
//  2. 頁面重新整理或重新開啟時：
//     - onMounted 呼叫 restoreSession()
//     - restoreSession → tryRestoreSession()
//     - 若 token 尚未過期 → 以 API 驗證 → 成功則自動恢復連線（無彈窗）
//     - 若 token 已過期 → 直接回傳 false（不彈窗），保留 hasAuth 標記
//
//  3. 使用者點擊「登入 Google」時：
//     - connectGoogle() 檢查 hasPreviousAuth()
//     - 若曾經登入 → 先試 ensureAccessToken()（prompt: ''，可能短暫彈窗自動關閉）
//     - 若靜默刷新失敗 → 再試 interactiveSignIn()（完整授權）
//     - 若從未登入 → 直接 interactiveSignIn()
//
//  4. 只有使用者手動點擊「登出」才會清除 localStorage 憑證
//
//  ⚠️ Google OAuth2 client-side token 有效期約 1 小時。
//     超過 1 小時後，需要使用者觸發操作來取得新 token。
//     本模組設計為：開設定時不彈窗，操作時才靜默刷新。
//
// ============================================================
