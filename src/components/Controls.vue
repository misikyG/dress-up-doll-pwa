<template>
  <div class="floating-controls" @click.stop @touchstart.stop>
    <transition name="slide-fade">
      <div v-if="!collapsed" class="controls-stack">
        <div class="btn-row icon-row">
          <button class="icon-btn-ctrl" @click="confirmClearCanvas" title="清空畫布" v-html="icons.clear"></button>
          <button class="icon-btn-ctrl" @click="resetPositions" title="重置位置" v-html="icons.reset"></button>
          <button 
            class="icon-btn-ctrl"
            :class="{ active: panMode }"
            @click="togglePanMode"
            title="手型工具（可用滑鼠中鍵觸發）"
            v-html="icons.hand"
          ></button>
          <button class="icon-btn-ctrl" @click="showDownloadDialog = true" title="儲存圖像" v-html="icons.download"></button>
        </div>

        <div class="mode-row">
          <button
            class="badge-btn mode"
            :class="{ active: gameStore.canvasMode === 'fixed' }"
            @click="gameStore.setCanvasMode('fixed')"
            title="物件固定位置"
          >固定</button>
          <button
            class="badge-btn mode"
            :class="{ active: gameStore.canvasMode === 'free' }"
            @click="gameStore.setCanvasMode('free')"
            title="物件自由變動"
          >自由</button>
        </div>

        <div class="zoom-badge">
          <button class="zoom-icon" @click="gameStore.zoomOut()" :disabled="gameStore.canvasZoom <= 0.1" title="縮小">－</button>
          <span class="zoom-text">{{ Math.round(gameStore.canvasZoom * 100) }}%</span>
          <button class="zoom-icon" @click="gameStore.zoomIn()" :disabled="gameStore.canvasZoom >= 5" title="放大">＋</button>
          <button class="zoom-icon" @click="gameStore.resetZoom()" title="重設縮放">◼︎</button>
        </div>

        <transition name="expand">
          <div v-if="gameStore.canvasMode === 'free'" class="free-section">
            <div class="btn-row">
              <label class="check-badge">
                <input type="checkbox" v-model="gameStore.freeMode.enableFreeRotation" />
                <span class="checkbox-indicator"></span>
                <span>旋轉</span>
              </label>
              <label class="check-badge">
                <input type="checkbox" v-model="gameStore.freeMode.enableFreeScale" />
                <span class="checkbox-indicator"></span>
                <span>縮放</span>
              </label>
            </div>
            <div class="btn-row">
              <button class="badge-btn flip" @click="flipSelected('x')" :disabled="!hasSelectedItem">左右</button>
              <button class="badge-btn flip" @click="flipSelected('y')" :disabled="!hasSelectedItem">上下</button>
            </div>
          </div>
        </transition>

        <div class="btn-row">
          <button class="badge-btn round" @click="gameStore.undo()" :disabled="!gameStore.canUndo" title="上一步">↩︎</button>
          <button class="badge-btn round" @click="gameStore.redo()" :disabled="!gameStore.canRedo" title="下一步">↪︎</button>
        </div>

        <button class="badge-btn save" @click="saveOutfit" title="儲存搭配">★ 儲存搭配</button>
      </div>
    </transition>

    <button
      class="toggle-btn"
      @click="collapsed = !collapsed"
      :title="collapsed ? '展開控制' : '收合控制'"
    >
      <span>{{ collapsed ? '▲' : '▼' }}</span>
    </button>

    <!-- 下載圖像對話框 -->
    <Teleport to="body">
      <div v-if="showDownloadDialog" class="download-dialog-overlay" @click="showDownloadDialog = false">
        <div class="download-dialog" @click.stop>
          <div class="download-dialog-header">
            <span class="dialog-title">儲存圖像</span>
            <button class="dialog-close" @click="showDownloadDialog = false">×</button>
          </div>
          <div class="download-dialog-body">
            <div class="size-options">
              <label class="size-option">
                <input type="radio" v-model="downloadSize" value="original" />
                <span class="option-label">原尺寸 (2000×3800)</span>
              </label>
              <label class="size-option">
                <input type="radio" v-model="downloadSize" value="medium" />
                <span class="option-label">中縮圖 (1000×1900)</span>
              </label>
              <label class="size-option">
                <input type="radio" v-model="downloadSize" value="small" />
                <span class="option-label">小縮圖 (500×950)</span>
              </label>
            </div>
            <label class="watermark-option">
              <input type="checkbox" v-model="useWatermark" />
              <span class="checkbox-custom"></span>
              <span class="option-label">加入浮水印</span>
            </label>
          </div>
          <div class="download-dialog-footer">
            <button class="dialog-btn cancel" @click="showDownloadDialog = false">取消</button>
            <button class="dialog-btn confirm" @click="executeDownload">下載</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';

