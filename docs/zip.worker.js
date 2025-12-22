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
      
      // 建立基本物件資料
      const itemData = {
        id: itemConfig.itemId, // **修改**: 使用 itemId 作為唯一 ID
        displayName: itemConfig.displayName,
        category: itemConfig.category,
        characterId: itemConfig.characterId || null,
        tags: itemConfig.tags || [],  // 處理標籤
        packId: config.packId, // **修改**: 使用 packId
        packDisplayName: config.packDisplayName,
        imageData: `data:${mimeType};base64,${fileData}`,
      };
      
      // 處理自定義人物名稱
      if (itemConfig.characterName) {
        itemData.characterName = itemConfig.characterName;
      }

      // 處理變體資料 (如果有)
      if (itemConfig.hasVariant && itemConfig.variants && itemConfig.variants.length > 0) {
        itemData.hasVariant = true;
        itemData.defaultVariant = itemConfig.defaultVariant;
        itemData.variants = itemConfig.variants;
        itemData.variantImages = {};

        // 載入各變體圖片
        if (itemConfig.variantFiles) {
          for (const [variantKey, variantFileName] of Object.entries(itemConfig.variantFiles)) {
            const variantImageFile = zip.file(variantFileName);
            if (variantImageFile) {
              const variantFileData = await variantImageFile.async('base64');
              const variantMimeType = getMimeType(variantFileName);
              itemData.variantImages[variantKey] = `data:${variantMimeType};base64,${variantFileData}`;
            } else {
              console.warn(`Variant image file not found: ${variantFileName}`);
            }
          }
        }

        // 如果有預設變體且有對應圖片，使用預設變體的圖片
        if (itemData.defaultVariant && itemData.variantImages[itemData.defaultVariant]) {
          itemData.imageData = itemData.variantImages[itemData.defaultVariant];
        }
      }

      items.push(itemData);
      
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
      description: config.description,
      characters: config.characters || []
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