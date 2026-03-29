<template>
  <div class="dressing-container">
    <!-- 畫布外部容器 -->
    <div class="canvas-viewport" ref="canvasViewport" 
         :class="{ 'pan-mode': panModeActive }"
         @wheel.prevent="handleWheel"
         @mousedown="onCanvasDragStart"
         @touchstart="onTouchStart"
         @touchmove="onTouchMove"
         @touchend="onTouchEnd"
         @click="handleCanvasClick">

      <!-- 選取物件顯示（獨立於控制台，固定在左上角） -->
      <div v-if="gameStore.selectedItem" class="selected-item-badge">
        <span class="selected-label">選取:</span>
        <span class="selected-name">{{ gameStore.selectedItem.item?.displayName || '未知' }}</span>
      </div>

      <!-- 浮動控制選單 -->
      <Controls ref="controlsRef" @pan-mode-change="onPanModeChange" />
      
      <!-- 畫布本身，固定尺寸 -->
      <div class="canvas" :style="canvasStyle" ref="canvas">
        
        <!-- 背景層 -->
        <div v-for="layer in backgroundLayers" :key="layer.id" class="canvas-item background-layer">
          <img :src="layer.item.imageData" :alt="layer.item.displayName" draggable="false" decoding="async" />
        </div>

        <!-- 所有非背景圖層 -->
        <div
          v-for="layer in foregroundLayers"
          :key="layer.id"
          class="canvas-item"
          :style="getItemStyle(layer)"
          :class="{ 
            'is-dragging': dragState.isDragging && dragState.dragItem?.id === layer.id,
            'is-selected': gameStore.selectedItem?.id === layer.id,
            'is-highlighted': gameStore.selectedItem?.id === layer.id,
            'pan-mode-active': panModeActive
          }"
          @click.stop="selectItem(layer)"
        >
          <img 
            :src="layer.item.imageData" 
            :alt="layer.item.displayName"
            draggable="false"
            decoding="async"
            @mousedown="onItemDragStart($event, layer)"
            @touchstart="onItemDragStart($event, layer)"
          />
          
          <!-- 自由模式下的控制項 -->
          <div v-if="gameStore.canvasMode === 'free' && layer.category !== 'character' && gameStore.selectedItem?.id === layer.id" class="free-mode-controls">
            <!-- 縮放控制：反向縮放抵銷物件縮放 + 畫布縮放，確保觸控大小固定 -->
            <div v-if="gameStore.freeMode.enableFreeScale"
              class="scale-handle"
              @mousedown.stop="onScaleStart($event, layer)"
              @touchstart.stop.prevent="onScaleStart($event, layer)"
              :style="{
                transform: `scale(${1 / ((gameStore.freeMode.itemScales[layer.id] || 1) * finalCanvasScale)})`
              }"
            ></div>

            <!-- 旋轉控制：反向縮放抵銷物件縮放 + 畫布縮放 -->
            <div v-if="gameStore.freeMode.enableFreeRotation"
              class="rotate-handle"
              @mousedown.stop="onRotateStart($event, layer)"
              @touchstart.stop.prevent="onRotateStart($event, layer)"
              v-html="icons.rotate"
              :style="{
                transform: `translateX(50%) scale(${1 / ((gameStore.freeMode.itemScales[layer.id] || 1) * finalCanvasScale)})`
              }"
            ></div>
            
            <!-- 選中邊框 -->
            <div v-if="gameStore.selectedItem?.id === layer.id" class="selection-border"></div>
          </div>

          <!-- **高亮效果** -->
          <div v-if="gameStore.selectedItem?.id === layer.id" class="highlight-border"></div>
        </div>

        <!-- CSS/SVG 濾鏡效果層 -->
        <template v-for="layer in filterEffectLayers" :key="layer.id">
          <!-- CSS Overlay 類型濾鏡 -->
          <template v-if="layer.item.filterEffect?.type === 'css-overlay'">
            <div
              v-for="(ol, idx) in layer.item.filterEffect.layers"
              :key="`${layer.id}-ol-${idx}`"
              class="canvas-item filter-effect-layer"
              :style="{
                zIndex: 9000 + idx,
                background: ol.background,
                mixBlendMode: ol.mixBlendMode || 'normal',
                backdropFilter: ol.backdropFilter || 'none',
                WebkitBackdropFilter: ol.backdropFilter || 'none',
                opacity: ol.opacity ?? 1,
              }"
            ></div>
          </template>

          <!-- SVG Filter 類型濾鏡 -->
          <template v-if="layer.item.filterEffect?.type === 'svg-filter'">
            <svg class="filter-svg-defs" width="0" height="0" :aria-hidden="true">
              <defs v-html="layer.item.filterEffect.svgFilter"></defs>
            </svg>
            <div
              class="canvas-item filter-effect-layer"
              :style="{
                zIndex: 9000,
                filter: `url(#${getSvgFilterId(layer.item.filterEffect.svgFilter)})`,
                opacity: layer.item.filterEffect.opacity ?? 0.2,
                background: 'rgba(128,128,128,0.5)',
              }"
            ></div>
          </template>
        </template>
      </div>
    </div>

    <!-- **平板和手機版的內嵌物件選單** -->
    <div v-if="gameStore.ui.isTablet || gameStore.ui.isMobile" 
         class="embedded-layer-panel">
      <LayerPanel />
    </div>
    
    <!-- 空狀態提示 -->
    <div v-if="orderedLayers.length === 0" class="empty-state">
      <div class="empty-icon" v-html="icons.dress"></div>
      <div class="empty-text">從衣櫃中選擇物件開始換裝</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';
