<template>
  <div class="settings-modal" @click.stop>
    <div class="settings-header">
      <h3>⚙️ 設定</h3>
      <button @click="$emit('close')" class="close-btn" title="關閉">×</button>
    </div>
    
    <div class="settings-content">
      <div class="settings-section">
        <h4>📦 圖包管理</h4>
        <div class="pack-list">
          <div v-if="gameStore.availablePacks.length === 0" class="empty-list">
            尚未匯入任何圖包
          </div>
          <div v-for="pack in gameStore.availablePacks" :key="pack.name" class="pack-item">
            <span>{{ pack.displayName || pack.name }}</span>
            <button @click="deletePack(pack.name)" class="delete-btn">刪除</button>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h4>⚠️ 危險區域</h4>
        <button @click="clearAllData" class="danger-btn">清空所有本地數據</button>
        <p class="hint">此操作會刪除所有匯入的物件和儲存的搭配，且無法復原！</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../store/index.js';

defineEmits(['close']);
const gameStore = useGameStore();

const deletePack = async (packName) => {
  const pack = gameStore.availablePacks.find(p => p.name === packName);
  if (confirm(`確定要刪除圖包「${pack.displayName || pack.name}」及其所有物件嗎？`)) {
    await gameStore.deletePack(packName);
  }
};

const clearAllData = () => {
  if (confirm('再次確認：真的要刪除所有數據嗎？')) {
    gameStore.clearAllData();
  }
};
</script>

<style scoped>
/* 樣式與 Search.vue 類似 */
.settings-modal { width: 500px; max-width: 90vw; background: white; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; }
.settings-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid #e0e0e0; }
.close-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #888; }
.settings-content { padding: 1.5rem; }
.settings-section { margin-bottom: 2rem; }
.settings-section h4 { margin-top: 0; margin-bottom: 1rem; }
.pack-list { display: flex; flex-direction: column; gap: 0.5rem; }
.pack-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background-color: #f7f7f7; border-radius: 6px; }
.delete-btn { background-color: #F44336; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; }
.danger-btn { width: 100%; padding: 0.75rem; background-color: #c0392b; color: white; border: none; border-radius: 6px; cursor: pointer; }
.hint { font-size: 0.8rem; color: #666; margin-top: 0.5rem; }
.empty-list { color: #888; text-align: center; padding: 1rem; }
</style>