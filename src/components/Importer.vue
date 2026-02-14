<template>
  <div class="importer-modal modal-base modal-md" @click.stop>
    <div class="modal-header">
      <h3><span class="title-icon" v-html="icons.import"></span> 匯入圖包</h3>
      <button @click="$emit('close')" class="btn-close" title="關閉">×</button>
    </div>
    <div class="importer-content">
      <!-- 附贈圖包區域 -->
      <div v-if="bundledPacks.length > 0" class="bundled-packs-section">
        <div class="bundled-packs-header">
          <span class="bundled-icon">🎁</span>
          <span class="bundled-title">附贈圖包</span>
        </div>
        <div class="bundled-packs-list">
          <div v-for="pack in bundledPacks" :key="pack.id" class="bundled-pack-item">
            <div class="bundled-pack-info">
              <span class="bundled-pack-name">{{ pack.displayName }}</span>
              <span v-if="pack.description" class="bundled-pack-desc">{{ pack.description }}</span>
            </div>
            <button 
              class="bundled-load-btn" 
              @click="loadBundledPack(pack)"
              :disabled="processingState.isProcessing"
            >
              載入
            </button>
          </div>
        </div>
      </div>

      <div 
        class="drop-zone"
        :class="{ 'is-dragover': isDragOver, 'is-processing': processingState.isProcessing }"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleFileDrop"
      >
        <input type="file" ref="fileInput" @change="handleFileSelect" accept=".zip" style="display: none;" />
        <div v-if="!processingState.isProcessing">
          <div class="drop-zone-icon" v-html="icons.import"></div>
          <p class="drop-zone-title">將 ZIP 圖包檔案拖放到此處</p>
          <p class="or-text">或</p>
          <button class="select-file-btn" @click="openFileSelector">選擇檔案</button>
          <p class="hint">請上傳包含 <code>config.json</code> 的 ZIP 檔案</p>
        </div>
        <div v-else class="processing-view">
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-bar-fill" :style="{ width: `${processingState.progress}%` }"></div>
            </div>
            <span class="progress-text">{{ Math.round(processingState.progress) }}%</span>
          </div>
          <p class="processing-message">{{ processingState.message }}</p>
          <div class="loading-spinner"></div>
        </div>
      </div>
      
      <!-- 錯誤訊息顯示 -->
      <div v-if="processingState.error" class="error-message">
        <div class="error-icon">❌</div>
        <div class="error-content">
          <p class="error-title">匯入失敗</p>
          <p class="error-detail">{{ processingState.error }}</p>
          <p class="error-suggestion">請檢查 ZIP 檔案結構是否正確，並確保 <code>config.json</code> 存在且格式無誤。</p>
          <button @click="resetProcessor" class="retry-btn">重新嘗試</button>
        </div>
      </div>
      
      <!-- 成功提示 -->
      <div v-if="processingState.success" class="success-message">
        <div class="success-icon">✅</div>
        <div class="success-content">
          <p class="success-title">匯入成功！</p>
          <p class="success-detail">{{ processingState.successMessage }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';

const emit = defineEmits(['close']);
const gameStore = useGameStore();

const fileInput = ref(null);
const isDragOver = ref(false);
const bundledPacks = ref([]);
const processingState = ref({
  isProcessing: false,
  progress: 0,
  message: '',
  error: null,
  success: false,
  successMessage: '',
});

let worker = null;

// 載入可用的附贈圖包清單
onMounted(async () => {
  bundledPacks.value = await gameStore.getAvailableBundledPacks();
});

// 載入附贈圖包
const loadBundledPack = async (packInfo) => {
  try {
    const file = await gameStore.loadBundledPack(packInfo);
    // 標記為附贈圖包
    processFile(file, { isBundled: true, bundledPackId: packInfo.id });
  } catch (error) {
    showError(`載入附贈圖包失敗: ${error.message}`);
  }
};

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
    showError('請拖放一個有效的 ZIP 檔案！');
  }
};

// 用於保存附贈圖包信息
let currentBundledInfo = null;

const processFile = (file, bundledInfo = null) => {
  currentBundledInfo = bundledInfo;
  resetProcessor();
  processingState.value = { 
    isProcessing: true, 
    progress: 0, 
    message: '開始處理檔案...', 
    error: null,
    success: false,
    successMessage: ''
  };
  
  if (window.Worker) {
    if (worker) worker.terminate();

    // 使用 Vite 的 base path 來正確載入 Worker
    const workerPath = `${import.meta.env.BASE_URL}zip.worker.js`;
    worker = new Worker(workerPath);
    
    worker.onmessage = (event) => {
      const { type, items, packInfo, progress, message, error } = event.data;

      if (type === 'progress') {
        processingState.value.progress = progress;
        processingState.value.message = message;
      } else if (type === 'success') {
        processingState.value.message = '處理完成，正在儲存到資料庫...';
        processingState.value.progress = 90;
        
        // 如果是附贈圖包，標記 packInfo
        if (currentBundledInfo) {
          packInfo.isBundled = true;
        }
        
        saveItemsToDB(items, packInfo);
      } else if (type === 'error') {
        showError(error);
        cleanup();
      }
    };
    
    worker.onerror = (error) => {
      showError(`Worker 發生錯誤: ${error.message}`);
      cleanup();
    }

    worker.postMessage({ file });
  } else {
    showError('您的瀏覽器不支援 Web Worker，匯入功能可能無法使用。');
  }
};