import LayerPanel from './LayerPanel.vue';
import Controls from './Controls.vue';

const gameStore = useGameStore();
const canvasViewport = ref(null);
const canvas = ref(null);
const controlsRef = ref(null);

// --- 手型工具模式 ---
const panModeActive = ref(false);
const middleButtonDragging = ref(false);

const onPanModeChange = (active) => {
  panModeActive.value = active;
};

// --- 互動狀態 ---
const dragState = ref({ isDragging: false, dragItem: null, startX: 0, startY: 0, startPos: { x: 0, y: 0 } });
const scaleState = ref({ isScaling: false, scaleItem: null, startY: 0, startScale: 1 });
const rotateState = ref({ isRotating: false, rotateItem: null, startAngle: 0, startRotation: 0, centerX: 0, centerY: 0 });
const canvasDragState = ref({ isDragging: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 } });

// --- 共用輔助函式 ---
const getClientPos = (e) => ({
  x: e.touches ? e.touches[0].clientX : e.clientX,
  y: e.touches ? e.touches[0].clientY : e.clientY
});

const addGlobalListeners = (moveHandler, endHandler) => {
  window.addEventListener('mousemove', moveHandler);
  window.addEventListener('mouseup', endHandler);
  window.addEventListener('touchmove', moveHandler, { passive: false });
  window.addEventListener('touchend', endHandler);
};

const removeGlobalListeners = (moveHandler, endHandler) => {
  window.removeEventListener('mousemove', moveHandler);
  window.removeEventListener('mouseup', endHandler);
  window.removeEventListener('touchmove', moveHandler);
  window.removeEventListener('touchend', endHandler);
};

// --- Computed: 核心邏輯 ---
const baseCanvasScale = computed(() => {
  if (!canvasViewport.value) return 1;
  const rect = canvasViewport.value.getBoundingClientRect();
  const hasBackground = (gameStore.currentOutfit.background?.length || 0) > 0;
  const targetSize = hasBackground ? gameStore.backgroundSize : gameStore.canvasSize;

  const padding = 20;
  const availableWidth = Math.max(rect.width - padding * 2, 100);
  const availableHeight = Math.max(rect.height - padding * 2, 100);

  const scaleX = availableWidth / targetSize.width;
  const scaleY = availableHeight / targetSize.height;

  return Math.min(scaleX, scaleY, 1);
});

const finalCanvasScale = computed(() => {
  return baseCanvasScale.value * gameStore.canvasZoom;
});

const canvasStyle = computed(() => {
  const hasBackground = (gameStore.currentOutfit.background?.length || 0) > 0;
  const canvasSize = hasBackground ? gameStore.backgroundSize : gameStore.canvasSize;
  
  return {
    width: `${canvasSize.width}px`,
    height: `${canvasSize.height}px`,
    transform: `scale(${finalCanvasScale.value}) translate(${gameStore.canvasPan.x}px, ${gameStore.canvasPan.y}px)`,
    transformOrigin: 'center center',
    backgroundColor: hasBackground ? 'transparent' : 'var(--color-bg-canvas)',
  };
});

