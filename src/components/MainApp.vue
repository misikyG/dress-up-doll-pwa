<template>
  <div id="app-container" :class="{ 'mobile-view': gameStore.ui.isMobile, 'tablet-view': gameStore.ui.isTablet }">
    <div v-if="gameStore.ui.loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">系統載入中...</p>
    </div>

    <main v-else class="main-app">
      <header class="app-header">
        <div class="logo">
          <h1><svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-needle-thread" width="32" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M3 21c-.667 -.667 3.262 -6.236 11.785 -16.709a3.5 3.5 0 1 1 5.078 4.791c-10.575 8.612 -16.196 12.585 -16.863 11.918z" />
  <path d="M17.5 6.5l-1 1" />
  <path d="M17 7c-2.333 -2.667 -3.5 -4 -5 -4s-2 1 -2 2c0 4 8.161 8.406 6 11c-1.056 1.268 -3.363 1.285 -5.75 .808" />
  <path d="M5.739 15.425c-1.393 -.565 -3.739 -1.925 -3.739 -3.425" />
  <path d="M19.5 9.5l1.5 1.5" />
</svg><span class="sr-only">換裝紙娃娃</span></h1>
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
          <button @click="gameStore.toggleSearch()" title="搜尋" aria-label="搜尋" class="icon-btn" v-html="icons.search"></button>
          <button @click="showHelp = !showHelp" title="使用說明" aria-label="使用說明" class="icon-btn" v-html="icons.help"></button>
          <button @click="showContact = !showContact" title="聯繫作者" aria-label="聯繫作者" class="icon-btn" v-html="icons.contact"></button>
          <button @click="gameStore.toggleSettings()" title="設定" aria-label="設定" class="icon-btn" v-html="icons.settings"></button>
        </div>
      </header>

      <!-- 主要內容區域 -->
      <div class="content-wrapper" :class="layoutClass">
        <div class="panel left-panel" :class="{ collapsed: gameStore.ui.wardrobeCollapsed }">
          <Wardrobe />
        </div>

        <div class="panel center-panel">
          <div class="main-content">
            <keep-alive>
              <component :is="activePageComponent" />
            </keep-alive>
          </div>
          
          <div v-if="gameStore.ui.currentPage === 'dressing' && !gameStore.ui.isMobile && !gameStore.ui.isTablet" 
               class="layer-panel-container desktop">
            <LayerPanel />
          </div>
        </div>

      </div>
    </main>

    <transition name="fade">
      <div v-if="gameStore.ui.showSearch || gameStore.ui.showSettings || showHelp || showContact" class="modal-overlay" @click="closeModals" @touchmove.self.prevent>
        <Search v-if="gameStore.ui.showSearch" @close="gameStore.toggleSearch" @click.stop />
        <Settings v-if="gameStore.ui.showSettings" @close="gameStore.toggleSettings" />
        <Help v-if="showHelp" @close="showHelp = false" @click.stop />
        <Contact v-if="showContact" @close="showContact = false" @click.stop />
      </div>
    </transition>

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
  if (gameStore.ui.isMobile) return 'layout-mobile';
  if (gameStore.ui.isTablet) return 'layout-tablet';
  return gameStore.ui.wardrobeCollapsed ? 'layout-center-only' : 'layout-left-center';
});

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

const preventContextMenu = (e) => {
  if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
  }
}

onMounted(async () => {
  await gameStore.initializeApp()
  checkResponsive()
  window.addEventListener('resize', checkResponsive)
  document.addEventListener('contextmenu', preventContextMenu)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkResponsive)
  document.removeEventListener('contextmenu', preventContextMenu)
})
</script>
