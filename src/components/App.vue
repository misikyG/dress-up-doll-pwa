<template>
  <div id="app-container" :class="{ 'mobile-view': gameStore.ui.isMobile, 'tablet-view': gameStore.ui.isTablet }">
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
          <h1><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-needle-thread" width="32" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M3 21c-.667 -.667 3.262 -6.236 11.785 -16.709a3.5 3.5 0 1 1 5.078 4.791c-10.575 8.612 -16.196 12.585 -16.863 11.918z" />
  <path d="M17.5 6.5l-1 1" />
  <path d="M17 7c-2.333 -2.667 -3.5 -4 -5 -4s-2 1 -2 2c0 4 8.161 8.406 6 11c-1.056 1.268 -3.363 1.285 -5.75 .808" />
  <path d="M5.739 15.425c-1.393 -.565 -3.739 -1.925 -3.739 -3.425" />
  <path d="M19.5 9.5l1.5 1.5" />
</svg></h1>
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
          <button @click="gameStore.toggleSearch()" title="搜尋" class="icon-btn" v-html="icons.search"></button>
          <button @click="showHelp = !showHelp" title="使用說明" class="icon-btn" v-html="icons.help"></button>
          <button @click="showContact = !showContact" title="聯繫作者" class="icon-btn" v-html="icons.contact"></button>
          <button @click="gameStore.toggleSettings()" title="設定" class="icon-btn" v-html="icons.settings"></button>
        </div>
      </header>

      <!-- 主要內容區域 -->
      <div class="content-wrapper" :class="layoutClass">
        <!-- 左側面板：衣櫃 -->
        <aside class="panel left-panel" :class="{ collapsed: gameStore.ui.wardrobeCollapsed }">
          <Wardrobe />
        </aside>

        <!-- 中央面板：主要顯示區域 (換裝或房間) -->
        <div class="panel center-panel">
          <!-- 主要畫布區域 -->
          <div class="main-content">
            <keep-alive>
              <component :is="activePageComponent" />
            </keep-alive>
          </div>
          
          <!-- 物件選單 -->
          <div v-if="gameStore.ui.currentPage === 'dressing' && !gameStore.ui.isMobile && !gameStore.ui.isTablet" 
               class="layer-panel-container desktop">
            <LayerPanel />
          </div>
        </div>

      </div>
    </main>

    <!-- 全局彈出視窗 -->
    <transition name="fade">
      <div v-if="gameStore.ui.showSearch || gameStore.ui.showSettings || showHelp || showContact" class="modal-overlay" @click="closeModals">
        <Search v-if="gameStore.ui.showSearch" @close="gameStore.toggleSearch" @click.stop />
        <Settings v-if="gameStore.ui.showSettings" @close="gameStore.toggleSettings" @click.stop />
        <Help v-if="showHelp" @close="showHelp = false" @click.stop />
        <Contact v-if="showContact" @close="showContact = false" @click.stop />
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
import { icons } from '../icons.js'

import Wardrobe from './Wardrobe.vue'
import Dressing from './Dressing.vue'
import Room from './Room.vue'
import Search from './Search.vue'
import Settings from './Settings.vue'
import LayerPanel from './LayerPanel.vue'
import Help from './Help.vue'
import Contact from './Contact.vue'

const gameStore = useGameStore()
const showHelp = ref(false)
const showContact = ref(false)

const pageComponents = {
  dressing: Dressing,
  room: Room,
}
const activePageComponent = computed(() => pageComponents[gameStore.ui.currentPage])

const layoutClass = computed(() => {
  const isLeftCollapsed = gameStore.ui.wardrobeCollapsed;
  const isDressingPage = gameStore.ui.currentPage === 'dressing';
  
  if (gameStore.ui.isMobile) return 'layout-mobile';
  if (gameStore.ui.isTablet) return 'layout-tablet';
  
  if (isDressingPage) {
    return isLeftCollapsed ? 'layout-center-only' : 'layout-left-center';
  } else {
    return isLeftCollapsed ? 'layout-center-only' : 'layout-left-center';
  }
});

