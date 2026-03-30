<template>
  <div class="layer-panel" :class="{ 
    'mobile-collapsed': gameStore.ui.isMobile && gameStore.ui.layerPanelCollapsed,
    'mobile-layout': gameStore.ui.isMobile,
    'is-empty': !gameStore.ui.layerPanelCollapsed && layers.length === 0,
    'is-collapsed': gameStore.ui.layerPanelCollapsed
  }">
    <!-- 頂部收合把手 (桌面版和平板版) -->
    <button 
      v-if="!gameStore.ui.isMobile && (gameStore.ui.layerPanelCollapsed || layers.length > 0)"
      @click="gameStore.toggleLayerPanel()" 
      class="panel-toggle-handle panel-toggle-handle--top" 
      :title="gameStore.ui.layerPanelCollapsed ? '展開物件選單' : '收合物件選單'"
    >
      <span class="icon" :class="{ 'collapsed': gameStore.ui.layerPanelCollapsed }">▼</span>
    </button>

    <!-- 手機版頂部控制欄（含收合手把） -->
    <div v-if="gameStore.ui.isMobile" class="mobile-layer-header" @click="gameStore.toggleLayerPanel()">
      <div class="mobile-drawer-handle"></div>
      <div class="mobile-layer-title">
        <span>物件列表</span>
        <span v-if="layers.length > 0" class="layer-count-badge">{{ layers.length }}</span>
      </div>
      <div v-if="!gameStore.ui.layerPanelCollapsed && layers.length > 0" class="mobile-layer-actions" @click.stop>
        <button @click="resetOrder" class="action-btn" title="重置順序" v-html="icons.reset"></button>
      </div>
    </div>

    <!-- 物件列表 -->
    <div v-if="!gameStore.ui.layerPanelCollapsed" class="layer-list-container">
      <div v-if="layers.length === 0" class="empty-state">
        <!-- 收合手把 (桌面版和平板版) -->
        <button 
          v-if="!gameStore.ui.isMobile"
          @click="gameStore.toggleLayerPanel()" 
          class="empty-state-toggle-handle" 
          title="收合物件選單"
        >
          <span class="icon">▼</span>
        </button>
        <span class="empty-icon" v-html="icons.dress"></span>
        <span class="empty-text">畫布上暫無物件</span>
      </div>
      
      <div v-else class="layer-list" ref="layerList" @wheel="handleHorizontalScroll">
        <draggable
          v-model="layersList"
          item-key="id"
          handle=".drag-handle"
          :animation="200"
          ghost-class="layer-item-ghost"
          chosen-class="layer-item-chosen"
          drag-class="layer-item-drag"
          class="layer-draggable-container"
          :delay="150"
          :delay-on-touch-only="true"
          :touch-start-threshold="5"
          direction="horizontal"
          @start="onDragStart"
          @end="onDragEnd"
        >
          <template #item="{ element: layer, index }">
            <div
              :class="['layer-item', { 
                'selected': gameStore.selectedItem?.id === layer.id,
                'hidden': isLayerHidden(layer.id)
              }]"
              @click="selectLayer(layer)"
              @contextmenu="onLayerContextMenu(layer, $event)"
              @touchstart="onLayerTouchStart(layer, $event)"
              @touchend="onLayerTouchEnd"
              @touchcancel="onLayerTouchEnd"
            >
          <!-- 物件縮圖 (使用縮圖而非完整圖片，避免解碼 2000×3800 原圖佔用 ~30MB/張) -->
          <div class="layer-thumbnail">
            <img :src="layer.item.thumbnailData || layer.item.imageData" :alt="layer.item.displayName" loading="lazy" decoding="async" />
            <div v-if="gameStore.selectedItem?.id === layer.id" class="selected-indicator">✓</div>
            <div v-if="isLayerHidden(layer.id)" class="hidden-indicator" title="已隱藏" v-html="icons.eyeHide"></div>
          </div>
          
          <!-- 物件信息 -->
          <div class="layer-info">
            <span class="layer-name" :title="getLayerDisplayTitle(layer)">
              {{ layer.item.displayName }}<span v-if="getVariantLabel(layer)" class="variant-label">{{ getVariantLabel(layer) }}</span>
            </span>
            <span class="layer-category">
              {{ getCategoryName(layer.category) }}
            </span>
          </div>
          
          <!-- 層級控制按鈕 -->
          <div class="layer-controls">
            <button @click.stop="moveUp(layer.id)" 
                    :disabled="index === 0"
                    class="layer-btn" 
                    title="上移">▲</button>
            <button @click.stop="moveDown(layer.id)" 
                    :disabled="index === layers.length - 1"
                    class="layer-btn" 
                    title="下移">▼</button>
          </div>
          
          <!-- 拖拽指示器 -->
          <div 
            class="drag-handle" 
            title="拖拽重新排序"
          >≡</div>
        </div>
          </template>
        </draggable>
      </div>
    </div>

    <!-- 底部控制欄 (桌面版和平板版) -->
    <div v-if="!gameStore.ui.isMobile" class="layer-panel-footer">
      <!-- 物件列表字樣 -->
      <div class="layer-panel-title">
        <span>物件列表</span>
        <span v-if="layers.length > 0" class="layer-count-badge">{{ layers.length }}</span>
      </div>
      
      <div v-if="!gameStore.ui.layerPanelCollapsed && layers.length > 0" class="layer-actions">
        <button @click="resetOrder" class="action-btn" title="重置順序" v-html="icons.reset"></button>
      </div>
    </div>
    
    <!-- 右鍵 / 長按選單 -->
    <Teleport to="body">
      <div v-if="contextMenu.visible" class="layer-context-overlay" @click="closeContextMenu">
        <div class="layer-context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
          <div class="layer-context-header">
            <span class="layer-context-title">{{ contextMenu.layer?.item?.displayName }}</span>
            <button class="layer-context-close" @click="closeContextMenu">✕</button>
          </div>
          <div class="layer-context-content">
            <button class="layer-context-option" @click="toggleLayerVisibility">
              <span class="option-icon" v-html="isLayerHidden(contextMenu.layer?.id) ? icons.eyeShow : icons.eyeHide"></span>
              <span class="option-name">{{ isLayerHidden(contextMenu.layer?.id) ? '顯示' : '隱藏' }}</span>
            </button>
            <button class="layer-context-option danger" @click="deleteLayer">
              <span class="option-icon" v-html="icons.trash"></span>
              <span class="option-name">刪除</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';
