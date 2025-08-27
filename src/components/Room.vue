<template>
  <div class="room-container">
    <div class="room-header">
      <h2>🏠 我的小房間</h2>
      <span>共 {{ gameStore.savedOutfits.length }} 個儲存的搭配</span>
    </div>
    <div class="room-content">
      <div v-if="gameStore.savedOutfits.length === 0" class="empty-state">
        <p>房間還是空的...</p>
        <p>在換裝頁儲存您喜歡的搭配吧！</p>
      </div>
      <div v-else class="room-grid">
        <div v-for="outfit in gameStore.savedOutfits" :key="outfit.id" class="outfit-card">
          <div class="outfit-preview" @click="loadAndGo(outfit)">
            <!-- 簡易預覽圖層 -->
            <img v-if="outfit.outfit.background" :src="outfit.outfit.background.imageData" class="preview-layer" style="z-index: 1; object-fit: cover;"/>
            <img v-if="outfit.outfit.character" :src="outfit.outfit.character.imageData" class="preview-layer" style="z-index: 2;"/>
            <img v-if="outfit.outfit.dress" :src="outfit.outfit.dress.imageData" class="preview-layer" style="z-index: 3;"/>
            <img v-if="outfit.outfit.top" :src="outfit.outfit.top.imageData" class="preview-layer" style="z-index: 3;"/>
            <img v-if="outfit.outfit.hair" :src="outfit.outfit.hair.imageData" class="preview-layer" style="z-index: 4;"/>
          </div>
          <div class="outfit-info">
            <span>{{ outfit.name }}</span>
            <button @click="deleteOutfit(outfit.id)" class="delete-btn">🗑️</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../store/index.js';
const gameStore = useGameStore();

const loadAndGo = (outfit) => {
  gameStore.loadOutfit(outfit);
  gameStore.setCurrentPage('dressing');
};

const deleteOutfit = (outfitId) => {
  if (confirm('確定要刪除這個搭配嗎？')) {
    gameStore.deleteOutfit(outfitId);
  }
};
</script>

<style scoped>
.room-container { height: 100%; display: flex; flex-direction: column; }
.room-header { padding: 1rem 1.5rem; border-bottom: 1px solid #e0e0e0; flex-shrink: 0; }
.room-header h2 { margin: 0; }
.room-content { flex: 1; overflow-y: auto; padding: 1.5rem; }
.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; }
.outfit-card { border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.outfit-preview { position: relative; width: 100%; aspect-ratio: 3/4; background-color: #f0f2f5; cursor: pointer; }
.preview-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }
.outfit-info { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; }
.delete-btn { background: none; border: none; cursor: pointer; font-size: 1rem; }
.empty-state { text-align: center; color: #888; padding-top: 4rem; }
</style>