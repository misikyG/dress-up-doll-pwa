<template>
  <div class="room-container">
    <div class="room-header">
      <h2><span class="title-icon" v-html="icons.background"></span> 我的小房間</h2>
    </div>
    <div class="room-content">
      <div class="not-implemented-state">
        <div class="not-implemented-icon">🚧</div>
        <h3>此功能尚未實裝</h3>
        <p>房間功能正在開發中，敬請期待！</p>
        <p class="not-implemented-hint">您可以在「換裝」頁面的已儲存搭配分類中管理搭配。</p>
        <button @click="goToDressing" class="go-dressing-btn">前往換裝 →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';
const gameStore = useGameStore();

const goToDressing = () => {
  gameStore.setCurrentPage('dressing');
};
</script>

<style scoped>

.room-container { 
  height: 100%; 
  display: flex; 
  flex-direction: column; 
  background-color: var(--color-bg-panel);
}

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

.room-content { 
  flex: 1; 
  overflow-y: auto; 
  padding: 1.25rem; 
  display: flex;
  align-items: center;
  justify-content: center;
}

.not-implemented-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.not-implemented-icon {
  font-size: 4rem;
  opacity: 0.7;
}

.not-implemented-state h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-text-primary);
}

.not-implemented-state p {
  margin: 0;
  font-size: 0.95rem;
}

.not-implemented-hint {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  opacity: 0.8;
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
</style>

