<template>
  <div class="importer-modal" @click.stop>
    <div class="importer-header">
      <h3>📥 匯入圖包</h3>
      <button @click="$emit('close')" class="close-btn" title="關閉">×</button>
    </div>
    <div class="importer-content">
      <div 
        class="drop-zone"
        :class="{ 'is-dragover': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleFileDrop"
      >
        <input type="file" ref="fileInput" @change="handleFileSelect" accept=".zip" style="display: none;" />
        <div v-if="!processingState.isProcessing">
          <p>將 ZIP 圖包檔案拖放到此處</p>
          <p class="or-text">或</p>
          <button class="select-file-btn" @click="openFileSelector">選擇檔案</button>
          <p class="hint">請上傳包含 `config.json` 的 ZIP 檔案</p>
        </div>
        <div v-else class="processing-view">
          <div class="progress-bar">
            <div class="progress-bar-fill" :style="{ width: `${processingState.progress}%` }"></div>
          </div>
          <p>{{ processingState.message }}</p>
        </div>
      </div>
       <div v-if="processingState.error" class="error-message">
          <p>匯入失敗：{{ processingState.error }}</p>
          <p class="error-suggestion">請檢查 ZIP 檔案結構是否正確，並確保 `config.json` 存在且格式無誤。</p>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useGameStore } from '../store/index.js';

const emit = defineEmits(['close']);
const gameStore = useGameStore();

const fileInput = ref(null);
const isDragOver = ref(false);
const processingState = ref({
  isProcessing: false,
  progress: 0,
  message: '',
  error: null,
});

let worker = null;

const openFileSelector = () => fileInput.value.click();

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    processFile(file);
  }
};

const handleFileDrop = (event) => {
  isDragOver.value = false;
  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/zip') {
    processFile(file);
  } else {
    alert('請拖放一個 ZIP 檔案！');
  }
};

const processFile = (file) => {
  processingState.value = { isProcessing: true, progress: 0, message: '開始處理檔案...', error: null };
  
  if (window.Worker) {
    // 終止舊的 worker (如果有的話)
    if (worker) worker.terminate();
    
    // 創建新的 worker
    worker = new Worker('/zip.worker.js'); // Worker 腳本相對於 public 資料夾
    
    worker.onmessage = (event) => {
      const { type, items, packInfo, progress, message, error } = event.data;

      if (type === 'progress') {
        processingState.value.progress = progress;
        processingState.value.message = message;
      } else if (type === 'success') {
        processingState.value.message = '處理完成，正在儲存到資料庫...';
        saveItemsToDB(items, packInfo);
        worker.terminate();
        worker = null;
      } else if (type === 'error') {
        processingState.value.isProcessing = false;
        processingState.value.error = error;
        worker.terminate();
        worker = null;
      }
    };
    
    worker.onerror = (error) => {
        processingState.value.isProcessing = false;
        processingState.value.error = `Worker 發生錯誤: ${error.message}`;
        if(worker) worker.terminate();
        worker = null;
    }

    // 將檔案傳送給 Worker
    worker.postMessage({ file });
  } else {
    alert('您的瀏覽器不支援 Web Worker，匯入功能可能無法使用。');
    processingState.value.isProcessing = false;
  }
};

const saveItemsToDB = async (items, packInfo) => {
    try {
        for (const item of items) {
            await gameStore.addNewItem(item);
        }
        await gameStore.addPack(packInfo);

        gameStore.showNotification(`🎉 圖包 "${packInfo.displayName}" 匯入成功!`, 'success');
        emit('close');
    } catch (dbError) {
        processingState.value.isProcessing = false;
        processingState.value.error = `儲存至資料庫失敗: ${dbError.message}`;
    }
}

</script>

<style scoped>
.importer-modal { width: 500px; /* ... 與 Settings.vue 類似的樣式 ... */ }
.importer-header, .close-btn { /* ... */ }
.importer-content { padding: 1.5rem; }
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease;
}
.drop-zone.is-dragover { border-color: var(--primary-color); background-color: #f0f2ff; }
.or-text { color: #888; }
.select-file-btn { /* ... 與 Controls.vue 類似的按鈕樣式 ... */ }
.hint { font-size: 0.8rem; color: #aaa; margin-top: 1rem; }
.processing-view { /* ... 進度條樣式 ... */ }
.error-message { color: #F44336; background-color: #ffebee; padding: 1rem; border-radius: 6px; margin-top: 1rem; }
.error-suggestion { font-size: 0.9em; opacity: 0.8; }
</style>