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
          
          <div v-if="gameStore.canvasMode === 'free' && layer.category !== 'character' && gameStore.selectedItem?.id === layer.id" class="free-mode-controls" :style="getContentBoundsStyle(layer.id)">
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

          <div v-if="gameStore.selectedItem?.id === layer.id" class="highlight-border" :style="getHighlightBoundsStyle(layer.id)"></div>
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

// --- 內容邊界：用於自由模式變換框定位 ---
const contentBoundsMap = reactive({});
watch(
  () => gameStore.canvasMode === 'free' ? foregroundLayers.value : [],
  async (layers) => {
    for (const layer of layers) {
      if (layer.category === 'character' || contentBoundsMap[layer.id]) continue;
      const bounds = await gameStore.getContentBounds(layer.id, layer.item.imageData);
      contentBoundsMap[layer.id] = bounds;
    }
  },
  { immediate: true }
);

const getContentBoundsStyle = (layerId) => {
  const b = contentBoundsMap[layerId];
  if (!b || (b.x === 0 && b.y === 0 && b.w === 1 && b.h === 1)) return {};
  return {
    position: 'absolute',
    left: `${b.x * 100}%`,
    top: `${b.y * 100}%`,
    width: `${b.w * 100}%`,
    height: `${b.h * 100}%`,
  };
};

const getHighlightBoundsStyle = (layerId) => {
  const b = contentBoundsMap[layerId];
  if (!b || gameStore.canvasMode !== 'free' || (b.x === 0 && b.y === 0 && b.w === 1 && b.h === 1)) return {};
  const pad = 4; // px, matching the original -4px inset
  return {
    position: 'absolute',
    left: `calc(${b.x * 100}% - ${pad}px)`,
    top: `calc(${b.y * 100}% - ${pad}px)`,
    width: `calc(${b.w * 100}% + ${pad * 2}px)`,
    height: `calc(${b.h * 100}% + ${pad * 2}px)`,
    inset: 'auto',
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
  if (e.target === canvasViewport.value || e.target === canvas.value) {
    gameStore.clearSelection();
  }
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
  initialAngle: 0,
  initialItemScale: 1,
  initialItemRotation: 0,
  targetItemId: null, // 非 null 時代表操作選取物件而非畫布
  lastTouchX: 0,
  lastTouchY: 0,
});

const getDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const getAngle = (touches) => {
  return Math.atan2(
    touches[1].clientY - touches[0].clientY,
    touches[1].clientX - touches[0].clientX
  ) * 180 / Math.PI;
};

const onTouchStart = (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    touchState.value.isMultiTouch = true;
    touchState.value.initialDistance = getDistance(e.touches);
    touchState.value.initialAngle = getAngle(e.touches);

    // 自由模式 + 有選取物件（非角色）→ 操作物件
    const sel = gameStore.selectedItem;
    if (gameStore.canvasMode === 'free' && sel && sel.category !== 'character') {
      touchState.value.targetItemId = sel.id;
      touchState.value.initialItemScale = gameStore.freeMode.itemScales[sel.id] || 1;
      touchState.value.initialItemRotation = gameStore.freeMode.itemRotations[sel.id] || 0;
    } else {
      touchState.value.targetItemId = null;
      touchState.value.initialZoom = gameStore.canvasZoom;
    }
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

    if (touchState.value.targetItemId) {
      // 操作選取的物件
      const id = touchState.value.targetItemId;

      // 縮放
      if (gameStore.freeMode.enableFreeScale) {
        const newScale = Math.max(0.1, Math.min(5, touchState.value.initialItemScale * scaleRatio));
        gameStore.setItemScale(id, newScale);
      }

      // 旋轉
      if (gameStore.freeMode.enableFreeRotation) {
        const currentAngle = getAngle(e.touches);
        const angleDelta = currentAngle - touchState.value.initialAngle;
        const newRotation = ((touchState.value.initialItemRotation + angleDelta) % 360 + 360) % 360;
        gameStore.setItemRotation(id, newRotation);
      }
    } else {
      // 操作畫布縮放
      const newZoom = touchState.value.initialZoom * scaleRatio;
      gameStore.setCanvasZoom(newZoom);
    }
  }
};

const onTouchEnd = (e) => {
  if (touchState.value.isMultiTouch) {
    if (touchState.value.targetItemId) {
      gameStore.recordHistory();
    }
    touchState.value.isMultiTouch = false;
    touchState.value.targetItemId = null;
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


const onItemDragStart = (e, layer) => {
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
  
  const rect = e.target.closest('.canvas-item').getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
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
  if (e.key === 'Delete' && gameStore.selectedItem) gameStore.removeItem(gameStore.selectedItem.item);
  if (e.key === 'Escape') gameStore.clearSelection();
};

onMounted(() => window.addEventListener('keydown', handleKeyDown));

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
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
  /* iOS Safari fallback: 先給 rgba 回退，再用 color-mix 覆蓋 */
  background-color: rgba(240, 242, 245, 0.6);
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
}

.selected-item-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  /* iOS Safari fallback: color-mix 不支援時使用 rgba */
  background: rgba(97, 139, 106, 0.85);
  background: color-mix(in srgb, var(--color-primary) 85%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
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
}

.canvas-item img {
  width: 100%; 
  height: 100%;
  object-fit: contain;
  pointer-events: auto;
  content-visibility: auto;
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

.canvas-item.pan-mode-active {
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

.canvas-item.is-highlighted {}

.highlight-border {
  position: absolute;
  inset: -4px;
  border: 3px solid var(--color-primary);
  border-radius: var(--radius-md);
  pointer-events: none;
  opacity: 0.85;
}

.free-mode-controls {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1001;
}

.selection-border {
  position: absolute;
  inset: -2px;
  border: 2px dashed var(--color-primary);
  pointer-events: none;
  z-index: 1002;
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
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -8px 20px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  transition: all 0.3s ease;
  max-height: clamp(170px, 24vh, 240px);
  flex-shrink: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: visible;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
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