// 響應式設計處理
const checkResponsive = () => {
  const width = window.innerWidth;
  if (width <= 768) {
    gameStore.setMobileMode(true);
    gameStore.setTabletMode(false);
    gameStore.ui.layerPanelCollapsed = true;
  } else if (width <= 1024) {
    gameStore.setMobileMode(false);
    gameStore.setTabletMode(true);
  } else {
    gameStore.setMobileMode(false);
    gameStore.setTabletMode(false);
  }
}

const closeModals = () => {
  if (gameStore.ui.showSearch) gameStore.toggleSearch();
  if (gameStore.ui.showSettings) gameStore.toggleSettings();
  if (showHelp.value) showHelp.value = false;
  if (showContact.value) showContact.value = false;
}

// 禁用全局右鍵選單
const preventContextMenu = (e) => {
  // 只在非輸入框元素上禁用
  if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
  }
}

// 生命週期鉤子
onMounted(async () => {
  await gameStore.initializeApp()
  checkResponsive()
  window.addEventListener('resize', checkResponsive)
  // 禁用全局右鍵選單
  document.addEventListener('contextmenu', preventContextMenu)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkResponsive)
  document.removeEventListener('contextmenu', preventContextMenu)
})
</script>

<style>
/* ========================================
   App.vue 全局樣式
   ----------------------------------------
   目錄：
   1. 全局動畫與基礎
   2. 全局共用元件
   3. 載入畫面
   4. 主應用佈局
   5. 內容區域佈局
   6. 彈出視窗
   7. 通知系統
   8. 過渡動畫
   9. 響應式設計 - 平板版
   10. 響應式設計 - 手機版
   ======================================== */

/* ========================================
   1. 全局動畫與基礎
   ======================================== */

/* 動畫定義 */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* SVG 圖標通用樣式 */
.icon-btn svg,
.title-icon svg,
.panel-icon svg,
.section-icon svg,
.empty-icon svg,
button svg {
  width: 1em;
  height: 1em;
  display: inline-block;
  vertical-align: middle;
}

/* 禁止文字反白選取 */
*,
*::before,
*::after {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* 允許輸入框選取文字 */
input,
textarea,
[contenteditable="true"] {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

/* 基礎佈局 */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--color-bg-main);
  color: var(--color-text-primary);
}

#app-container {
  width: 100vw;
  /* iOS Safari 100vh 修復 - 使用多重回退 */
  height: 100vh;
  height: 100dvh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
}

/* ========================================
   2. 全局共用元件
   ======================================== */

/* Modal 基礎樣式 */
.modal-base {
  max-width: 90vw;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
}

.modal-sm { width: 400px; }
.modal-md { width: 500px; }
.modal-lg { width: 600px; }

/* Modal 頭部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--color-bg-panel);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.15rem;
  font-weight: 600;
}

/* Modal 內容區 */
.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

/* 關閉按鈕 */
.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-border);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
  line-height: 1;
}

.btn-close:hover {
  background-color: rgba(192, 183, 163, 0.2);
  color: var(--color-text-primary);
}

/* 空狀態樣式 */
.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-icon {
  font-size: 4rem;
  opacity: 0.3;
  margin-bottom: 1rem;
}

.empty-icon svg {
  width: 4rem;
  height: 4rem;
}

