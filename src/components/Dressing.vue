<template>
  <div class="dressing-container">
    <!-- 畫布外部容器，用於縮放 -->
    <div class="canvas-wrapper" ref="canvasWrapper">
      <!-- 畫布本身，固定尺寸 -->
      <div class="canvas" :style="canvasStyle">
        
        <!-- 背景層 (單獨處理以優化) -->
        <div v-if="backgroundLayer" class="canvas-item background-layer">
          <img :src="backgroundLayer.item.imageData" :alt="backgroundLayer.item.displayName" draggable="false" />
        </div>

        <!-- 所有非背景圖層 -->
        <div
          v-for="layer in foregroundLayers"
          :key="layer.id"
          class="canvas-item"
          :style="getItemStyle(layer)"
          :class="{ 'is-dragging': dragState.isDragging && dragState.dragItem?.id === layer.id }"
        >
          <img 
            :src="layer.item.imageData" 
            :alt="layer.item.displayName"
            draggable="false"
            @mousedown="onDragStart($event, layer)"
            @touchstart.prevent="onDragStart($event, layer)"
          />
          <!-- 自由模式下的控制項 -->
          <div v-if="gameStore.canvasMode === 'free' && layer.category !== 'character'" class="free-mode-controls">
            <div 
              class="scale-handle"
              @mousedown.stop="onScaleStart($event, layer)"
              @touchstart.stop.prevent="onScaleStart($event, layer)"
            ></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 模式指示器 -->
    <div class="mode-indicator">
      {{ gameStore.canvasMode === 'fixed' ? '固定模式' : '自由模式' }}
    </div>

    <!-- 空狀態提示 -->
    <div v-if="orderedLayers.length === 0" class="empty-state">
      <div class="empty-icon">👗</div>
      <div class="empty-text">從衣櫃中選擇物件開始換裝</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useGameStore } from '../store/index.js';

const gameStore = useGameStore();
const canvasWrapper = ref(null);

// --- 拖拽與縮放狀態 (保持不變) ---
const dragState = ref({ isDragging: false, dragItem: null, startX: 0, startY: 0, startPos: { x: 0, y: 0 } });
const scaleState = ref({ isScaling: false, scaleItem: null, startY: 0, startScale: 1 });

// --- Computed: 核心邏輯 (有修改) ---
const canvasScale = computed(() => {
  if (!canvasWrapper.value) return 1;
  const rect = canvasWrapper.value.getBoundingClientRect();
  const isBackground = gameStore.currentOutfit.background;
  const canvasSize = isBackground ? gameStore.backgroundSize : gameStore.canvasSize;
  
  const scaleX = (rect.width - 40) / canvasSize.width;
  const scaleY = (rect.height - 40) / canvasSize.height;
  return Math.min(scaleX, scaleY, 1);
});

const canvasStyle = computed(() => {
  const isBackground = gameStore.currentOutfit.background;
  const canvasSize = isBackground ? gameStore.backgroundSize : gameStore.canvasSize;
  return {
    width: `${canvasSize.width}px`,
    height: `${canvasSize.height}px`,
    transform: `scale(${canvasScale.value})`,
    backgroundColor: isBackground ? 'transparent' : 'rgba(255, 255, 255, 0.5)',
  };
});

// 將 outfit 物件轉換為有序的圖層陣列 (保持不變)
const orderedLayers = computed(() => {
  const outfit = gameStore.currentOutfit;
  const layers = [];
  const zIndexMap = {
    background: 1, character: 10, bottom: 20, top: 25, dress: 25, shoes: 30,
    outer: 35, hair: 40, expression: 45, accessory: 50, other: 60
  };

  for (const key in outfit) {
    if (outfit[key] && !Array.isArray(outfit[key])) {
      layers.push({ id: `${outfit[key].id}-${key}`, item: outfit[key], category: key, zIndex: zIndexMap[key] || 99 });
    }
  }

  outfit.accessories.forEach((item, index) => {
    layers.push({ id: `${item.id}-acc-${index}`, item, category: 'accessory', zIndex: zIndexMap.accessory + index });
  });
  outfit.others.forEach((item, index) => {
    layers.push({ id: `${item.id}-oth-${index}`, item, category: 'other', zIndex: zIndexMap.other + index });
  });

  return layers.sort((a, b) => a.zIndex - b.zIndex);
});

// **新增**: 將圖層分為背景和前景，方便模板處理
const backgroundLayer = computed(() => orderedLayers.value.find(l => l.category === 'background'));
const foregroundLayers = computed(() => orderedLayers.value.filter(l => l.category !== 'background'));