// **使用 store 中的 currentLayers getter**
const orderedLayers = computed(() => gameStore.currentLayers);

const visibleLayers = computed(() => orderedLayers.value.filter(l => !gameStore.isLayerHidden(l.id)));

const backgroundLayers = computed(() => 
  visibleLayers.value.filter(l => l.category === 'background')
);
const foregroundLayers = computed(() => 
  visibleLayers.value.filter(l => l.category !== 'background' && !l.item.filterEffect)
);
const filterEffectLayers = computed(() =>
  visibleLayers.value.filter(l => l.item.filterEffect)
);

// 從 SVG filter 字串擷取 filter id
const getSvgFilterId = (svgStr) => {
  const match = svgStr?.match(/id=['"]([^'"]+)['"]/);
  return match ? match[1] : '';
};

// --- 樣式計算方法 ---
const getItemStyle = (layer) => {
  const style = { zIndex: layer.zIndex };

  if (layer.category === 'filter') {
    style.pointerEvents = 'none';
  }
  
  if (gameStore.canvasMode === 'free') {
    const pos = gameStore.freeMode.itemPositions[layer.id] || { x: 0, y: 0 };
    const scale = gameStore.freeMode.itemScales[layer.id] || 1;
    const flip = gameStore.freeMode.itemFlips[layer.id] || { x: false, y: false };
    const rotation = gameStore.freeMode.itemRotations[layer.id] || 0;
    
    let transform = `translate(${pos.x}px, ${pos.y}px)`;
    transform += ` scale(${flip.x ? -scale : scale}, ${flip.y ? -scale : scale})`;
    if (gameStore.freeMode.enableFreeRotation) {
      transform += ` rotate(${rotation}deg)`;
    }
    
    style.transform = transform;
    style.cursor = 'move';
  }
  
  return style;
};

// --- **物件選擇** ---
const selectItem = (layer) => {
  gameStore.selectItem(layer);
};

// **畫布點擊處理**
const handleCanvasClick = (e) => {
  if (e.target === canvasViewport.value || e.target === canvas.value) {
    gameStore.clearSelection();
  }
};

// --- 畫布滾輪縮放 ---
const handleWheel = (e) => {
  // 滑鼠滾輪縮放，不需要按 Ctrl
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  gameStore.setCanvasZoom(gameStore.canvasZoom * delta);
};

// --- 觸控手勢縮放 ---
const touchState = ref({
  isMultiTouch: false,
  initialDistance: 0,
  initialZoom: 1,
  lastTouchX: 0,
  lastTouchY: 0,
});

const getDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const onTouchStart = (e) => {
  if (e.touches.length === 2) {
    // 雙指觸控 - 準備縮放
    e.preventDefault();
    touchState.value.isMultiTouch = true;
    touchState.value.initialDistance = getDistance(e.touches);
    touchState.value.initialZoom = gameStore.canvasZoom;
  } else if (e.touches.length === 1) {
    // 單指觸控 - 拖拽
    touchState.value.isMultiTouch = false;
    onCanvasDragStart(e);
  }
};

const onTouchMove = (e) => {
  if (touchState.value.isMultiTouch && e.touches.length === 2) {
    e.preventDefault();
    const currentDistance = getDistance(e.touches);
    const scale = currentDistance / touchState.value.initialDistance;
    const newZoom = touchState.value.initialZoom * scale;
    gameStore.setCanvasZoom(newZoom);
  }
};

const onTouchEnd = (e) => {
  if (touchState.value.isMultiTouch) {
    touchState.value.isMultiTouch = false;
    if (e.touches.length === 0) {
      if (gameStore.debouncedSaveAppState) gameStore.debouncedSaveAppState();
    }
  }
};

