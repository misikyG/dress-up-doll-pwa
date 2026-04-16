<template>
  <div class="dressing-container">
    <div class="canvas-viewport" ref="canvasViewport" 
         :class="{ 'pan-mode': panModeActive }"
         @wheel.prevent="handleWheel"
         @mousedown="onCanvasDragStart"
         @touchstart="onTouchStart"
         @touchmove="onTouchMove"
         @touchend="onTouchEnd"
         @click="handleCanvasClick">

      <div v-if="gameStore.selectedItem" class="selected-item-badge">
        <span class="selected-label">選取:</span>
        <span class="selected-name">{{ gameStore.selectedItem.item?.displayName || '未知' }}</span>
      </div>

      <Controls ref="controlsRef" @pan-mode-change="onPanModeChange" />
      
      <div class="canvas" :style="canvasStyle" ref="canvas">
        
        <div v-for="layer in backgroundLayers" :key="layer.id" class="canvas-item background-layer">
          <img :src="layer.item.imageData" :alt="layer.item.displayName" draggable="false" decoding="async" />
        </div>

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
        >
          <img 
            :src="layer.item.imageData" 
            :alt="layer.item.displayName"
            draggable="false"
            decoding="async"
          />

          <!-- 感應區域：僅限內容邊界範圍 -->
          <div class="item-hit-area"
            :style="getContentBoundsStyle(layer.id)"
            @click.stop="selectItem(layer)"
            @mousedown="onItemDragStart($event, layer)"
            @touchstart="onItemDragStart($event, layer)"
          ></div>
          
          <div v-if="gameStore.canvasMode === 'free' && layer.category !== 'character' && gameStore.selectedItem?.id === layer.id" class="free-mode-controls" :style="getContentBoundsStyle(layer.id)"
            @mousedown.stop="onItemDragStart($event, layer)"
            @touchstart.stop="onItemDragStart($event, layer)">
            <div v-if="gameStore.freeMode.enableFreeScale"
              class="scale-handle"
              @mousedown.stop="onScaleStart($event, layer)"
              @touchstart.stop.prevent="onScaleStart($event, layer)"
              :style="{
                transform: `scale(${1 / ((gameStore.freeMode.itemScales[layer.id] || 1) * finalCanvasScale)})`
              }"
            ></div>

            <div v-if="gameStore.freeMode.enableFreeRotation"
              class="rotate-handle"
              @mousedown.stop="onRotateStart($event, layer)"
              @touchstart.stop.prevent="onRotateStart($event, layer)"
              v-html="icons.rotate"
              :style="{
                transform: `translateX(50%) scale(${1 / ((gameStore.freeMode.itemScales[layer.id] || 1) * finalCanvasScale)})`
              }"
            ></div>
            
            <div v-if="gameStore.selectedItem?.id === layer.id" class="selection-border"></div>
          </div>

          <div v-if="gameStore.selectedItem?.id === layer.id && !(gameStore.canvasMode === 'free' && layer.category !== 'character')" class="highlight-border"></div>
        </div>

        <template v-for="layer in filterEffectLayers" :key="layer.id">
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

    <div v-if="gameStore.ui.isTablet || gameStore.ui.isMobile" 
         class="embedded-layer-panel">
      <LayerPanel />
    </div>
    
    <div v-if="orderedLayers.length === 0" class="empty-state">
      <div class="empty-icon" v-html="icons.dress"></div>
      <div class="empty-text">從衣櫃中選擇物件開始換裝</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';
import LayerPanel from './LayerPanel.vue';
import Controls from './Controls.vue';

const gameStore = useGameStore();
const canvasViewport = ref(null);
const canvas = ref(null);
const controlsRef = ref(null);

const panModeActive = ref(false);
const middleButtonDragging = ref(false);

const onPanModeChange = (active) => {
  panModeActive.value = active;
};