// --- 方法: 樣式與事件處理 (有修改) ---
const getItemStyle = (layer) => {
  const style = { zIndex: layer.zIndex };
  if (gameStore.canvasMode === 'free') {
    const pos = gameStore.freeMode.itemPositions[layer.id] || { x: 0, y: 0 };
    const scale = gameStore.freeMode.itemScales[layer.id] || 1;
    style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
    style.cursor = 'move';
  }
  return style;
};

// 拖拽與縮放的事件處理函式 (onDragStart, onDragging, etc.) 保持不變
const onDragStart = (e, layer) => {
    if (gameStore.canvasMode !== 'free' || layer.category === 'character') return;
    const pos = gameStore.freeMode.itemPositions[layer.id] || { x: 0, y: 0 };
    dragState.value = { isDragging: true, dragItem: layer, startX: e.touches ? e.touches[0].clientX : e.clientX, startY: e.touches ? e.touches[0].clientY : e.clientY, startPos: { ...pos }, };
    window.addEventListener('mousemove', onDragging); window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragging, { passive: false }); window.addEventListener('touchend', onDragEnd);
};
const onDragging = (e) => {
    if (!dragState.value.isDragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = (clientX - dragState.value.startX) / canvasScale.value;
    const dy = (clientY - dragState.value.startY) / canvasScale.value;
    const newPos = { x: dragState.value.startPos.x + dx, y: dragState.value.startPos.y + dy };
    gameStore.setItemPosition(dragState.value.dragItem.id, newPos);
};
const onDragEnd = () => {
    if (dragState.value.isDragging) { gameStore.recordHistory(); }
    dragState.value.isDragging = false;
    window.removeEventListener('mousemove', onDragging); window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragging); window.removeEventListener('touchend', onDragEnd);
};
const onScaleStart = (e, layer) => {
    const scale = gameStore.freeMode.itemScales[layer.id] || 1;
    scaleState.value = { isScaling: true, scaleItem: layer, startY: e.touches ? e.touches[0].clientY : e.clientY, startScale: scale, };
    window.addEventListener('mousemove', onScaling); window.addEventListener('mouseup', onScaleEnd);
    window.addEventListener('touchmove', onScaling, { passive: false }); window.addEventListener('touchend', onScaleEnd);
};
const onScaling = (e) => {
    if (!scaleState.value.isScaling) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = (scaleState.value.startY - clientY) / 100;
    const newScale = Math.max(0.1, Math.min(5, scaleState.value.startScale + dy));
    gameStore.setItemScale(scaleState.value.scaleItem.id, newScale);
};
const onScaleEnd = () => {
    if (scaleState.value.isScaling) { gameStore.recordHistory(); }
    scaleState.value.isScaling = false;
    window.removeEventListener('mousemove', onScaling); window.removeEventListener('mouseup', onScaleEnd);
    window.removeEventListener('touchmove', onScaling); window.removeEventListener('touchend', onScaleEnd);
};
</script>

<style scoped>
/* CSS 有重要修改 */
.dressing-container {
  width: 100%; height: 100%; display: flex;
  align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background-color: #f0f2f5;
}
.canvas-wrapper { 
  padding: 20px; 
  width: 100%; 
  height: 100%; 
  display: flex; /* **新增** */
  align-items: center; /* **新增** */
  justify-content: center; /* **新增** */
}
.canvas {
  position: relative;
  transform-origin: center center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-radius: 12px;
}
.canvas-item {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.canvas-item img {
  /* **關鍵修改** */
  width: 100%; 
  height: 100%;
  object-fit: contain; /* 確保圖片等比縮放並完整顯示 */
  pointer-events: auto; /* 只有圖片可以被點擊 */
}
.background-layer {
  z-index: 1; /* 確保背景在最底層 */
}
.background-layer img {
  object-fit: cover; /* 背景圖使用 cover 填滿 */
}
.canvas-item.is-dragging { 
  opacity: 0.7; 
  z-index: 9999 !important; 
}

.free-mode-controls {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  border: 1px dashed rgba(106, 108, 255, 0.5);
  pointer-events: none;
}
.scale-handle {
  position: absolute; bottom: -8px; right: -8px;
  width: 16px; height: 16px; background-color: var(--primary-color);
  border: 2px solid white; border-radius: 50%;
  cursor: nwse-resize; pointer-events: auto;
}

.mode-indicator {
  position: absolute; top: 20px; left: 20px;
  background: rgba(0,0,0,0.6); color: white;
  padding: 8px 12px; border-radius: 20px; font-size: 0.9rem;
}
.empty-state {
  position: absolute; text-align: center; color: #999;
}
.empty-icon { font-size: 4rem; }
</style>