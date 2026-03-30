<template>
  <div class="floating-controls" @click.stop @touchstart.stop>
    <transition name="slide-fade">
      <div v-if="!collapsed" class="controls-stack">
        <div class="btn-row icon-row">
          <button class="icon-btn-ctrl" @click="confirmClearCanvas" title="清空畫布" aria-label="清空畫布" v-html="icons.clear"></button>
          <button class="icon-btn-ctrl" @click="resetPositions" title="重置位置" aria-label="重置位置" v-html="icons.reset"></button>
          <button 
            class="icon-btn-ctrl"
            :class="{ active: panMode }"
            @click="togglePanMode"
            title="手型工具（可用滑鼠中鍵觸發）"
            aria-label="手型工具"
            v-html="icons.hand"
          ></button>
          <button class="icon-btn-ctrl" @click="showDownloadDialog = true" title="儲存圖像" aria-label="儲存圖像" v-html="icons.download"></button>
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
          <button class="zoom-icon" @click="gameStore.zoomOut()" :disabled="gameStore.canvasZoom <= 0.05" title="縮小">－</button>
          <span class="zoom-text">{{ Math.round(gameStore.canvasZoom * 100) }}%</span>
          <button class="zoom-icon" @click="gameStore.zoomIn()" :disabled="gameStore.canvasZoom >= maxZoom" title="放大">＋</button>
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

const showDownloadDialog = ref(false);
const downloadSize = ref('original');
const useWatermark = ref(false);

const watermarkSrc = new URL('../assets/watermark.png', import.meta.url).href;

const emit = defineEmits(['pan-mode-change']);

const hasSelectedItem = computed(() => gameStore.selectedItem !== null);

const maxZoom = computed(() => {
  if (gameStore.ui.isMobile && gameStore._baseCanvasScale > 0) {
    return 1 / gameStore._baseCanvasScale;
  }
  return Math.max(5, gameStore.canvasSize.width / 400);
});

const togglePanMode = () => {
  panMode.value = !panMode.value;
  emit('pan-mode-change', panMode.value);
};

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

    const originalWidth = 2000;
    const originalHeight = 3800;
    
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

    const hasBackground = (gameStore.currentOutfit.background?.length || 0) > 0;
    const canvasSize = hasBackground ? gameStore.backgroundSize : gameStore.canvasSize;
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;
    const ctx = exportCanvas.getContext('2d');

    if (!hasBackground) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-card').trim() || '#ffffff';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    }

    for (const layer of layers) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve) => {
        img.onload = () => {
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

    let finalCanvas = exportCanvas;
    if (outputWidth !== canvasSize.width || outputHeight !== canvasSize.height) {
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = outputWidth;
      finalCanvas.height = outputHeight;
      const finalCtx = finalCanvas.getContext('2d');
      finalCtx.drawImage(exportCanvas, 0, 0, outputWidth, outputHeight);
    }

    finalCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const filename = `紙娃娃-${outputWidth}x${outputHeight}-${new Date().getTime()}.png`;
      
      // iOS Safari 無法透過 a.click() 可靠下載，改用開啟新視窗讓使用者長按儲存
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        // iOS: 開啟新分頁顯示圖片，使用者可長按儲存
        const newTab = window.open();
        if (newTab) {
          newTab.document.write(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${filename}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f0f0}img{max-width:100%;max-height:100vh;object-fit:contain}p{text-align:center;color:#666;font-family:sans-serif;padding:1rem}</style></head><body><div><p>長按圖片即可儲存</p><img src="${url}" alt="${filename}"></div></body></html>`);
          newTab.document.close();
        } else {
          // 備用方案：直接在同視窗開啟
          window.location.href = url;
        }
        gameStore.showNotification('📱 長按圖片即可儲存', 'info');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        gameStore.showNotification('✅ 圖像已下載', 'success');
      }
    }, 'image/png');

  } catch (error) {
    console.error('下載圖像失敗:', error);
    gameStore.showNotification('❌ 下載失敗', 'error');
  }
};