// --- 畫布拖拽 ---
const onCanvasDragStart = (e) => {
  // 中鍵點擊 (button === 1) 或手型工具模式時，強制啟用拖曳
  const isMiddleButton = e.button === 1;
  const isPanMode = panModeActive.value;
  
  if (isMiddleButton) {
    e.preventDefault(); // 防止中鍵的自動滾動行為
    middleButtonDragging.value = true;
  }
  
  // 如果不是中鍵或手型模式，使用原本的邏輯
  if (!isMiddleButton && !isPanMode) {
    if (gameStore.canvasZoom <= 1 || e.target.tagName === 'IMG') return;
  }
  
  const pos = getClientPos(e);
  canvasDragState.value = { isDragging: true, startX: pos.x, startY: pos.y, startPan: { ...gameStore.canvasPan } };
  addGlobalListeners(onCanvasDragging, onCanvasDragEnd);
};

const onCanvasDragging = (e) => {
  if (!canvasDragState.value.isDragging) return;
  e.preventDefault();
  
  const pos = getClientPos(e);
  const dx = (pos.x - canvasDragState.value.startX) / finalCanvasScale.value;
  const dy = (pos.y - canvasDragState.value.startY) / finalCanvasScale.value;
  
  gameStore.setCanvasPan({
    x: canvasDragState.value.startPan.x + dx,
    y: canvasDragState.value.startPan.y + dy
  });
};

const onCanvasDragEnd = () => {
  if (canvasDragState.value.isDragging && gameStore.debouncedSaveAppState) {
    gameStore.debouncedSaveAppState();
  }
  canvasDragState.value.isDragging = false;
  middleButtonDragging.value = false;
  removeGlobalListeners(onCanvasDragging, onCanvasDragEnd);
};

// --- 物件拖拽 ---
const onItemDragStart = (e, layer) => {
  // 手型模式或中鍵點擊時，交給畫布拖曳處理
  if (panModeActive.value || e.button === 1) {
    onCanvasDragStart(e);
    return;
  }
  
  // 無論模式都選取物件（iOS 上 touchstart 會阻止 click 合成，所以這裡直接選取）
  gameStore.selectItem(layer);
  
  if (gameStore.canvasMode !== 'free' || layer.category === 'character') return;
  e.preventDefault(); // 僅在自由模式實際拖拽時阻止預設行為
  e.stopPropagation();
  
  const pos = getClientPos(e);
  const itemPos = gameStore.freeMode.itemPositions[layer.id] || { x: 0, y: 0 };
  dragState.value = { isDragging: true, dragItem: layer, startX: pos.x, startY: pos.y, startPos: { ...itemPos } };
  
  addGlobalListeners(onItemDragging, onItemDragEnd);
};

const onItemDragging = (e) => {
  if (!dragState.value.isDragging) return;
  e.preventDefault();
  
  const pos = getClientPos(e);
  const dx = (pos.x - dragState.value.startX) / finalCanvasScale.value;
  const dy = (pos.y - dragState.value.startY) / finalCanvasScale.value;
  
  gameStore.setItemPosition(dragState.value.dragItem.id, {
    x: dragState.value.startPos.x + dx,
    y: dragState.value.startPos.y + dy
  });
};

const onItemDragEnd = () => {
  if (dragState.value.isDragging) gameStore.recordHistory();
  dragState.value.isDragging = false;
  removeGlobalListeners(onItemDragging, onItemDragEnd);
};

// --- 縮放控制 ---
const onScaleStart = (e, layer) => {
  if (!gameStore.freeMode.enableFreeScale) return;
  e.stopPropagation();
  
  const pos = getClientPos(e);
  scaleState.value = {
    isScaling: true, scaleItem: layer,
    startY: pos.y, startScale: gameStore.freeMode.itemScales[layer.id] || 1
  };
  addGlobalListeners(onScaling, onScaleEnd);
};

const onScaling = (e) => {
  if (!scaleState.value.isScaling) return;
  e.preventDefault();
  
  const dy = (getClientPos(e).y - scaleState.value.startY) / 100;
  gameStore.setItemScale(scaleState.value.scaleItem.id, 
    Math.max(0.1, Math.min(5, scaleState.value.startScale + dy))
  );
};

const onScaleEnd = () => {
  if (scaleState.value.isScaling) gameStore.recordHistory();
  scaleState.value.isScaling = false;
  removeGlobalListeners(onScaling, onScaleEnd);
};