const dragState = ref({ isDragging: false, dragItem: null, startX: 0, startY: 0, startPos: { x: 0, y: 0 } });
const scaleState = ref({ isScaling: false, scaleItem: null, startY: 0, startScale: 1 });
const rotateState = ref({ isRotating: false, rotateItem: null, startAngle: 0, startRotation: 0, centerX: 0, centerY: 0 });
const canvasDragState = ref({ isDragging: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 } });

// 用於讓 baseCanvasScale 在視窗大小變化時重新計算（不隨面板收放而變化）
const viewportSizeTrigger = ref(0);
let viewportResizeObserver = null;
let lastWindowWidth = 0;
let lastWindowHeight = 0;

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

const baseCanvasScale = computed(() => {
  // 讀取 viewportSizeTrigger 以在 viewport 大小變化時重新計算
  void viewportSizeTrigger.value;
  if (!canvasViewport.value) return 1;
  const rect = canvasViewport.value.getBoundingClientRect();
  const hasBackground = (gameStore.currentOutfit.background?.length || 0) > 0;
  const targetSize = hasBackground ? gameStore.backgroundSize : gameStore.canvasSize;

  const padding = 20;
  const availableWidth = Math.max(rect.width - padding * 2, 100);
  const availableHeight = Math.max(rect.height - padding * 2, 100);

  const scaleX = availableWidth / targetSize.width;
  const scaleY = availableHeight / targetSize.height;

  let base;
  if (gameStore.ui.isMobile) {
    // 手機版：以寬度為基準，讓畫布填滿螢幕寬度，使紙娃娃顯示更大
    base = Math.min(scaleX, 1);
  } else {
    base = Math.min(scaleX, scaleY, 1);
  }
  return base;
});

const finalCanvasScale = computed(() => {
  return baseCanvasScale.value * gameStore.canvasZoom;
});

// 同步 baseCanvasScale 到 store，用於計算手機版最大縮放
watch(baseCanvasScale, (val) => {
  gameStore._baseCanvasScale = val;
}, { immediate: true });

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

// --- 內容邊界：用於自由模式變換框定位 + 點擊感應區域 ---
const contentBoundsMap = reactive({});
watch(
  () => foregroundLayers.value,
  async (layers) => {
    // 清除已不存在的圖層的邊界快取
    const activeIds = new Set(layers.map(l => l.id));
    for (const key of Object.keys(contentBoundsMap)) {
      if (!activeIds.has(key)) delete contentBoundsMap[key];
    }
    for (const layer of layers) {
      if (contentBoundsMap[layer.id]) continue;
      const bounds = await gameStore.getContentBounds(layer.id, layer.item.imageData);
      contentBoundsMap[layer.id] = bounds;
    }
  },
  { immediate: true }
);

const getContentBoundsStyle = (layerId) => {
  const b = contentBoundsMap[layerId];
  if (!b || (b.x === 0 && b.y === 0 && b.w === 1 && b.h === 1)) {
    return {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
    };
  }
  return {
    position: 'absolute',
    left: `${b.x * 100}%`,
    top: `${b.y * 100}%`,
    width: `${b.w * 100}%`,
    height: `${b.h * 100}%`,
  };
};

const getSvgFilterId = (svgStr) => {
  const match = svgStr?.match(/id=['"]([^'"]+)['"]/);
  return match ? match[1] : '';
};

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
      // 旋轉重心放在內容邊距下緣中間
      const b = contentBoundsMap[layer.id];
      if (b && !(b.x === 0 && b.y === 0 && b.w === 1 && b.h === 1)) {
        const originX = (b.x + b.w / 2) * 100;
        const originY = (b.y + b.h) * 100;
        style.transformOrigin = `${originX}% ${originY}%`;
      } else {
        style.transformOrigin = '50% 100%';
      }
    }
    
    style.transform = transform;
    style.cursor = 'move';
  }
  
  return style;
};

const selectItem = (layer) => {
  gameStore.selectItem(layer);
};