const generatePreviewImage = async () => {
  try {
    const canvas = document.querySelector('.canvas');
    if (!canvas) return null;

    const previewCanvas = document.createElement('canvas');
    const previewSize = 200; // 預覽圖尺寸
    previewCanvas.width = previewSize;
    previewCanvas.height = previewSize;
    const ctx = previewCanvas.getContext('2d');

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-main').trim() || '#f8f5ea';
    ctx.fillRect(0, 0, previewSize, previewSize);

    const hasBackground = (gameStore.currentOutfit.background?.length || 0) > 0;
    const canvasSize = hasBackground ? gameStore.backgroundSize : gameStore.canvasSize;
    const scale = previewSize / Math.max(canvasSize.width, canvasSize.height);

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

.icon-btn-ctrl {
  width: 36px;
  height: 36px;
  background: rgba(71, 45, 37, 0.70);
  background: color-mix(in srgb, var(--color-text-primary) 70%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  color: var(--color-bg-card);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(71, 45, 37, 0.15);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.icon-btn-ctrl:hover:not(:disabled) {
  background: rgba(71, 45, 37, 0.85);
  background: color-mix(in srgb, var(--color-text-primary) 85%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(71, 45, 37, 0.25);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-text-primary) 25%, transparent);
}

.icon-btn-ctrl.active {
  background: var(--color-primary) !important;
}

.icon-btn-ctrl :deep(svg) {
  width: 18px;
  height: 18px;
  stroke-width: 2.5;
}

.badge-btn {
  background: rgba(71, 45, 37, 0.70);
  background: color-mix(in srgb, var(--color-text-primary) 70%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  color: var(--color-bg-card);
  border: none;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(71, 45, 37, 0.15);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.badge-btn:hover:not(:disabled) {
  background: rgba(71, 45, 37, 0.85);
  background: color-mix(in srgb, var(--color-text-primary) 85%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(71, 45, 37, 0.25);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-text-primary) 25%, transparent);
}

.badge-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.badge-btn.mode {
  /* iOS Safari fallback */
  background: rgba(71, 45, 37, 0.45);
  background: color-mix(in srgb, var(--color-text-primary) 45%, transparent);
  font-size: 0.8rem;
}

.badge-btn.mode.active {
  background: var(--color-primary) !important;
  color: #fff;
}

.badge-btn.flip {
  background: rgba(71, 45, 37, 0.70);
  background: color-mix(in srgb, var(--color-text-primary) 70%, transparent);
  padding: 7px 12px;
  font-size: 0.8rem;
}

.badge-btn.round {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 36px;
}

.badge-btn.save {
  background: var(--color-warning);
  background: linear-gradient(135deg, var(--color-warning), color-mix(in srgb, var(--color-warning) 80%, transparent));
  color: var(--color-text-primary);
  font-weight: 600;
}

.badge-btn.save:hover {
  background: var(--color-warning);
}

.zoom-badge {
  background: rgba(71, 45, 37, 0.75);
  background: color-mix(in srgb, var(--color-text-primary) 75%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(71, 45, 37, 0.15);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
}

.zoom-icon {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--color-bg-card);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  font-size: 0.9rem;
}

.zoom-icon:hover:not(:disabled) {
  background: rgba(192, 183, 163, 0.15);
  background: color-mix(in srgb, var(--color-border) 15%, transparent);
}

.zoom-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-text {
  color: var(--color-bg-card);
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 42px;
  text-align: center;
}

.free-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.check-badge {
  background: rgba(71, 45, 37, 0.70);
  background: color-mix(in srgb, var(--color-text-primary) 70%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  color: var(--color-bg-card);
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(71, 45, 37, 0.15);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  transition: all 0.2s ease;
  flex: 1;
  justify-content: center;
}

.check-badge:hover {
  background: rgba(71, 45, 37, 0.85);
  background: color-mix(in srgb, var(--color-text-primary) 85%, transparent);
}

/* checkbox 樣式由 App.vue 全局管理 */

.toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(71, 45, 37, 0.75);
  background: color-mix(in srgb, var(--color-text-primary) 75%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: none;
  color: var(--color-bg-card);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(71, 45, 37, 0.15);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.toggle-btn:hover {
  background: rgba(71, 45, 37, 0.90);
  background: color-mix(in srgb, var(--color-text-primary) 90%, transparent);
  transform: scale(1.05);
}

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

.download-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(71, 45, 37, 0.50);
  background: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.download-dialog {
  background: var(--color-bg-card);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(71, 45, 37, 0.25);
  box-shadow: 0 8px 32px color-mix(in srgb, var(--color-text-primary) 25%, transparent);
  min-width: 280px;
  max-width: 90vw;
  overflow: hidden;
}

.download-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
}

.dialog-title {
  font-size: 0.95rem;
  font-weight: 600;
}

.dialog-close {
  background: none;
  border: none;
  color: var(--color-text-primary);
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

.download-dialog-body {
  padding: 1rem;
}

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
  background: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.size-option:hover {
  background: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
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

.watermark-option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: color-mix(in srgb, var(--color-warning) 10%, transparent);
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
  background: rgba(71, 45, 37, 0.30);
  background: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
  color: var(--color-text-primary);
}

.dialog-btn.cancel:hover {
  background: rgba(71, 45, 37, 0.50);
  background: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
}

.dialog-btn.confirm {
  background: var(--color-primary);
  color: var(--color-bg-card);
}

.dialog-btn.confirm:hover {
  background: rgba(97, 139, 106, 0.85);
  background: color-mix(in srgb, var(--color-primary) 85%, transparent);
}

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


