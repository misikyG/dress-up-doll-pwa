<template>
  <!-- 主要容器 -->
  <div class="controls-container">
    <!-- 摺疊按鈕 -->
    <button @click="gameStore.toggleControls()" class="collapse-handle"
      :title="gameStore.ui.controlsCollapsed ? '展開控制台' : '收合控制台'">
      <span class="icon">{{ gameStore.ui.controlsCollapsed ? '◀' : '▶' }}</span>
    </button>

    <!-- 控制台內容 -->
    <div v-if="!gameStore.ui.controlsCollapsed" class="controls-content">
      <div class="controls-header">
        <h2>⚙️ 控制台</h2>
      </div>

      <!-- **新增一個滾動容器** -->
      <div class="scrollable-area">
        <!-- 基礎操作 -->
        <div class="control-section">
          <h4>基礎操作</h4>
          <div class="button-grid">
            <button @click="gameStore.clearCurrentOutfit()">🗑️ 清空畫布</button>
            <button @click="resetPositions">📍 重設位置</button>
          </div>
        </div>

        <!-- 歷史紀錄 -->
        <div class="control-section">
          <h4>歷史紀錄</h4>
          <div class="button-grid">
            <button @click="gameStore.undo()" :disabled="!gameStore.canUndo">↩︎ 上一步</button>
            <button @click="gameStore.redo()" :disabled="!gameStore.canRedo">↪︎ 下一步</button>
          </div>
        </div>

        <!-- 模式切換 -->
        <div class="control-section">
          <h4>畫布模式</h4>
          <div class="mode-toggle">
            <button :class="{ active: gameStore.canvasMode === 'fixed' }"
              @click="gameStore.setCanvasMode('fixed')">固定</button>
            <button :class="{ active: gameStore.canvasMode === 'free' }"
              @click="gameStore.setCanvasMode('free')">自由</button>
          </div>
        </div>

        <!-- 儲存 -->
        <div class="control-section">
          <h4>儲存</h4>
          <button class="save-button" @click="saveOutfit">⭐ 儲存當前搭配</button>
          <button class="room-button" @click="saveToRoom">🏠 存至小房間</button>
        </div>
        
        <!-- 管理 -->
        <div class="control-section">
          <h4>管理</h4>
          <button @click="showImporter = true">📥 匯入圖包</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Teleport 保持不變，位置是正確的 -->
  <teleport to="body">
    <div v-if="showImporter" class="modal-overlay" @click="showImporter = false">
      <Importer @close="showImporter = false" />
    </div>
  </teleport>
</template>

<script setup>
// script 內容保持不變
import { ref } from 'vue';
import { useGameStore } from '../store/index.js';
import Importer from './Importer.vue';

const gameStore = useGameStore();
const showImporter = ref(false);

const resetPositions = () => {
  alert('功能待實現');
}

const saveOutfit = () => {
  const name = prompt('請為您的搭配取個名字：', `我的搭配 ${gameStore.savedOutfits.length + 1}`);
  if (name) {
    gameStore.saveCurrentOutfit(name);
  }
}

const saveToRoom = () => {
  saveOutfit();
}
</script>

<style scoped>
/* 樣式有重要修改 */
.controls-container {
  position: relative;
  height: 100%;
  display: flex;
}
.collapse-handle {
  position: absolute; top: 50%; left: -15px; transform: translateY(-50%);
  width: 30px; height: 60px; background-color: var(--panel-bg);
  border: 1px solid var(--border-color); border-right: none;
  border-radius: 8px 0 0 8px; cursor: pointer; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; color: var(--primary-color);
}
.controls-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  /* 移除 overflow: hidden */
}
.controls-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  /* 確保 header 不會被滾動 */
  flex-shrink: 0; 
}
.controls-header h2 { margin: 0; font-size: 1.2rem; }

/* **新增的滾動區域樣式** */
.scrollable-area {
  flex: 1; /* 佔滿剩餘空間 */
  overflow-y: auto; /* 內容超出時顯示垂直滾動條 */
  padding-bottom: 1rem; /* 給底部一點空間 */
}

/* 確保 control-section 有正確的 padding */
.control-section {
  padding: 1rem 1.5rem 0 1.5rem; /* 調整 padding */
}
.control-section:first-child {
  padding-top: 1.5rem;
}
.control-section h4 {
  margin-top: 0; margin-bottom: 0.75rem; font-size: 1rem; color: #555;
}
.button-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;
}
.button-grid button, .control-section > button {
  width: 100%; padding: 0.75rem; border: 1px solid var(--border-color);
  background-color: #fff; border-radius: 6px; cursor: pointer;
  transition: all 0.2s ease;
}
.button-grid button:hover, .control-section > button:hover { background-color: #f0f2f5; }
.button-grid button:disabled { opacity: 0.5; cursor: not-allowed; }
.mode-toggle {
  display: flex; border: 1px solid var(--border-color); border-radius: 6px;
}
.mode-toggle button {
  width: 50%; padding: 0.75rem; border: none; background: none; cursor: pointer;
}
.mode-toggle button.active { background-color: var(--primary-color); color: white; }
.save-button {
  background-color: #ffc107; color: black; border: none; margin-bottom: 0.5rem;
}
.room-button { background-color: #8bc34a; color: white; border: none; }
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.5); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}
</style>