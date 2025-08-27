// 引入 jszip 庫
self.importScripts('jszip.min.js');

self.onmessage = async (event) => {
  const { file } = event.data;

  if (!file) {
    self.postMessage({ error: 'No file received' });
    return;
  }

  try {
    const zip = await self.JSZip.loadAsync(file);
    const configEntry = zip.file('config.json');

    if (!configEntry) {
      throw new Error('config.json not found in the zip file.');
    }

    const configContent = await configEntry.async('string');
    const config = JSON.parse(configContent);

    // **開始修改：使用新的 ID 欄位**
    const items = [];
    let processedCount = 0;

    for (const itemConfig of config.items) {
      const imageFile = zip.file(itemConfig.file);
      if (!imageFile) {
        console.warn(`Image file not found: ${itemConfig.file}`);
        continue;
      }
      
      const fileData = await imageFile.async('base64');
      const mimeType = getMimeType(itemConfig.file);
      
      items.push({
        id: itemConfig.itemId, // **修改**: 使用 itemId 作為唯一 ID
        displayName: itemConfig.displayName,
        category: itemConfig.category,
        characterId: itemConfig.characterId || null,
        packId: config.packId, // **修改**: 使用 packId
        packDisplayName: config.packDisplayName,
        imageData: `data:${mimeType};base64,${fileData}`,
      });
      
      processedCount++;
      self.postMessage({ 
        type: 'progress', 
        progress: (processedCount / config.items.length) * 100,
        message: `正在處理 ${itemConfig.displayName}`
      });
    }

    self.postMessage({ type: 'success', items, packInfo: {
      id: config.packId, // **修改**: 使用 packId 作為主鍵
      displayName: config.packDisplayName,
      description: config.description
    }});
    // **結束修改**

  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};

function getMimeType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}