import draggable from 'vuedraggable';

const gameStore = useGameStore();
const layerList = ref(null);
const contextMenu = ref({ visible: false, layer: null, x: 0, y: 0 });
let longPressTimer = null;

const handleHorizontalScroll = (event) => {
  if (layerList.value) {
    event.preventDefault();
    layerList.value.scrollLeft += event.deltaY;
  }
};

const layers = computed(() => {
  return [...gameStore.currentLayers].reverse();
});

const layersList = computed({
  get: () => layers.value,
  set: (newLayers) => {
    // draggable 會直接修改這個列表，我們需要反轉回來更新 store
    const reorderedLayers = [...newLayers].reverse();
    gameStore.updateLayerOrder(reorderedLayers);
  }
});

const isLayerHidden = (layerId) => gameStore.isLayerHidden(layerId);

const selectLayer = (layer) => {
  gameStore.toggleSelectItem(layer);
};

const getCategoryName = (category) => {
  return gameStore.getCategoryName(category);
};

const getVariantLabel = (layer) => {
  const item = layer.item;
  if (!item?.hasVariant && !item?.variants?.length) return null;
  const currentKey = item.currentVariant || item.defaultVariant || null;
  const variant = item.variants?.find(v => (v.key || v) === currentKey);
  const name = variant ? (variant.name || variant.key || variant) : null;
  return name ? ` (${name})` : null;
};

const getLayerDisplayTitle = (layer) => {
  const label = getVariantLabel(layer);
  return label ? layer.item.displayName + label : layer.item.displayName;
};

const moveUp = (layerId) => {
  gameStore.moveLayerUp(layerId);
};

const moveDown = (layerId) => {
  gameStore.moveLayerDown(layerId);
};

const resetOrder = () => {
  if (confirm('確定要重置所有物件的層級順序嗎？')) {
    gameStore.resetLayerOrder();
  }
};

const onLayerContextMenu = (layer, event) => {
  event.preventDefault();
  event.stopPropagation();

  const menuWidth = 180;
  const menuHeight = 160;
  let x = event.clientX || event.touches?.[0]?.clientX || 0;
  let y = event.clientY || event.touches?.[0]?.clientY || 0;

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 12;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 12;
  }

  contextMenu.value = { visible: true, layer, x, y };
};

const closeContextMenu = () => {
  contextMenu.value = { visible: false, layer: null, x: 0, y: 0 };
};

const toggleLayerVisibility = () => {
  if (!contextMenu.value.layer) return;
  gameStore.toggleLayerHidden(contextMenu.value.layer.id);
  closeContextMenu();
};