.empty-text {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

/* 載入動畫 */
.spinner {
  border: 3px solid rgba(192, 183, 163, 0.3);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

.spinner-sm { width: 20px; height: 20px; }
.spinner-md { width: 32px; height: 32px; }
.spinner-lg { width: 48px; height: 48px; }

/* 按鈕通用樣式 */
.btn {
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-bg-main);
  padding: 0.6rem 1.2rem;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-secondary {
  background-color: rgba(232, 232, 232, 0.5);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  padding: 0.6rem 1.2rem;
}

.btn-secondary:hover {
  background-color: var(--color-border-light);
}

.btn-danger {
  background-color: var(--color-error);
  color: var(--color-bg-main);
  padding: 0.6rem 1.2rem;
}

.btn-danger:hover {
  opacity: 0.85;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ========================================
   全局勾選樣式（統一管理）
   ======================================== */

/* 隱藏原生 checkbox */
.checkbox-custom-container input[type="checkbox"],
.filter-checkbox-item input[type="checkbox"],
.check-badge input[type="checkbox"],
.watermark-option input[type="checkbox"] {
  display: none;
}

/* 自訂勾選框基礎樣式 - 圓形主題色 */
.checkbox-custom,
.equipped-badge,
.selected-indicator {
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  flex-shrink: 0;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 篩選器用較小的勾選框 */
.filter-checkbox-item .checkbox-custom {
  width: 14px;
  height: 14px;
  min-width: 14px;
  min-height: 14px;
  border-width: 1.5px;
}

/* Controls check-badge 的勾選指示器 */
.check-badge .checkbox-indicator {
  width: 16px;
  height: 16px;
  min-width: 16px;
  min-height: 16px;
  flex-shrink: 0;
  border: 2px solid var(--color-bg-main);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 勾選狀態 - 圓形主題色底 */
input[type="checkbox"]:checked + .checkbox-custom,
.equipped-badge,
.selected-indicator {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.check-badge input[type="checkbox"]:checked + .checkbox-indicator {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

/* 勾勾符號 - 主背景色 */
input[type="checkbox"]:checked + .checkbox-custom::after,
.equipped-badge::after,
.selected-indicator::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid var(--color-bg-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* 篩選器較小勾勾 */
.filter-checkbox-item input[type="checkbox"]:checked + .checkbox-custom::after {
  left: 3.5px;
  top: 1px;
  width: 3px;
  height: 6px;
  border-width: 0 1.5px 1.5px 0;
}

/* check-badge 勾勾 */
.check-badge input[type="checkbox"]:checked + .checkbox-indicator::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 7px;
  border: solid var(--color-bg-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* equipped-badge 和 selected-indicator 的內容覆蓋 */
.equipped-badge,
.selected-indicator {
  font-size: 0;
  color: transparent;
}

/* 縮圖通用樣式 */
.thumbnail {
  background-color: var(--color-bg-canvas);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumbnail-sm { width: 40px; height: 40px; }
.thumbnail-md { width: 50px; height: 50px; }
.thumbnail-lg { width: 70px; height: 70px; }

/* ========================================
   3. 載入畫面
   ======================================== */
.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  height: 100dvh;
  height: calc(var(--vh, 1vh) * 100);
  background-color: var(--color-primary);
  color: var(--color-bg-main);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(248, 245, 234, 0.3);
  border-top-color: var(--color-bg-main);
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

/* ========================================
   4. 主應用佈局
   ======================================== */
.main-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  height: calc(var(--vh, 1vh) * 100);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 56px;
  background-color: var(--color-bg-panel);
  box-shadow: var(--shadow-sm);
  z-index: 100;
  position: relative;
}

.logo h1 {
  font-size: 1.25rem;
  margin: 0;
  color: var(--color-primary);
}

.main-nav {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
}

.main-nav button {
  padding: 0.5rem 1.25rem;
  border: none;
  background: none;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: var(--transition-fast);
  color: var(--color-text-secondary);
}

.main-nav button.active {
  background-color: var(--color-primary);
  color: var(--color-bg-main);
}

.main-nav button:not(.active):hover {
  background-color: rgba(192, 183, 163, 0.2);
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.header-actions button {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-full);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
  color: var(--color-text-secondary);
}

.header-actions button:hover {
  background-color: rgba(192, 183, 163, 0.2);
  color: var(--color-text-primary);
}

/* ========================================
   5. 內容區域佈局
   ======================================== */
.content-wrapper {
  flex: 1;
  display: grid;
  gap: 1rem;
  padding: 1rem;
  overflow: hidden;
  transition: var(--transition-normal);
  position: relative;
}

/* 桌面版布局 */
.layout-left-center {
  grid-template-columns: var(--wardrobe-width) 1fr;
}

.layout-center-only {
  grid-template-columns: 68px 1fr;
}

/* 平板布局 */
.layout-tablet {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  padding: 0.75rem;
}

.layout-tablet .left-panel {
  width: clamp(220px, 26vw, 280px);
  min-width: 200px;
  flex-shrink: 0;
  transition: width 0.3s ease, min-width 0.3s ease;
}

/* 平板版衣櫃收起時 - 畫布彈性變化 */
.layout-tablet .left-panel.collapsed {
  width: 68px;
  min-width: 68px;
  max-width: 68px;
}

.layout-tablet .center-panel {
  flex: 1;
  min-width: 0;
  transition: flex 0.3s ease;
}

/* 手機布局 */
.layout-mobile {
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr;
  padding: 0.5rem;
  gap: 0.5rem;
}

/* 面板通用樣式 */
.panel {
  background-color: var(--color-bg-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: var(--transition-normal);
  position: relative;
}

.center-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.layer-panel-container.desktop {
  flex-shrink: 0;
  background-color: var(--color-bg-panel);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  overflow: hidden;
}

.main-content {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

/* ========================================
   6. 彈出視窗 (Modal)
   ======================================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(119, 98, 88, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* ========================================
   7. 通知系統
   ======================================== */
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  color: var(--color-bg-main);
  font-weight: 500;
  font-size: 0.9rem;
  z-index: 1001;
  box-shadow: var(--shadow-lg);
}

.notification.success { background-color: var(--color-success); }
.notification.error { background-color: var(--color-error); }
.notification.warning { background-color: var(--color-warning); }
.notification.info { background-color: var(--color-info); }

/* ========================================
   8. 過渡動畫
   ======================================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* ========================================
   9. 響應式設計 - 平板版 (768px - 1024px)
   ======================================== */
@media (min-width: 768px) and (max-width: 1024px) {
  .app-header {
    padding: 0 1rem;
    height: 52px;
  }
  
  .main-nav button {
    padding: 0.4rem 1rem;
    font-size: 0.9rem;
  }
  
  .header-actions button {
    width: 36px;
    height: 36px;
  }
  
  .notification {
    bottom: 15px;
    right: 15px;
  }
}

/* ========================================
   10. 響應式設計 - 手機版 (< 768px)
   ======================================== */
@media (max-width: 767px) {
  .app-header {
    padding: 0 0.5rem;
    height: 48px;
  }
  
  .logo h1 {
    font-size: 1.1rem;
  }
  
  .logo h1 svg {
    width: 24px;
    height: 18px;
  }
  
  .main-nav {
    gap: 0.15rem;
  }
  
  .main-nav button {
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
  }
  
  .header-actions {
    gap: 0.15rem;
  }
  
  .header-actions button {
    width: 32px;
    height: 32px;
    font-size: 1rem;
    padding: 0.3rem;
  }
  
  .notification {
    bottom: 10px;
    left: 10px;
    right: 10px;
    text-align: center;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0;
    padding-bottom: 0;
  }

  .center-panel {
    order: 1;
    flex: 1 1 0;
    min-height: 0;
    transition: all 0.3s ease;
  }

  /* 手機版的衣櫃面板樣式 */
  .left-panel {
    order: 2;
    flex: 0 0 auto;
    min-height: 0;
    height: auto;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
  }

  .left-panel.collapsed {
    display: block;
    width: 100%;
    min-height: 0;
  }

  

/* 平板視圖覆寫：保持收合時與分類列一致的寬度 */
.tablet-view .left-panel.collapsed {
  width: 68px;
  min-width: 68px;
  max-width: 68px;
}
  .modal-overlay {
    padding: 0;
    align-items: stretch;
  }
  
  .modal-base {
    width: 100% !important;
    max-width: 100vw;
    /* iOS Safari 100vh 修復 */
    max-height: 100vh;
    max-height: 100dvh;
    max-height: calc(var(--vh, 1vh) * 100);
    height: 100vh;
    height: 100dvh;
    height: calc(var(--vh, 1vh) * 100);
    border-radius: 0;
  }
  
  .modal-header {
    padding: 0.75rem 1rem;
    /* iOS 安全區域支援 */
    padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
  }
  
  .modal-content {
    padding: 1rem;
    /* iOS 安全區域支援 */
    padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  }
}

</style>