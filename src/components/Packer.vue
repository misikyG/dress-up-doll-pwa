<template>
  <div class="packer-container">
    <header class="packer-header">
      <h1>🎨 紙娃娃圖包打包器 (智慧ID版)</h1>
    </header>

    <main class="packer-main">
      <section class="control-panel">
        <h2>圖包資訊</h2>
        <div class="form-group">
          <label for="packDisplayName">圖包名稱</label>
          <input id="packDisplayName" v-model="packInfo.packDisplayName" placeholder="e.g., 2024夏日泳裝" />
        </div>
        <div class="form-group">
          <label for="packDescription">圖包描述</label>
          <textarea id="packDescription" v-model="packInfo.description" placeholder="e.g., 清涼一夏！"></textarea>
        </div>
        <button @click="generateZip" :disabled="items.length === 0 || !packInfo.packDisplayName" class="generate-btn">
          生成 ZIP 圖包
        </button>
        <div class="packer-footer">
          <p>版本 v2.0</p>
        </div>
      </section>

      <section class="items-panel">
        <div class="drop-zone" @dragover.prevent @drop.prevent="handleFileDrop" @click="openFilePicker">
          <p>點擊或拖放圖片至此</p>
          <input type="file" ref="fileInput" @change="handleFileSelect" multiple accept="image/png, image/jpeg, image/webp" style="display: none;" />
        </div>
        
        <div class="items-list">
          <div v-for="(item, index) in items" :key="item.id" class="item-card">
            <img :src="item.previewUrl" class="item-preview" />
            <div class="item-form">
              <input v-model="item.displayName" placeholder="物件顯示名稱" class="display-name-input" />
              <select v-model="item.category">
                <option v-for="cat in categories" :key="cat.key" :value="cat.key">{{ cat.name }}</option>
              </select>
              <div v-if="item.category === 'expression'" class="character-id-input">
                 <select v-model="item.characterId">
                   <option value="">選擇綁定的角色</option>
                   <option v-for="char in characterItems" :key="char.id" :value="char.id">
                     {{ char.displayName }}
                   </option>
                 </select>
              </div>
            </div>
            <button @click="removeItem(index)" class="remove-btn">×</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import JSZip from 'jszip';

const fileInput = ref(null);
const packInfo = reactive({
  packDisplayName: '',
  description: '',
});
const items = ref([]);
const categories = ref([
    { key: 'background', name: '背景' }, { key: 'character', name: '角色' },
    { key: 'expression', name: '表情' }, { key: 'hair', name: '頭髮' },
    { key: 'outer', name: '外套' }, { key: 'top', name: '上衣' },
    { key: 'bottom', name: '下身' }, { key: 'dress', name: '套裝' },
    { key: 'shoes', name: '鞋子' }, { key: 'accessory', name: '配件' },
    { key: 'other', name: '其他' }
]);

const characterItems = computed(() => items.value.filter(item => item.category === 'character'));

const openFilePicker = () => fileInput.value.click();
const handleFileSelect = (e) => { addFiles(e.target.files); e.target.value = ''; };
const handleFileDrop = (e) => { addFiles(e.dataTransfer.files); };

const addFiles = (files) => {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = (e) => {
      const originalName = file.name.split('.').slice(0, -1).join('.');
      items.value.push({
        id: `temp_id_${Date.now()}_${Math.random()}`, // 臨時ID，僅供v-for使用
        file: file,
        previewUrl: e.target.result,
        displayName: originalName,
        category: 'other',
        characterId: '',
      });
    };
    reader.readAsDataURL(file);
  }
};

const removeItem = (index) => items.value.splice(index, 1);

const generateZip = async () => {
  const zip = new JSZip();
  const packId = `pack_${Date.now()}`;
  
  // 建立一個從臨時ID到最終生成ID的映射
  const tempIdToFinalId = {};
  
  const config = {
    packId: packId,
    packDisplayName: packInfo.packDisplayName,
    description: packInfo.description,
    items: [],
  };

  // 第一次循環：生成所有物件的最終ID，並建立映射
  items.value.forEach((item, index) => {
    const finalId = `item_${packId}_${index}`;
    tempIdToFinalId[item.id] = finalId;
  });

  // 第二次循環：建立config並處理文件
  for (const item of items.value) {
    zip.file(item.file.name, item.file);
    
    const finalItemId = tempIdToFinalId[item.id];
    const itemConfig = {
      itemId: finalItemId,
      displayName: item.displayName,
      file: item.file.name,
      category: item.category,
    };
    
    // 如果是表情，使用映射找到對應角色的最終ID
    if (item.category === 'expression' && item.characterId) {
      itemConfig.characterId = tempIdToFinalId[item.characterId] || null;
    }
    
    config.items.push(itemConfig);
  }

  zip.file('config.json', JSON.stringify(config, null, 2));

  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  // 使用顯示名稱來命名下載的檔案，更直觀
  const safeFileName = packInfo.packDisplayName.replace(/[/\\?%*:|"<>]/g, '-') || 'package';
  link.download = `${safeFileName}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
};
</script>

<style scoped>
/* 樣式大部分保持不變，只微調 */
.packer-container { display: flex; flex-direction: column; height: 100vh; font-family: sans-serif; background-color: #f7f9fc; }
.packer-header { background-color: #fff; padding: 1rem 2rem; border-bottom: 1px solid #e0e0e0; }
.packer-header h1 { margin: 0; font-size: 1.5rem; color: #333; }
.packer-main { display: flex; flex: 1; overflow: hidden; }
.control-panel { width: 350px; padding: 2rem; background-color: #fff; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; }
.control-panel h2 { margin-top: 0; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
.form-group input, .form-group textarea { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
.generate-btn { width: 100%; padding: 1rem; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
.generate-btn:disabled { background-color: #ccc; }
.packer-footer { margin-top: auto; color: #aaa; font-size: 0.8rem; }
.items-panel { flex: 1; padding: 2rem; overflow-y: auto; }
.drop-zone { border: 2px dashed #ccc; padding: 2rem; text-align: center; cursor: pointer; margin-bottom: 2rem; }
.drop-zone:hover { background-color: #f0f0f0; }
.items-list { display: flex; flex-direction: column; gap: 1rem; }
.item-card { display: flex; gap: 1rem; align-items: center; background: #fff; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.item-preview { width: 80px; height: 80px; object-fit: contain; border-radius: 4px; background-color: #f0f0f0; }
.item-form { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
.item-form input, .item-form select { width: 100%; padding: 0.5rem; }
.display-name-input { font-weight: bold; }
.remove-btn { background: #e74c3c; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; align-self: flex-start; }
</style>