const deleteLayer = () => {
  if (!contextMenu.value.layer) return;
  const layer = contextMenu.value.layer;
  const name = layer.item?.displayName || '此物件';
  if (confirm(`確定要從畫布上移除「${name}」嗎？`)) {
    gameStore.removeItem(layer.item);
  }
  closeContextMenu();
};

const onLayerTouchStart = (layer, event) => {
  // 觸碰拖曳把手時不啟動長按選單（讓 SortableJS 處理）
  if (event.target.closest('.drag-handle')) return;
  longPressTimer = setTimeout(() => onLayerContextMenu(layer, event), 500);
};

const onLayerTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

onUnmounted(() => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
  }
});

const onDragStart = () => {
  // vuedraggable 會處理實際拖曳，這裡僅保留掛鉤
};

const onDragEnd = () => {
  // v-model 會自動更新，觸發 computed setter
};
</script>

<style scoped>
.layer-panel {
  background-color: transparent; 
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
}

.panel-toggle-handle--top {
  position: absolute;
  left: 50%;
  transform: translateX(-50%) ;
  width: 47px;
  height: 16px;
  background: color-mix(in srgb, var(--color-text-primary) 75%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: none;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--color-bg-card);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  border-radius: 0 0 50px 50px;
  padding: 0;
}

.panel-toggle-handle--top:hover {
  background: var(--color-primary);
  width: 47px;
  height: 20px;
  border-radius: 0 0 50px 50px;
}

.panel-toggle-handle--top .icon {
  transition: transform 0.2s ease;
}

.panel-toggle-handle--top .icon.collapsed {
  transform: rotate(180deg);
}

.layer-panel.is-collapsed .panel-toggle-handle--top {
  display: flex;
}

.panel-toggle-handle--bottom {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 50px;
  height: 20px;
  background: color-mix(in srgb, var(--color-text-primary) 75%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: none;
  cursor: pointer;
  z-index: 10;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: var(--color-bg-card);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  border-radius: 50px 50px 0 0;
  padding: 0;
}

.panel-toggle-handle--bottom:hover {
  background: var(--color-primary);
  height: 26px;
}

.panel-toggle-handle--bottom .icon {
  transition: transform 0.2s ease;
}

.layer-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background-color: var(--color-bg-panel);
  position: relative;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.layer-panel-footer.mobile-style {
  padding: 0.25rem 1rem;
  background-color: transparent;
}

.layer-panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.layer-count-badge {
  background: var(--color-primary);
  color: var(--color-bg-card);
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-weight: 500;
}

.layer-count {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.layer-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.action-btn {
  background: none;
  border: 1px solid var(--color-border);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.delete-btn {
  border-color: var(--color-danger, var(--color-error));
  color: var(--color-danger, var(--color-error));
}

.delete-btn:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-error) 15%, transparent);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: clamp(120px, 22vh, 160px);
  max-height: clamp(170px, 28vh, 320px);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  background-color: var(--color-bg-card);
  border-radius: 0;
  position: relative;
  padding: 0.85rem 1rem;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.empty-state-toggle-handle {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 47px;
  height: 16px;
  background: color-mix(in srgb, var(--color-text-primary) 75%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: none;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--color-bg-card);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  border-radius: 0 0 50px 50px;
  padding: 0;
}

.empty-state-toggle-handle:hover {
  background: var(--color-primary);
  width: 47px;
  height: 20px;
  border-radius: 0 0 50px 50px;
}

.empty-state-toggle-handle .icon {
  transition: transform 0.2s ease;
}

.layer-list-container {
  min-height: clamp(120px, 22vh, 160px);
  max-height: clamp(170px, 28vh, 320px);
  border-radius: 0;
  background-color: var(--color-bg-card);
  position: relative;
  display: flex;
  flex-direction: column;
}

.layer-list {
  background-color: var(--color-bg-card);
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem 0.875rem 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  align-items: stretch;
  border-radius: 0;
  overscroll-behavior: contain;
  touch-action: pan-x;
}

.layer-draggable-container {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  width: 100%;
}

.layer-list::-webkit-scrollbar {
  height: 6px;
}

.layer-list::-webkit-scrollbar-track {
  background: var(--color-bg-panel);
  border-radius: 3px;
}

.layer-list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.layer-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}

.layer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  background-color: var(--color-bg-card);
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 0.5rem;
  cursor: grab;
  /* 避免 transition: all — 會對 transform/layout 觸發 GPU 合成 */
  transition: border-color 0.2s ease, background-color 0.2s ease;
  min-width: 80px;
  position: relative;
  -webkit-user-select: none;
  user-select: none;
}

