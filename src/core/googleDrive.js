const DRIVE_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let tokenClient = null;
let gapiReady = false;
let initializing = null;

const ensureScriptsLoaded = () => {
  if (typeof window === 'undefined') throw new Error('Google APIs unavailable in SSR');
  if (!window.gapi || !window.google) throw new Error('Google API scripts not loaded');
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

export async function ensureAccessToken() {
  ensureScriptsLoaded();
  if (!tokenClient) throw new Error('Google client not initialized');
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export async function uploadJsonFile({ name, json }) {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = { name, parents: ['appDataFolder'] };
  const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(json))));
  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    closeDelim;

  const res = await window.gapi.client.request({
    path: '/upload/drive/v3/files',
    method: 'POST',
    params: { uploadType: 'multipart' },
    headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
    body: multipartRequestBody,
  });
  return res.result;
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
  const content = await window.gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
  return content.result;
}