const gameStore = useGameStore();
const collapsed = ref(false);
const panMode = ref(false);

// 下載對話框相關
const showDownloadDialog = ref(false);
const downloadSize = ref('original');
const useWatermark = ref(false);

// 浮水印圖片 (預設為內聯路徑，實際圖片待用戶提供)
const watermarkSrc = new URL('../assets/watermark.png', import.meta.url).href;

// 發送自定義事件供Dressing組件監聯
const emit = defineEmits(['pan-mode-change']);

const hasSelectedItem = computed(() => gameStore.selectedItem !== null);

const togglePanMode = () => {
  panMode.value = !panMode.value;
  emit('pan-mode-change', panMode.value);
};

// 公開panMode給父組件使用
defineExpose({
  panMode
});

const confirmClearCanvas = () => {
  if (confirm('確定要清空畫布上的所有物件嗎？')) {
    gameStore.clearCurrentOutfit();
  }
};

const resetPositions = () => {
  if (confirm('確定要重設所有物件的位置、縮放和旋轉嗎？')) {
    gameStore.resetItemTransforms();
  }
};

// 執行下載
const executeDownload = async () => {
  showDownloadDialog.value = false;
  
  try {
    const canvas = document.querySelector('.canvas');
    if (!canvas) {
      gameStore.showNotification('❌ 找不到畫布', 'error');
      return;
    }

    const layers = gameStore.currentLayers;
    if (layers.length === 0) {
      gameStore.showNotification('❌ 畫布上沒有物件', 'warning');
      return;
    }

    // 原始尺寸
    const originalWidth = 2000;
    const originalHeight = 3800;
    
    // 根據選擇的尺寸計算輸出尺寸
    let outputWidth, outputHeight;
    switch (downloadSize.value) {
      case 'medium':
        outputWidth = 1000;
        outputHeight = 1900;
        break;
      case 'small':
        outputWidth = 500;
        outputHeight = 950;
        break;
      default:
        outputWidth = originalWidth;
        outputHeight = originalHeight;
    }

    // 創建 canvas 來合成圖像 (先用原始尺寸繪製)
    const hasBackground = (gameStore.currentOutfit.background?.length || 0) > 0;
    const canvasSize = hasBackground ? gameStore.backgroundSize : gameStore.canvasSize;
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;
    const ctx = exportCanvas.getContext('2d');

    // 如果沒有背景，填充白色
    if (!hasBackground) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    }

    // 依序繪製所有圖層
    for (const layer of layers) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve) => {
        img.onload = () => {
          // 檢查是否在自由模式且有變換
          if (gameStore.canvasMode === 'free' && gameStore.freeMode.itemPositions[layer.id]) {
            const pos = gameStore.freeMode.itemPositions[layer.id];
            const scale = gameStore.freeMode.itemScales[layer.id] || 1;
            const flip = gameStore.freeMode.itemFlips[layer.id] || { x: false, y: false };
            const rotation = gameStore.freeMode.itemRotations[layer.id] || 0;

            ctx.save();
            ctx.translate(canvasSize.width / 2 + pos.x, canvasSize.height / 2 + pos.y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(
              flip.x ? -scale : scale,
              flip.y ? -scale : scale
            );
            ctx.drawImage(img, -canvasSize.width / 2, -canvasSize.height / 2, canvasSize.width, canvasSize.height);
            ctx.restore();
          } else {
            // 固定模式，直接繪製
            ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
          }
          resolve();
        };
        img.onerror = () => {
          console.error('圖像載入失敗:', layer.item.displayName);
          resolve();
        };
        img.src = layer.item.imageData;
      });
    }

    // 如果需要浮水印，加入浮水印
    if (useWatermark.value) {
      try {
        const watermarkImg = new Image();
        watermarkImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          watermarkImg.onload = resolve;
          watermarkImg.onerror = () => {
            console.warn('浮水印載入失敗，跳過浮水印');
            resolve();
          };
          watermarkImg.src = watermarkSrc;
        });
        
        if (watermarkImg.complete && watermarkImg.naturalWidth > 0) {
          // 浮水印放置在右下角，大小為畫布的 15%
          const wmSize = Math.min(canvasSize.width, canvasSize.height) * 0.15;
          const wmAspect = watermarkImg.naturalWidth / watermarkImg.naturalHeight;
          const wmWidth = wmAspect >= 1 ? wmSize : wmSize * wmAspect;
          const wmHeight = wmAspect >= 1 ? wmSize / wmAspect : wmSize;
          const wmX = canvasSize.width - wmWidth - 40;
          const wmY = canvasSize.height - wmHeight - 40;
          
          ctx.globalAlpha = 0.7;
          ctx.drawImage(watermarkImg, wmX, wmY, wmWidth, wmHeight);
          ctx.globalAlpha = 1.0;
        }
      } catch (error) {
        console.warn('浮水印處理失敗:', error);
      }
    }

    // 如果需要縮小，創建縮小後的 canvas
    let finalCanvas = exportCanvas;
    if (outputWidth !== canvasSize.width || outputHeight !== canvasSize.height) {
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = outputWidth;
      finalCanvas.height = outputHeight;
      const finalCtx = finalCanvas.getContext('2d');
      finalCtx.drawImage(exportCanvas, 0, 0, outputWidth, outputHeight);
    }

    // 轉換為 blob 並下載
    finalCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `紙娃娃-${outputWidth}x${outputHeight}-${new Date().getTime()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      gameStore.showNotification('✅ 圖像已下載', 'success');
    }, 'image/png');

  } catch (error) {
    console.error('下載圖像失敗:', error);
    gameStore.showNotification('❌ 下載失敗', 'error');
  }
};

// 生成預覽圖
const generatePreviewImage = async () => {
  try {
    const canvas = document.querySelector('.canvas');
    if (!canvas) return null;

    // 創建一個 canvas 來合成預覽圖
    const previewCanvas = document.createElement('canvas');
    const previewSize = 200; // 預覽圖尺寸
    previewCanvas.width = previewSize;
    previewCanvas.height = previewSize;
    const ctx = previewCanvas.getContext('2d');

    // 填充背景
    ctx.fillStyle = '#f8f5ea';
    ctx.fillRect(0, 0, previewSize, previewSize);

    // 取得畫布實際尺寸
    const hasBackground = (gameStore.currentOutfit.background?.length || 0) > 0;
    const canvasSize = hasBackground ? gameStore.backgroundSize : gameStore.canvasSize;
    const scale = previewSize / Math.max(canvasSize.width, canvasSize.height);

    // 繪製所有圖層
    const layers = gameStore.currentLayers;
    for (const layer of layers) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve) => {
        img.onload = () => {
          const drawWidth = canvasSize.width * scale;
          const drawHeight = canvasSize.height * scale;
          const offsetX = (previewSize - drawWidth) / 2;
          const offsetY = (previewSize - drawHeight) / 2;
          
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
          resolve();
        };
        img.onerror = resolve;
        img.src = layer.item.imageData;
      });
    }

    return previewCanvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    console.error('生成預覽圖失敗:', error);
    return null;
  }
};

const saveOutfit = async () => {
  const name = prompt('請為您的搭配取個名字：', `我的搭配 ${gameStore.savedOutfits.length + 1}`);
  if (name) {
    // 生成預覽圖
    const previewImage = await generatePreviewImage();
    gameStore.saveCurrentOutfit(name, previewImage);
  }
};

const flipSelected = (axis) => {
  if (!gameStore.selectedItem) return;

  const layer = gameStore.selectedItem;
  const itemId = layer.id;
  const currentFlip = gameStore.freeMode.itemFlips[itemId] || { x: false, y: false };
  const newFlip = { ...currentFlip };
  newFlip[axis] = !newFlip[axis];
  gameStore.setItemFlip(itemId, newFlip);
};
</script>

<style scoped>
/* ========================================
   Controls.vue 樣式
   ----------------------------------------
   目錄：
   1. 基礎結構
   2. 圖標按鈕
   3. 控制按鈕（badge-btn）
   4. 縮放控制
   5. 自由模式區塊
   6. 收合切換按鈕
   7. 過渡動畫
   8. 下載對話框
   9. 響應式設計 - 手機版
   10. 響應式設計 - 平板版
   11. 響應式設計 - 下載對話框手機版
   ======================================== */

/* ========================================
   1. 基礎結構
   ======================================== */
.floating-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  z-index: 50;
}

.controls-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}

.btn-row {
  display: flex;
  gap: 6px;
}

.icon-row {
  display: flex;
  gap: 6px;
}

.mode-row {
  display: flex;
  gap: 6px;
}

/* ========================================
   2. 圖標按鈕
   ======================================== */
.icon-btn-ctrl {
  width: 36px;
  height: 36px;
  background: rgb(from var(--color-border) r g b / 0.6);
  backdrop-filter: blur(8px);
  color: var(--color-bg-main);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgb(from var(--color-text-primary) r g b / 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
  padding: 0;
}

.icon-btn-ctrl:hover:not(:disabled) {
  background: var(--color-border);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgb(from var(--color-text-primary) r g b / 0.25);
  opacity: 1;
}

.icon-btn-ctrl.active {
  background: var(--color-primary) !important;
  opacity: 1;
}

.icon-btn-ctrl :deep(svg) {
  width: 18px;
  height: 18px;
  stroke-width: 2.5;
}

/* ========================================
   3. 控制按鈕（badge-btn）
   ======================================== */
.badge-btn {
  background: rgb(from var(--color-border) r g b / 0.6);
  backdrop-filter: blur(8px);
  color: var(--color-bg-main);
  border: none;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgb(from var(--color-text-primary) r g b / 0.15);
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  opacity: 0.85;
}

.badge-btn:hover:not(:disabled) {
  background: var(--color-border);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgb(from var(--color-text-primary) r g b / 0.25);
  opacity: 1;
}

.badge-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 模式切換按鈕 */
.badge-btn.mode {
  background: rgb(from var(--color-border) r g b / 0.25);
  font-size: 0.8rem;
}

.badge-btn.mode.active {
  background: var(--color-primary);
  color: var(--color-bg-main);
  opacity: 1;
}

/* 翻轉按鈕 */
.badge-btn.flip {
  background: rgb(from var(--color-border) r g b / 0.75);
  padding: 7px 12px;
  font-size: 0.8rem;
}

/* 圓形按鈕（上一步/下一步） */
.badge-btn.round {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 36px;
}

/* 儲存搭配按鈕 */
.badge-btn.save {
  background: linear-gradient(135deg, var(--color-warning), rgb(from var(--color-warning) r g b / 0.8));
  color: var(--color-text-primary);
  font-weight: 600;
  opacity: 0.9;
}

.badge-btn.save:hover {
  background: var(--color-warning);
  opacity: 1;
}

/* ========================================
   4. 縮放控制
   ======================================== */
.zoom-badge {
  background: rgb(from var(--color-border) r g b / 0.85);
  backdrop-filter: blur(8px);
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgb(from var(--color-text-primary) r g b / 0.15);
}

.zoom-icon {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--color-bg-main);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  font-size: 0.9rem;
}

.zoom-icon:hover:not(:disabled) {
  background: rgb(from var(--color-bg-main) r g b / 0.15);
}

.zoom-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-text {
  color: var(--color-bg-main);
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 42px;
  text-align: center;
}

/* ========================================
   5. 自由模式區塊
   ======================================== */
.free-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 勾選徽章（旋轉/縮放選項） */
.check-badge {
  background: rgb(from var(--color-border) r g b / 0.8);
  backdrop-filter: blur(8px);
  color: var(--color-bg-main);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgb(from var(--color-text-primary) r g b / 0.15);
  transition: all 0.2s ease;
  flex: 1;
  justify-content: center;
}

.check-badge:hover {
  background: var(--color-border);
}

/* checkbox 樣式由 App.vue 全局管理 */

/* ========================================
   6. 收合切換按鈕
   ======================================== */
.toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgb(from var(--color-border) r g b / 0.85);
  backdrop-filter: blur(8px);
  border: none;
  color: var(--color-bg-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgb(from var(--color-text-primary) r g b / 0.15);
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.toggle-btn:hover {
  background: var(--color-border);
  transform: scale(1.05);
}

/* ========================================
   7. 過渡動畫
   ======================================== */
/* 滑動淡入淡出動畫 */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.25s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 展開動畫 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}

/* ========================================
   8. 下載對話框
   ======================================== */
/* 對話框遮罩層 */
.download-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgb(from var(--color-text-primary) r g b / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

/* 對話框容器 */
.download-dialog {
  background: var(--color-bg-card);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgb(from var(--color-text-primary) r g b / 0.25);
  min-width: 280px;
  max-width: 90vw;
  overflow: hidden;
}

/* 對話框標題列 */
.download-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--color-primary);
  color: var(--color-bg-main);
}

.dialog-title {
  font-size: 0.95rem;
  font-weight: 600;
}

.dialog-close {
  background: none;
  border: none;
  color: var(--color-bg-main);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.dialog-close:hover {
  opacity: 1;
}

/* 對話框內容區 */
.download-dialog-body {
  padding: 1rem;
}

/* 尺寸選項 */
.size-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.size-option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-canvas);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.size-option:hover {
  background: rgb(from var(--color-border) r g b / 0.3);
}

.size-option input[type="radio"] {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  position: relative;
  cursor: pointer;
}

.size-option input[type="radio"]:checked {
  background: var(--color-primary);
}

.size-option input[type="radio"]:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: var(--color-bg-main);
  border-radius: 50%;
}

/* 浮水印選項 */
.watermark-option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: rgb(from var(--color-warning) r g b / 0.1);
  border: 1px dashed var(--color-warning);
  border-radius: 8px;
  cursor: pointer;
}

.watermark-option input[type="checkbox"] {
  display: none;
}

.watermark-option .checkbox-custom {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  position: relative;
  transition: all 0.2s;
  background: transparent;
}

.watermark-option input[type="checkbox"]:checked + .checkbox-custom {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.watermark-option input[type="checkbox"]:checked + .checkbox-custom::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid var(--color-bg-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.option-label {
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

/* 對話框底部按鈕區 */
.download-dialog-footer {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-bg-panel);
  justify-content: flex-end;
}

.dialog-btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.dialog-btn.cancel {
  background: rgb(from var(--color-border) r g b / 0.3);
  color: var(--color-text-primary);
}

.dialog-btn.cancel:hover {
  background: rgb(from var(--color-border) r g b / 0.5);
}

.dialog-btn.confirm {
  background: var(--color-primary);
  color: var(--color-bg-main);
}

.dialog-btn.confirm:hover {
  background: rgb(from var(--color-primary) r g b / 0.85);
}

/* ========================================
   9. 響應式設計 - 手機版
   ======================================== */
@media (max-width: 767px) {
  .floating-controls {
    top: 8px;
    right: 8px;
  }
  
  .controls-stack {
    gap: 5px;
    margin-bottom: 5px;
  }
  
  .btn-row {
    gap: 5px;
  }
  
  .icon-btn-ctrl {
    width: 28px;
    height: 28px;
  }
  
  .icon-btn-ctrl :deep(svg) {
    width: 14px;
    height: 14px;
  }
  
  .badge-btn {
    padding: 5px 9px;
    font-size: 0.72rem;
  }
  
  .badge-btn.mode {
    font-size: 0.7rem;
    padding: 4px 7px;
  }
  
  .badge-btn.flip {
    padding: 4px 7px;
    font-size: 0.7rem;
  }
  
  .badge-btn.round {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
  }
  
  .badge-btn.save {
    font-size: 0.72rem;
    padding: 5px 9px;
  }
  
  .zoom-badge {
    padding: 2px 5px;
    gap: 3px;
  }
  
  .zoom-icon {
    width: 22px;
    height: 22px;
    font-size: 0.75rem;
  }
  
  .zoom-text {
    font-size: 0.7rem;
    min-width: 32px;
  }
  
  .check-badge {
    padding: 4px 9px;
    font-size: 0.7rem;
    gap: 5px;
  }
  
  .check-badge input[type="checkbox"] {
    width: 12px;
    height: 12px;
  }
  
  .toggle-btn {
    width: 32px;
    height: 32px;
    font-size: 0.8rem;
  }
}

/* ========================================
   10. 響應式設計 - 平板版
   ======================================== */
@media (min-width: 768px) and (max-width: 1024px) {
  .floating-controls {
    top: 10px;
    right: 10px;
  }
  
  .icon-btn-ctrl {
    width: 34px;
    height: 34px;
  }
  
  .badge-btn {
    padding: 6px 12px;
    font-size: 0.8rem;
  }
  
  .badge-btn.round {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
  }
  
  .zoom-badge {
    padding: 3px 8px;
  }
  
  .zoom-icon {
    width: 26px;
    height: 26px;
  }
  
  .toggle-btn {
    width: 34px;
    height: 34px;
  }
}

/* ========================================
   11. 響應式設計 - 下載對話框手機版
   ======================================== */
@media (max-width: 767px) {
  .download-dialog {
    min-width: 260px;
  }
  
  .download-dialog-header {
    padding: 0.6rem 0.85rem;
  }
  
  .dialog-title {
    font-size: 0.9rem;
  }
  
  .download-dialog-body {
    padding: 0.85rem;
  }
  
  .size-option {
    padding: 0.45rem 0.65rem;
  }
  
  .option-label {
    font-size: 0.85rem;
  }
  
  .dialog-btn {
    padding: 0.45rem 0.85rem;
    font-size: 0.85rem;
  }
}
</style>
