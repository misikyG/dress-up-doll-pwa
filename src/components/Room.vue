<template>
  <div class="room-container">
    <div class="room-header">
      <h2><span class="title-icon" v-html="icons.background"></span> 我的小房間</h2>
      <span>共 {{ gameStore.savedOutfits.length }} 個儲存的搭配</span>
    </div>
    <div class="room-content">
      <div v-if="gameStore.savedOutfits.length === 0" class="empty-state">
        <div class="empty-icon" v-html="icons.dress"></div>
        <p>房間還是空的...</p>
        <p>在換裝頁儲存您喜歡的搭配吧！</p>
        <button @click="goToDressing" class="go-dressing-btn">開始換裝 →</button>
      </div>
      <div v-else class="room-grid">
        <div v-for="outfit in gameStore.savedOutfits" :key="outfit.id" class="outfit-card">
          <div class="outfit-preview" @click="loadAndGo(outfit)">
            <img v-if="outfit.previewImage" :src="outfit.previewImage" class="preview-layer" style="z-index: 1" />
            <span v-else class="outfit-fallback-icon" v-html="icons.dress"></span>
                 
            <!-- 載入提示 -->
            <div class="preview-overlay">
              <span class="load-hint">點擊載入</span>
            </div>
          </div>
          <div class="outfit-info">
            <div class="outfit-details">
              <span class="outfit-name">{{ outfit.name }}</span>
              <span class="outfit-date">{{ formatDate(outfit.createdAt) }}</span>
            </div>
            <div class="outfit-actions">
              <button @click.stop="duplicateOutfit(outfit)" class="duplicate-btn" title="複製搭配">📋</button>
              <button @click.stop="deleteOutfit(outfit.id)" class="delete-btn" title="刪除搭配">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';
const gameStore = useGameStore();

const loadAndGo = async (outfit) => {
  await gameStore.loadOutfit(outfit);
  gameStore.setCurrentPage('dressing');
};

const deleteOutfit = (outfitId) => {
  if (confirm('確定要刪除這個搭配嗎？')) {
    gameStore.deleteOutfit(outfitId);
  }
};

const duplicateOutfit = async (outfit) => {
  const newName = prompt('請為複製的搭配取個名字：', `${outfit.name} - 副本`);
  if (newName) {
    const currentOutfit = { ...gameStore.currentOutfit };
    const currentFreeMode = { ...gameStore.freeMode };
    const currentZoom = gameStore.canvasZoom;
    const currentPan = { ...gameStore.canvasPan };
    
    await gameStore.loadOutfit(outfit);
    await gameStore.saveCurrentOutfit(newName);
    
    gameStore.currentOutfit = currentOutfit;
    gameStore.freeMode = currentFreeMode;
    gameStore.canvasZoom = currentZoom;
    gameStore.canvasPan = currentPan;
  }
};

const goToDressing = () => {
  gameStore.setCurrentPage('dressing');
};

const formatDate = (dateString) => {
  return gameStore.formatDate(dateString, { year: 'numeric' });
};
</script>

<style scoped>
/* ========================================
   Room.vue 樣式
   ----------------------------------------
   目錄：
   1. 容器結構
   2. 標頭區域
   3. 搭配卡片
   4. 預覽區域
   5. 搭配資訊
   6. 空狀態
   7. 響應式設計
   ======================================== */

/* ========================================
   1. 容器結構
   ======================================== */

.room-container { 
  height: 100%; 
  display: flex; 
  flex-direction: column; 
  background-color: var(--color-bg-panel);
}

/* ========================================
   2. 標頭區域
   ======================================== */

.room-header { 
  padding: 1rem 1.5rem; 
  border-bottom: 1px solid var(--color-border); 
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-bg-panel);
}

.room-header h2 { 
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.room-header span {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}

.room-content { 
  flex: 1; 
  overflow-y: auto; 
  padding: 1.25rem; 
}

.room-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
  gap: 1.25rem; 
}

/* ========================================
   3. 搭配卡片
   ======================================== */

.outfit-card { 
  border-radius: var(--radius-lg); 
  overflow: hidden; 
  box-shadow: var(--shadow-md);
  transition: var(--transition-fast);
  background-color: var(--color-bg-card);
}

@media (hover: hover) {
  .outfit-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
}

/* ========================================
   4. 預覽區域
   ======================================== */

.outfit-preview { 
  position: relative; 
  width: 100%; 
  aspect-ratio: 3/4; 
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent); 
  cursor: pointer;
  overflow: hidden;
}

.preview-layer { 
  position: absolute; 
  top: 0; left: 0; 
  width: 100%; height: 100%; 
  object-fit: contain; 
}

.outfit-fallback-icon {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.3;
  font-size: 3rem;
}

.preview-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* 僅在有 hover 能力的裝置（滑鼠）上使用 hover 顯示 */
@media (hover: hover) {
  .outfit-preview:hover .preview-overlay {
    opacity: 1;
  }
}

/* 觸控裝置使用 :active 替代 :hover */
@media (hover: none) {
  .outfit-preview:active .preview-overlay {
    opacity: 1;
  }
}

.load-hint {
  color: var(--color-bg-main);
  font-weight: 500;
  background: color-mix(in srgb, var(--color-text-primary) 60%, transparent);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
}

/* ========================================
   5. 搭配資訊
   ======================================== */

.outfit-info { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 0.75rem 1rem; 
  background: var(--color-bg-card); 
  gap: 0.5rem;
}

.outfit-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.outfit-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.outfit-date {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.outfit-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.duplicate-btn, .delete-btn { 
  background: none; 
  border: none; 
  cursor: pointer; 
  font-size: 0.9rem;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}

.duplicate-btn:hover {
  background-color: color-mix(in srgb, var(--color-info) 15%, transparent);
}

.delete-btn:hover {
  background-color: color-mix(in srgb, var(--color-error) 15%, transparent);
}

/* ========================================
   6. 空狀態
   ======================================== */

.empty-state { 
  text-align: center; 
  color: var(--color-text-secondary); 
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-icon { 
  font-size: 3rem;
  opacity: 0.5;
}

.go-dressing-btn {
  padding: 0.6rem 1.25rem;
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.9rem;
  transition: var(--transition-fast);
  margin-top: 0.5rem;
}

.go-dressing-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 85%, transparent);
}

/* ========================================
   7. 響應式設計
   ======================================== */

@media (min-width: 768px) and (max-width: 1024px) {
  .room-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }
  
  .room-content {
    padding: 1rem;
  }
}

@media (max-width: 767px) {
  .room-header {
    padding: 0.75rem 1rem;
  }
  
  .room-header h2 {
    font-size: 1rem;
  }
  
  .room-content {
    padding: 0.75rem;
  }
  
  .room-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  
  .outfit-info {
    padding: 0.6rem 0.75rem;
    flex-direction: column;
    align-items: flex-start;
  }
  
  .outfit-actions {
    width: 100%;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }
  
  .outfit-name {
    font-size: 0.85rem;
  }
}
</style>