// --- 旋轉控制 ---
const onRotateStart = (e, layer) => {
  if (!gameStore.freeMode.enableFreeRotation) return;
  e.stopPropagation();
  
  const rect = e.target.closest('.canvas-item').getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // 使用 getClientPos 統一處理滑鼠和觸控事件
  const pos = getClientPos(e);
  
  rotateState.value = {
    isRotating: true, rotateItem: layer,
    startAngle: Math.atan2(pos.y - centerY, pos.x - centerX) * 180 / Math.PI,
    startRotation: gameStore.freeMode.itemRotations[layer.id] || 0,
    centerX, centerY
  };
  addGlobalListeners(onRotating, onRotateEnd);
};

const onRotating = (e) => {
  if (!rotateState.value.isRotating) return;
  e.preventDefault();
  
  // 使用 getClientPos 統一處理滑鼠和觸控事件
  const pos = getClientPos(e);
  const currentAngle = Math.atan2(
    pos.y - rotateState.value.centerY,
    pos.x - rotateState.value.centerX
  ) * 180 / Math.PI;
  
  const newRotation = ((rotateState.value.startRotation + currentAngle - rotateState.value.startAngle) % 360 + 360) % 360;
  gameStore.setItemRotation(rotateState.value.rotateItem.id, newRotation);
};

const onRotateEnd = () => {
  if (rotateState.value.isRotating) gameStore.recordHistory();
  rotateState.value.isRotating = false;
  removeGlobalListeners(onRotating, onRotateEnd);
};

// --- 鍵盤快捷鍵 ---
const handleKeyDown = (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case '=': case '+': e.preventDefault(); gameStore.zoomIn(); break;
      case '-': e.preventDefault(); gameStore.zoomOut(); break;
      case '0': e.preventDefault(); gameStore.resetZoom(); break;
    }
  }
  if (e.key === 'Delete' && gameStore.selectedItem) gameStore.removeItem(gameStore.selectedItem.item);
  if (e.key === 'Escape') gameStore.clearSelection();
};

// --- 生命週期 ---
onMounted(() => window.addEventListener('keydown', handleKeyDown));

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  // 清理所有可能的事件監聽器
  removeGlobalListeners(onItemDragging, onItemDragEnd);
  removeGlobalListeners(onCanvasDragging, onCanvasDragEnd);
  removeGlobalListeners(onScaling, onScaleEnd);
  removeGlobalListeners(onRotating, onRotateEnd);
});
</script>

<style scoped>
/* ========================================
   Dressing.vue 樣式
   ----------------------------------------
   目錄：
   1. 基礎結構
   2. 畫布容器
   3. 選取物件顯示
   4. 物件圖層
   5. 高亮效果
   6. 自由模式控制
   7. 內嵌物件選單
   8. 空狀態提示
   9. 響應式設計 - 平板版
   10. 響應式設計 - 手機版
   ======================================== */

/* ========================================
   1. 基礎結構
   ======================================== */
.dressing-container {
  width: 100%; 
  height: 100%; 
  display: flex;
  flex-direction: column;
  position: relative; 
  overflow: hidden;
  /* iOS Safari fallback: 先給 rgba 回退，再用 color-mix 覆蓋 */
  background-color: rgba(240, 242, 245, 0.6);
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
  min-height: 0;
}

/* ========================================
   2. 畫布容器
   ======================================== */
.canvas-viewport { 
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
}

.canvas-viewport:active {
  cursor: grabbing;
}

/* 手型工具模式 */
.canvas-viewport.pan-mode {
  cursor: grab;
}

.canvas-viewport.pan-mode:active {
  cursor: grabbing;
}

.canvas {
  position: relative;
  transform-origin: center center;
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-lg);
  flex: 0 0 auto; /* avoid flex shrink that would distort the aspect ratio */
  touch-action: none;
}

/* ========================================
   3. 選取物件顯示
   ======================================== */
.selected-item-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: color-mix(in srgb, var(--color-primary) 85%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  color: var(--color-bg-main);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  max-width: 180px;
  z-index: 51;
}

.selected-label {
  opacity: 0.8;
  font-size: 0.75rem;
}

.selected-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ========================================
   4. 物件圖層
   ======================================== */
.canvas-item {
  position: absolute;
  inset: 0;
  display: flex; 
  align-items: center; 
  justify-content: center;
  /* 移除 transition: filter — 在 iOS 上持續觸發 GPU 合成重繪 */
}