.layer-item:active {
  cursor: grabbing;
}

@media (hover: hover) {
  .layer-item:hover {
    border-color: var(--color-border);
    transform: translateY(-1px);
  }
}

.layer-item.selected {
  border-color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

.layer-item-ghost {
  opacity: 0.4;
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border: 2px dashed var(--color-primary);
}

.layer-item-chosen {
  cursor: grabbing !important;
}

.layer-item-drag {
  opacity: 0.8;
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  cursor: grabbing !important;
}

.layer-thumbnail {
  width: 64px;
  height: 64px;
  /* 棋盤格背景讓透明圖片清晰可見，避免瀏覽器預設透明區看起來像空白 */
  background-color: var(--color-bg-canvas);
  background-image:
    linear-gradient(45deg, rgba(0,0,0,0.06) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(0,0,0,0.06) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.06) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.06) 75%);
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.layer-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.selected-indicator {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 16px;
  height: 16px;
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border-radius: 50%;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hidden-indicator {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  background-color: var(--color-border);
  color: var(--color-text-primary);
  border-radius: 50%;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-text-primary) 18%, transparent);
}

.layer-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 0;
}

.layer-name {
  font-size: 0.8rem;
  font-weight: 500;
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.variant-label {
  font-size: 0.7rem;
  color: var(--color-warning);
  font-weight: 400;
}

.layer-category {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  max-width: 70px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-controls {
  position: absolute;
  top: 2px;
  left: 2px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  opacity: 1;
  transition: opacity 0.2s ease;
}

@media (hover: hover) {
  .layer-controls {
    opacity: 0;
  }
  .layer-item:hover .layer-controls {
    opacity: 1;
  }
}

.layer-btn {
  width: 16px;
  height: 16px;
  background-color: color-mix(in srgb, var(--color-border) 90%, transparent);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.layer-btn:hover {
  background-color: var(--color-bg-card);
}

.layer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drag-handle {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 1rem;
  color: var(--color-text-secondary);
  
  padding: 0;
  border-radius: 10px;
  opacity: 1;
  background-color: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

@media (hover: hover) {
  .drag-handle {
    opacity: 0;
    background-color: transparent;
  }
  .layer-item:hover .drag-handle {
    opacity: 1;
    background-color: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
  }
}

.layer-item.selected .drag-handle {
  background-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.layer-context-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--color-text-primary) 25%, transparent);
  z-index: 12000;
}

.layer-context-menu {
  position: fixed;
  min-width: 170px;
  background: var(--color-bg-card);
  border-radius: 12px;
  box-shadow: 0 12px 36px color-mix(in srgb, var(--color-text-primary) 25%, transparent);
  overflow: hidden;
}

.layer-context-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.85rem;
  background: var(--color-primary);
  color: var(--color-bg-card);
}

.layer-context-title {
  font-size: 0.85rem;
  font-weight: 600;
  max-width: 150px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.layer-context-close {
  background: none;
  border: none;
  color: var(--color-bg-main);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.1rem 0.2rem;
}

.layer-context-content {
  display: flex;
  flex-direction: column;
  padding: 0.35rem;
  gap: 0.25rem;
}

.layer-context-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.layer-context-option:hover {
  background: color-mix(in srgb, var(--color-text-primary) 25%, transparent);
}

.layer-context-option .option-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.layer-context-option .option-icon :deep(svg) {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.layer-context-option.danger {
  color: var(--color-error);
}

.layer-context-option.danger:hover {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
}

@media (max-width: 767px) {
  .layer-context-menu {
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%);
    max-height: 80vh;
    max-height: 80dvh;
    max-width: calc(100vw - 32px);
    width: 240px;
    display: flex;
    flex-direction: column;
  }

  .layer-context-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

.layer-item.hidden {
  opacity: 0.55;
}

.layer-item.hidden .layer-thumbnail {
  filter: grayscale(0.4);
}

.layer-panel.mobile-collapsed {
  overflow: visible;
}

.layer-panel.mobile-collapsed .layer-list-container {
  display: none;
}

.layer-panel.mobile-collapsed .layer-actions {
  display: none;
}

.layer-panel.mobile-layout {
  display: flex;
  flex-direction: column;
  background: transparent;
  max-height: none;
  border-radius: 16px 16px var(--radius-lg) var(--radius-lg);
  overflow: hidden;
  width: 100%;
  transition: max-height 0.25s ease;
}

.layer-panel.mobile-layout.mobile-collapsed {
  max-height: 48px;
}

.mobile-layer-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem 0.4rem;
  background-color: var(--color-bg-panel);
  border-radius: 16px 16px 0 0;
  cursor: pointer;
  position: relative;
  gap: 0.2rem;
}

.mobile-drawer-handle {
  width: 36px;
  height: 4px;
  background: var(--color-border);
  border-radius: 999px;
}

.mobile-layer-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.mobile-layer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mobile-layer-actions .action-btn {
  padding: 0.15rem 0.35rem;
  font-size: 0.7rem;
}

.layer-panel.mobile-layout .layer-list-container {
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  flex: 1;
  min-height: 0;
  max-height: none;
  background-color: var(--color-bg-panel);
}

.layer-panel.mobile-layout .layer-list {
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  padding: 0.4rem 0.6rem;
  gap: 0.4rem;
  background-color: var(--color-bg-panel);
}

.layer-panel.mobile-layout .empty-state {
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  min-height: 40px;
  padding: 0.3rem 0.75rem;
  gap: 0.3rem;
  background-color: var(--color-bg-panel);
}

.layer-panel.mobile-layout .empty-state .empty-icon {
  display: none;
}

.layer-panel.mobile-layout .empty-state .empty-text {
  font-size: 0.7rem;
}

@media (max-width: 767px) {
  .panel-toggle-handle--bottom {
    display: flex;
    width: 46px;
    height: 18px;
    font-size: 0.95rem;
    top: -18px;
  }
  
  .panel-toggle-handle--bottom:hover {
    height: 24px;
  }
  
  .layer-panel-footer {
    padding: 0.35rem 0.75rem;
  }
  
  .collapse-btn {
    font-size: 0.85rem;
    gap: 0.35rem;
  }
  
  .layer-actions {
    gap: 0.5rem;
  }
  
  .action-btn {
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
  }
  
  .layer-count {
    font-size: 0.75rem;
  }
  
  .layer-list-container {
    min-height: clamp(70px, 12vh, 100px);
    max-height: clamp(70px, 12vh, 100px);
  }
  
  .layer-list {
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 12px 12px 0 0;
  }
  
  .layer-item {
    min-width: 60px;
    padding: 0.35rem;
    border-radius: 8px;
  }
  
  .layer-item.selected {
    padding: 0.35rem;
  }
  
  .layer-thumbnail {
    width: 36px;
    height: 36px;
    border-radius: 4px;
  }
  
  .layer-name {
    font-size: 0.7rem;
    max-width: 58px;
  }
  
  .layer-category {
    font-size: 0.6rem;
    max-width: 58px;
  }
  
  .layer-controls {
    opacity: 1;
  }
  
  .layer-btn {
    width: 18px;
    height: 18px;
    font-size: 0.65rem;
  }
  
  .drag-handle {
    opacity: 1;
    font-size: 1rem;
    width: 24px;
    height: 20px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .selected-indicator {
    width: 14px;
    height: 14px;
    font-size: 0.55rem;
    top: -2px;
    right: -2px;
  }
  
  .empty-state {
    font-size: 0.8rem;
    padding: 0.4rem 0.75rem;
    gap: 0.4rem;
  }
  
  .empty-icon {
    font-size: 1.5rem;
    margin-bottom: 0;
  }

  .empty-icon svg {
    width: 1.5rem;
    height: 1.5rem;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .layer-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .panel-toggle-handle--top {
    display: flex;
  }
  
  .layer-panel-footer {
    padding: 0.4rem 0.85rem;
    position: relative;
    display: flex !important;
    flex-shrink: 0;
    min-height: 36px;
  }
  
  .layer-panel-title {
    display: flex !important;
  }
  
  .layer-actions {
    display: flex !important;
  }
  
  .layer-list-container {
    min-height: clamp(110px, 18vh, 140px);
    max-height: clamp(120px, 20vh, 150px);
    flex: 0 0 auto;
    overflow: hidden;
    padding: 0.3rem;
  }
  
  .layer-list {
    gap: 0.6rem;
    padding: 0.8rem;
    border-radius: 12px 12px 0 0;
  }
  
  .layer-item {
    min-width: 70px;
    min-height: auto;
    padding: 0.4rem;
    border-width: 2px;
  }
  
  .layer-item.selected {
    padding: 0.4rem;
  }

  .drag-handle {
    opacity: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .layer-thumbnail {
    width: 36px;
    height: 36px;
  }
  
  .layer-name {
    font-size: 0.75rem;
    max-width: 60px;
  }
  
  .layer-category {
    font-size: 0.65rem;
    max-width: 60px;
  }
}
</style>

