<template>
  <div id="app-container" :class="{ 'mobile-view': gameStore.ui.isMobile }">
    <!-- 全局載入遮罩 -->
    <div v-if="gameStore.ui.loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">系統載入中...</p>
    </div>

    <!-- 主應用界面 -->
    <main v-else class="main-app">
      <!-- 頂部導航欄 -->
      <header class="app-header">
        <div class="logo">
          <h1>🎨 紙娃娃換裝</h1>
        </div>
        <nav class="main-nav">
          <button :class="{ active: gameStore.ui.currentPage === 'dressing' }"
            @click="gameStore.setCurrentPage('dressing')">
            換裝
          </button>
          <button :class="{ active: gameStore.ui.currentPage === 'room' }" @click="gameStore.setCurrentPage('room')">
            房間
          </button>
        </nav>
        <div class="header-actions">
          <button @click="gameStore.toggleSearch()" title="搜尋">🔍</button>
          <button @click="gameStore.toggleSettings()" title="設定">⚙️</button>
        </div>
      </header>

      <!-- 主要內容區域 (桌面端三欄式 / 手機端單欄) -->
      <div class="content-wrapper">
        <!-- 左側面板：衣櫃 -->
        <aside class="panel left-panel" :class="{ collapsed: gameStore.ui.wardrobeCollapsed }">
          <Wardrobe />
        </aside>

        <!-- 中央面板：主要顯示區域 (換裝或房間) -->
        <div class="panel center-panel">
          <keep-alive>
            <component :is="activePageComponent" />
          </keep-alive>
        </div>

        <!-- 右側面板：控制台 (可在 dressing 頁顯示) -->
        <aside class="panel right-panel" v-if="gameStore.ui.currentPage === 'dressing'"
          :class="{ collapsed: gameStore.ui.controlsCollapsed }">
          <Controls />
        </aside>
      </div>
    </main>

    <!-- 全局彈出視窗 -->
    <transition name="fade">
      <div v-if="gameStore.ui.showSearch || gameStore.ui.showSettings" class="modal-overlay" @click="closeModals">
        <Search v-if="gameStore.ui.showSearch" @close="gameStore.toggleSearch" @click.stop />
        <Settings v-if="gameStore.ui.showSettings" @close="gameStore.toggleSettings" @click.stop />
      </div>
    </transition>

    <!-- 通知系統 -->
    <transition name="slide-fade">
      <div v-if="gameStore.ui.notification" :class="['notification', gameStore.ui.notification.type]">
        {{ gameStore.ui.notification.message }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../store/index.js'

// 引入子組件
import Wardrobe from './Wardrobe.vue'
import Dressing from './Dressing.vue'
import Room from './Room.vue'
import Search from './Search.vue'
import Settings from './Settings.vue'
import Controls from './Controls.vue'

// 狀態管理
const gameStore = useGameStore()

// 動態組件，根據當前頁面顯示不同內容
const pageComponents = {
  dressing: Dressing,
  room: Room,
}
const activePageComponent = computed(() => pageComponents[gameStore.ui.currentPage])

// 響應式設計處理
const checkMobile = () => {
  gameStore.setMobileMode(window.innerWidth <= 768)
}

const closeModals = () => {
  if (gameStore.ui.showSearch) gameStore.toggleSearch();
  if (gameStore.ui.showSettings) gameStore.toggleSettings();
}

// 生命週期鉤子
onMounted(async () => {
  await gameStore.initializeApp()
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style>
/* 全局樣式與 CSS 變數 */
:root {
  --bg-color: #f0f2f5;
  --panel-bg: #ffffff;
  --primary-color: #6a6cff;
  --text-color: #333;
  --border-color: #e0e0e0;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
}

#app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* 載入動畫 */
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: var(--primary-color);
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 主應用佈局 */
.main-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  height: 60px;
  background-color: var(--panel-bg);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow);
  z-index: 100;
}

.logo h1 {
  font-size: 1.25rem;
  margin: 0;
  color: var(--primary-color);
}

.main-nav {
  margin: 0 auto;
  display: flex;
  gap: 1rem;
}

.main-nav button {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.main-nav button.active {
  background-color: var(--primary-color);
  color: white;
}

.main-nav button:not(.active):hover {
  background-color: #f0f0f0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.header-actions button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-actions button:hover {
  background-color: #f0f0f0;
}

.content-wrapper {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr 320px;
  gap: 1rem;
  padding: 1rem;
  overflow: hidden;
}

/* 面板通用樣式 */
.panel {
  background-color: var(--panel-bg);
  border-radius: 12px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;
}

.left-panel.collapsed {
  width: 60px;
  min-width: 60px;
}

.right-panel.collapsed {
  width: 60px;
  min-width: 60px;
}


/* 彈出視窗 (Modal) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 通知系統 */
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.notification.success {
  background-color: #4CAF50;
}

.notification.error {
  background-color: #F44336;
}

.notification.warning {
  background-color: #FF9800;
}

.notification.info {
  background-color: #2196F3;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.4s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}


/* 響應式設計 */
@media (max-width: 1024px) {
  .content-wrapper {
    grid-template-columns: 280px 1fr;
  }

  .right-panel {
    display: none;
    /* 在平板上先隱藏右側控制台，簡化佈局 */
  }
}

@media (max-width: 768px) {
  .main-app {
    height: 100%;
  }

  .content-wrapper {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    /* 上方遊戲區，下方衣櫃 */
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .center-panel {
    grid-row: 1;
    /* 畫布在上方 */
  }

  .left-panel {
    grid-row: 2;
    /* 衣櫃在下方 */
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 300px;
    border-radius: 12px 12px 0 0;
    z-index: 50;
    /* 這裡未來會加入可上下拖動的邏輯 */
  }

  .left-panel.collapsed {
    height: 60px;
  }
}
</style>