.canvas-item img {
  width: 100%; 
  height: 100%;
  object-fit: contain;
  pointer-events: auto;
  /* 避免 iOS 為每張大圖建立獨立 GPU 圖層 */
  content-visibility: auto;
}

/* 濾鏡效果層 */
.filter-effect-layer {
  pointer-events: none;
  border-radius: inherit;
}

.filter-svg-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

/* 手型模式下物件不可互動 */
.canvas-item.pan-mode-active {
  pointer-events: none;
}

/* 背景層 */
.background-layer {
  z-index: 1;
}

.background-layer img {
  object-fit: cover;
}

/* 拖拽狀態 */
.canvas-item.is-dragging { 
  opacity: 0.7; 
  z-index: 9999 !important; 
}

/* 選取狀態 */
.canvas-item.is-selected {
  z-index: 9998 !important;
}

/* ========================================
   5. 高亮效果
   ======================================== */
.canvas-item.is-highlighted {
  filter: drop-shadow(0 0 8px var(--color-primary));
}

.highlight-border {
  position: absolute;
  inset: -4px;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-md);
  pointer-events: none;
  animation: pulse 2s infinite;
}

/* ========================================
   6. 自由模式控制
   ======================================== */
.free-mode-controls {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1001;
}

/* 選中邊框 */
.selection-border {
  position: absolute;
  inset: -2px;
  border: 2px dashed var(--color-primary);
  pointer-events: none;
  z-index: 1002;
}

/* 縮放控制把手 — 基礎大小 44px，會被 counter-scale 補償到螢幕上固定 44px */
.scale-handle {
  position: absolute;
  bottom: -8px; right: -8px;
  width: 44px; height: 44px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-bg-panel));
  border: 2px solid var(--color-bg-card);
  border-radius: 0 50% 0 50%;
  cursor: nwse-resize;
  pointer-events: auto;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-inverse);
  font-size: 0.75rem;
  z-index: 1003;
  touch-action: none;
}

.scale-handle::after {
  content: '➘';
  font-size: 1.4rem;
  font-weight: bold;
}

/* 旋轉控制把手 — 基礎大小 44px，counter-scale 保持固定螢幕大小 */
.rotate-handle {
  position: absolute;
  top: -8px; right: 50%;
  /* translateX(50%) 由 inline style 設定，與 counter-scale 合併 */
  width: 44px; height: 44px;
  background: radial-gradient(circle at 30% 30%, var(--color-accent-gold), var(--color-accent-gold-dark));
  border: 2px solid var(--color-bg-card);
  border-radius: var(--radius-full);
  cursor: grab;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: var(--color-text-primary);
  box-shadow: var(--shadow-md);
  z-index: 1003;
  touch-action: none;
}

.rotate-handle:active {
  cursor: grabbing;
}

/* ========================================
   7. 內嵌物件選單
   ======================================== */
.embedded-layer-panel {
  position: relative;
  z-index: 89;
  background-color: var(--color-bg-card);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -8px 20px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  transition: all 0.3s ease;
  max-height: clamp(130px, 20vh, 200px);
  flex-shrink: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
  /* 确保底缘是直角，不是圓角 */
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* ========================================
   8. 空狀態提示
   ======================================== */
.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--color-text-muted);
  z-index: 100;
}

/* ========================================
   9. 響應式設計 - 平板版
   ======================================== */
@media (min-width: 768px) and (max-width: 1024px) {
  .embedded-layer-panel {
    max-height: clamp(180px, 24vh, 220px);
  }
}

/* ========================================
   10. 響應式設計 - 手機版
   ======================================== */
@media (max-width: 767px) {
  /* 選取物件顯示 */
  .selected-item-badge {
    top: 8px;
    left: 8px;
    padding: 4px 10px;
    font-size: 0.75rem;
    max-width: 150px;
  }
  
  .selected-label {
    font-size: 0.7rem;
  }

  /* 內嵌物件選單 */
  .embedded-layer-panel {
    max-height: clamp(100px, 18vh, 160px);
    min-height: 0;
  }
  
  /* 高亮效果 */
  .highlight-border {
    border-width: 2px;
  }
}
</style>