const handleCanvasClick = (e) => {
  // 點擊 hit-area 或 free-mode-controls 以外的區域取消選取
  if (e.target.closest('.item-hit-area, .free-mode-controls')) return;
  gameStore.clearSelection();
};

const handleWheel = (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  gameStore.setCanvasZoom(gameStore.canvasZoom * delta);
};

const touchState = ref({
  isMultiTouch: false,
  initialDistance: 0,
  initialZoom: 1,
});

const getDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const onTouchStart = (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    touchState.value.isMultiTouch = true;
    touchState.value.initialDistance = getDistance(e.touches);
    touchState.value.initialZoom = gameStore.canvasZoom;
  } else if (e.touches.length === 1) {
    touchState.value.isMultiTouch = false;
    onCanvasDragStart(e);
  }
};

const onTouchMove = (e) => {
  if (touchState.value.isMultiTouch && e.touches.length === 2) {
    e.preventDefault();
    const currentDistance = getDistance(e.touches);
    const scaleRatio = currentDistance / touchState.value.initialDistance;
    const newZoom = touchState.value.initialZoom * scaleRatio;
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


const onCanvasDragStart = (e) => {
  const isMiddleButton = e.button === 1;
  const isPanMode = panModeActive.value;
  
  if (isMiddleButton) {
    e.preventDefault();
    middleButtonDragging.value = true;
  }
  
  if (!isMiddleButton && !isPanMode) {
    // 只在放大時才允許拖曳畫布；或者目標是 hit-area 時不做畫布拖曳
    if (gameStore.canvasZoom <= 1 || e.target.closest('.item-hit-area')) return;
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


const onItemDragStart = (e, layer) => {
  // iOS Safari: 確保縮放/旋轉把手的觸控不被攔截
  if (e.target.closest('.scale-handle, .rotate-handle')) return;
  
  if (panModeActive.value || e.button === 1) {
    onCanvasDragStart(e);
    return;
  }
  
  gameStore.selectItem(layer);
  
  if (gameStore.canvasMode !== 'free' || layer.category === 'character') return;
  e.preventDefault();
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

const onRotateStart = (e, layer) => {
  if (!gameStore.freeMode.enableFreeRotation) return;
  e.stopPropagation();
  
  const itemEl = e.target.closest('.canvas-item');
  const rect = itemEl.getBoundingClientRect();
  
  // 使用內容邊距下緣中間作為旋轉中心
  const b = contentBoundsMap[layer.id];
  let centerX, centerY;
  if (b && !(b.x === 0 && b.y === 0 && b.w === 1 && b.h === 1)) {
    centerX = rect.left + (b.x + b.w / 2) * rect.width;
    centerY = rect.top + (b.y + b.h) * rect.height;
  } else {
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height;
  }
  
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

const handleKeyDown = (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case '=': case '+': e.preventDefault(); gameStore.zoomIn(); break;
      case '-': e.preventDefault(); gameStore.zoomOut(); break;
      case '0': e.preventDefault(); gameStore.resetZoom(); break;
    }
  }
  if (e.key === 'Delete' && gameStore.selectedItem?.id) gameStore.removeLayerInstance(gameStore.selectedItem.id);
  if (e.key === 'Escape') gameStore.clearSelection();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  // 記錄初始視窗大小
  lastWindowWidth = window.innerWidth;
  lastWindowHeight = window.innerHeight;
  // ResizeObserver：僅在視窗大小真正改變時更新（忽略面板收放造成的元素尺寸變化）
  if (canvasViewport.value) {
    viewportResizeObserver = new ResizeObserver(() => {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      if (ww !== lastWindowWidth || wh !== lastWindowHeight) {
        lastWindowWidth = ww;
        lastWindowHeight = wh;
        viewportSizeTrigger.value++;
      }
    });
    viewportResizeObserver.observe(canvasViewport.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  if (viewportResizeObserver) {
    viewportResizeObserver.disconnect();
    viewportResizeObserver = null;
  }
  removeGlobalListeners(onItemDragging, onItemDragEnd);
  removeGlobalListeners(onCanvasDragging, onCanvasDragEnd);
  removeGlobalListeners(onScaling, onScaleEnd);
  removeGlobalListeners(onRotating, onRotateEnd);
});
</script>

<style scoped>
.dressing-container {
  width: 100%; 
  height: 100%; 
  display: flex;
  flex-direction: column;
  position: relative; 
  overflow: hidden;
  /* 回退到不透明 canvas 色，再用 color-mix 覆蓋為半透明 */
  background-color: var(--color-bg-canvas);
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
  min-height: 0;
}

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
  flex: 0 0 auto;
  touch-action: none;
  will-change: transform;
  contain: layout style;
  backface-visibility: hidden;
}

.selected-item-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  /* 使用完全不透明的 primary 色，避免在 iOS 上因半透明 + backdrop-filter 與背景融合 */
  background: var(--color-primary);
  color: #fff;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  max-width: 180px;
  z-index: 51;
  pointer-events: none;
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

.canvas-item {
  position: absolute;
  inset: 0;
  display: flex; 
  align-items: center; 
  justify-content: center;
  pointer-events: none;
  contain: layout style;
}

.canvas-item img {
  width: 100%; 
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  content-visibility: auto;
  backface-visibility: hidden;
}

.item-hit-area {
  pointer-events: auto;
  cursor: pointer;
  z-index: 1;
  touch-action: none;
}

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

.canvas-item.pan-mode-active .item-hit-area {
  pointer-events: none;
}

.background-layer {
  z-index: 1;
}

.background-layer img {
  object-fit: cover;
}


.canvas-item.is-dragging { 
  opacity: 0.7; 
  z-index: 9999 !important; 
}

.canvas-item.is-selected {
  z-index: 9998 !important;
}

.canvas-item.is-selected > .item-hit-area {
  pointer-events: none;
}

.canvas-item.is-selected .free-mode-controls {
  pointer-events: auto;
  cursor: move;
}

.highlight-border {
  position: absolute;
  inset: -4px;
  border: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  pointer-events: none;
  opacity: 0.85;
}

.free-mode-controls {
  pointer-events: none;
  z-index: 1001;
  /* position/size 由 inline style 的 getContentBoundsStyle 決定;
     未設定時 fallback 到全尺寸 */
}

.selection-border {
  position: absolute;
  left: -4px;
  top: -4px;
  right: -4px;
  bottom: -4px;
  border: 3px solid var(--color-primary);
  border-radius: 6px;
  pointer-events: none;
  z-index: 1002;
  /* 陰影暈光：使選取框更聚焦明顯，rgba 確保 iOS Safari 相容 */
  box-shadow:
    0 0 12px 4px rgba(139, 92, 75, 0.5),
    0 0 24px 8px rgba(139, 92, 75, 0.2),
    inset 0 0 8px 2px rgba(139, 92, 75, 0.15);
}

/* 縮放控制把手 */
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

/* 旋轉控制把手 */
.rotate-handle {
  position: absolute;
  top: -8px; right: 50%;
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

.embedded-layer-panel {
  position: relative;
  z-index: 89;
  background-color: var(--color-bg-card);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border-radius: 16px 16px var(--radius-lg) var(--radius-lg);
  box-shadow: 0 -8px 20px rgba(71, 45, 37, 0.12);
  box-shadow: 0 -8px 20px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  transition: all 0.3s ease;
  max-height: clamp(170px, 24vh, 240px);
  flex-shrink: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--color-text-muted);
  z-index: 100;
}

@media (min-width: 768px) and (max-width: 1024px) {
  .embedded-layer-panel {
    max-height: clamp(200px, 28vh, 260px);
  }
}

@media (max-width: 767px) {
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

  .embedded-layer-panel {
    max-height: clamp(140px, 22vh, 200px);
    min-height: 0;
  }
  
  .highlight-border {
    border-width: 2px;
  }
}
</style>