const saveItemsToDB = async (items, packInfo) => {
  try {
    processingState.value.progress = 95;
    processingState.value.message = '正在儲存物件到資料庫...';
    
    for (let i = 0; i < items.length; i++) {
      await gameStore.addNewItem(items[i]);
      const progress = 95 + ((i + 1) / items.length) * 4;
      processingState.value.progress = progress;
    }

    processingState.value.progress = 99;
    processingState.value.message = '正在儲存圖包信息...';
    await gameStore.addPack(packInfo);

    // 如果是附贈圖包，更新可用列表
    if (packInfo.isBundled) {
      bundledPacks.value = await gameStore.getAvailableBundledPacks();
    }

    processingState.value.progress = 100;
    processingState.value.isProcessing = false;
    processingState.value.success = true;
    processingState.value.successMessage = `圖包「${packInfo.displayName}」已成功匯入，包含 ${items.length} 個物件`;

    gameStore.showNotification(`🎉 圖包 "${packInfo.displayName}" 匯入成功!`, 'success');
    
    // 清除附贈圖包信息
    currentBundledInfo = null;
    
    setTimeout(() => {
      emit('close');
    }, 3000);
    
  } catch (dbError) {
    console.error('儲存到資料庫失敗:', dbError);
    showError(`儲存至資料庫失敗: ${dbError.message}`);
  } finally {
    cleanup();
  }
}

const showError = (errorMessage) => {
  processingState.value.isProcessing = false;
  processingState.value.error = errorMessage;
};

const resetProcessor = () => {
  processingState.value = {
    isProcessing: false,
    progress: 0,
    message: '',
    error: null,
    success: false,
    successMessage: '',
  };
};

const cleanup = () => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
};
</script>

<style scoped>
/* ========================================
   Importer.vue 樣式
   ----------------------------------------
   目錄：
   1. 內容容器
   2. 拖放區域
   3. 處理中狀態
   4. 訊息樣式
   5. 響應式設計
   ======================================== */

/* 繼承全局 modal-base, modal-header 樣式 */

/* ========================================
   1. 內容容器
   ======================================== */

.importer-content { 
  padding: 1.5rem; 
  flex: 1;
  overflow-y: auto;
}

/* ========================================
   1.5. 附贈圖包區域
   ======================================== */

.bundled-packs-section {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: var(--color-bg-panel);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-light);
}

.bundled-packs-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.bundled-icon {
  font-size: 1.2rem;
}

.bundled-title {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 0.9rem;
}

.bundled-packs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bundled-pack-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-card);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light);
}

.bundled-pack-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bundled-pack-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.bundled-pack-desc {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.bundled-load-btn {
  padding: 0.35rem 0.75rem;
  background-color: var(--color-primary-dark);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.bundled-load-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.bundled-load-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ========================================
   2. 拖放區域
   ======================================== */

.drop-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 2.5rem 1.5rem;
  text-align: center;
  transition: var(--transition-normal);
  background-color: var(--color-bg-panel);
  min-height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.drop-zone.is-dragover { 
  border-color: var(--color-primary); 
  background-color: rgba(125, 165, 133, 0.3); 
  transform: scale(1.02);
}

.drop-zone.is-processing {
  border-color: var(--color-primary);
  background-color: rgba(125, 165, 133, 0.2);
}

.drop-zone-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.7;
}

.drop-zone-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}

.or-text { 
  color: var(--color-text-secondary); 
  margin: 0.75rem 0;
  font-size: 0.85rem;
}

.select-file-btn { 
  padding: 0.6rem 1.5rem;
  background-color: var(--color-primary-dark);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.95rem;
  transition: var(--transition-fast);
  margin-bottom: 0.75rem;
}

.select-file-btn:hover {
  background-color: rgba(165, 149, 209, 0.85);
}

.hint { 
  font-size: 0.8rem; 
  color: var(--color-text-secondary); 
  margin-top: 0.75rem;
  line-height: 1.4;
}

.hint code {
  background-color: var(--color-bg-canvas);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-family: 'Monaco', 'Consolas', monospace;
}

/* ========================================
   3. 處理中狀態
   ======================================== */

.processing-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.progress-container {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background-color: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--color-primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary);
  min-width: 40px;
}

.processing-message {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  margin: 0;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

/* ========================================
   4. 訊息樣式
   ======================================== */

.error-message,
.success-message { 
  display: flex;
  gap: 1rem;
  padding: 1.25rem; 
  border-radius: var(--radius-md); 
  margin-top: 1rem;
}

.error-message {
  color: var(--color-error); 
  background-color: rgba(173, 75, 68, 0.1); 
  border: 1px solid rgba(173, 75, 68, 0.3);
}

.success-message {
  color: var(--color-success);
  background-color: rgba(112, 145, 114, 0.1);
  border: 1px solid rgba(112, 145, 114, 0.3);
}

.error-icon,
.success-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.error-content,
.success-content {
  flex: 1;
}

.error-title,
.success-title {
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
}

.error-detail,
.success-detail {
  margin: 0;
  font-size: 0.85rem;
}

.error-detail {
  margin-bottom: 0.5rem;
}

.error-suggestion { 
  font-size: 0.8rem; 
  opacity: 0.8; 
  margin: 0 0 1rem 0;
  line-height: 1.4;
}

.retry-btn {
  padding: 0.4rem 0.9rem;
  background-color: var(--color-error);
  color: var(--color-bg-main);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  transition: var(--transition-fast);
}

.retry-btn:hover {
  background-color: rgba(173, 75, 68, 0.85);
}

/* ========================================
   5. 響應式設計
   ======================================== */

@media (max-width: 767px) {
  .importer-content {
    padding: 1rem;
  }
  
  .drop-zone {
    padding: 2rem 1rem;
    min-height: 150px;
  }
  
  .drop-zone-icon {
    font-size: 2rem;
  }
  
  .error-message,
  .success-message {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>