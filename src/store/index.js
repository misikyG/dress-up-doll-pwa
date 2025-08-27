// src/store/index.js - 增強版狀態管理
import { defineStore } from 'pinia'
import DressingCore from '../core/index.js'
import { nextTick } from 'vue'

// 用於深度複製狀態，避免歷史紀錄中的引用問題
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

export const useGameStore = defineStore('game', {
  state: () => ({
    isInitialized: false,
    wardrobeItems: [],
    savedOutfits: [],
    availablePacks: [],

    canvasSize: { width: 2000, height: 3800 },
    backgroundSize: { width: 2400, height: 4200 },

    // 當前換裝狀態
    currentOutfit: {
      background: null, character: null, expression: null, hair: null,
      outer: null, top: null, bottom: null, dress: null, shoes: null,
      accessories: [], others: []
    },
    selectedCharacterId: null, // 用於表情綁定

    // 畫布模式
    canvasMode: 'fixed', // 'fixed' 或 'free'
    freeMode: {
      itemPositions: {}, // { 'itemId-category-index': { x, y } }
      itemScales: {},    // { 'itemId-category-index': scale }
    },

    // Undo/Redo 歷史紀錄
    history: [],
    historyIndex: -1,
    isRestoring: false, // 標記，避免在 undo/redo 時重複記錄歷史

    // UI 狀態
    ui: {
      currentPage: 'dressing',
      loading: true,
      notification: null,
      showSearch: false,
      showSettings: false,
      wardrobeCollapsed: false,
      controlsCollapsed: false,
      isMobile: false
    },

    // 分類定義
    categories: [
      { key: 'starred', name: '星號', icon: '⭐' },
      { key: 'background', name: '背景', icon: '🖼️' },
      { key: 'character', name: '角色', icon: '👤' },
      { key: 'expression', name: '表情', icon: '😊' },
      { key: 'hair', name: '頭髮', icon: '💇' },
      { key: 'outer', name: '外套', icon: '🧥' },
      { key: 'top', name: '上衣', icon: '👕' },
      { key: 'bottom', name: '下身', icon: '👖' },
      { key: 'dress', name: '套裝', icon: '👗' },
      { key: 'shoes', name: '鞋子', icon: '👠' },
      { key: 'accessory', name: '配件', icon: '💍' },
      { key: 'other', name: '其他', icon: '📦' }
    ],
  }),

  getters: {
    getItemsByCategory: (state) => (category) => {
      if (category === 'starred') return state.savedOutfits;
      // 表情綁定邏輯
      if (category === 'expression' && state.selectedCharacterId) {
        return state.wardrobeItems.filter(item =>
          item.category === 'expression' && item.characterId === state.selectedCharacterId
        );
      }
      return state.wardrobeItems.filter(item => item.category === category);
    },
    isItemInCurrentOutfit: (state) => (item) => {
      const outfit = state.currentOutfit;
      if (outfit.accessories.some(v => v?.id === item.id)) return true;
      if (outfit.others.some(v => v?.id === item.id)) return true;
      for (const key in outfit) {
        if (outfit[key]?.id === item.id) return true;
      }
      return false;
    },
    canUndo: (state) => state.historyIndex > 0,
    canRedo: (state) => state.historyIndex < state.history.length - 1,
  },

  actions: {
    async initializeApp() {
      this.ui.loading = true;
      try {
        await DressingCore.init();
        const [items, outfits, packs] = await Promise.all([
          DressingCore.getAllData('items'),
          DressingCore.getAllData('outfits'),
          DressingCore.getAllData('packs'),
        ]);
        this.wardrobeItems = items;
        this.savedOutfits = outfits;
        this.availablePacks = packs;

        this.clearHistory();
        this.isInitialized = true;
        this.showNotification('✅ 系統準備就緒', 'success');
      } catch (error) {
        console.error("初始化失敗", error);
        this.showNotification(`❌ 系統初始化失敗: ${error}`, 'error');
      } finally {
        this.ui.loading = false;
      }
    },

    // --- 核心換裝操作 ---
    wearItem(item) {
      if (!item) return;
      // 智能穿衣邏輯
      if (item.category === 'dress') {
        this.currentOutfit.top = null;
        this.currentOutfit.bottom = null;
      }
      if (item.category === 'top' || item.category === 'bottom') {
        this.currentOutfit.dress = null;
      }
      if (item.category === 'character') {
        this.selectedCharacterId = item.id;
        // 可選：清空不相容的表情
        if (this.currentOutfit.expression?.characterId !== item.id) {
          this.currentOutfit.expression = null;
        }
      }

      // 執行穿戴
      if (['accessory', 'other'].includes(item.category)) {
        const list = item.category === 'accessory' ? 'accessories' : 'others';
        if (!this.currentOutfit[list].some(i => i.id === item.id)) {
          this.currentOutfit[list].push(item);
        }
      } else {
        this.currentOutfit[item.category] = item;
      }

      this.recordHistory();
      this.showNotification(`👗 已穿上: ${item.displayName}`, 'info');
    },

    removeItem(item) {
      if (!item) return;

      if (item.category === 'character' && this.currentOutfit.character?.id === item.id) {
        this.selectedCharacterId = null;
        this.currentOutfit.expression = null; // 角色移除時，表情也移除
      }

      // 執行移除
      if (['accessory', 'other'].includes(item.category)) {
        const list = item.category === 'accessory' ? 'accessories' : 'others';
        this.currentOutfit[list] = this.currentOutfit[list].filter(i => i.id !== item.id);
      } else {
        if (this.currentOutfit[item.category]?.id === item.id) {
          this.currentOutfit[item.category] = null;
        }
      }

      this.recordHistory();
      this.showNotification(`👕 已脫下: ${item.displayName}`, 'info');
    },

    clearCurrentOutfit() {
      this.currentOutfit = {
        background: null, character: null, expression: null, hair: null,
        outer: null, top: null, bottom: null, dress: null, shoes: null,
        accessories: [], others: []
      };
      this.freeMode = { itemPositions: {}, itemScales: {} };
      this.selectedCharacterId = null;
      this.recordHistory();
      this.showNotification('🗑️ 畫布已清空', 'info');
    },

    // --- 歷史紀錄 (Undo/Redo) ---
    recordHistory() {
      if (this.isRestoring) return; // 如果正在 undo/redo，則不記錄

      // 創建當前狀態的快照
      const snapshot = {
        outfit: deepClone(this.currentOutfit),
        freeMode: deepClone(this.freeMode)
      };

      // 如果當前指針不在歷史紀錄末尾，則清除之後的所有紀錄
      if (this.historyIndex < this.history.length - 1) {
        this.history.splice(this.historyIndex + 1);
      }

      this.history.push(snapshot);
      this.historyIndex++;

      // 限制歷史紀錄長度，防止記憶體溢出
      if (this.history.length > 50) {
        this.history.shift();
        this.historyIndex--;
      }
    },

    undo() {
      if (!this.canUndo) return;
      this.isRestoring = true;
      this.historyIndex--;
      const prevState = this.history[this.historyIndex];
      this.currentOutfit = deepClone(prevState.outfit);
      this.freeMode = deepClone(prevState.freeMode);

      // 恢復角色ID狀態
      this.selectedCharacterId = this.currentOutfit.character?.id || null;

      nextTick(() => { this.isRestoring = false; });
    },

    redo() {
      if (!this.canRedo) return;
      this.isRestoring = true;
      this.historyIndex++;
      const nextState = this.history[this.historyIndex];
      this.currentOutfit = deepClone(nextState.outfit);
      this.freeMode = deepClone(nextState.freeMode);

      // 恢復角色ID狀態
      this.selectedCharacterId = this.currentOutfit.character?.id || null;

      nextTick(() => { this.isRestoring = false; });
    },

    clearHistory() {
      this.history = [];
      this.historyIndex = -1;
      this.recordHistory(); // 將初始空狀態存入歷史
    },

    // --- 搭配管理 ---
    async saveCurrentOutfit(name) {
      try {
        const outfitData = {
          id: `outfit_${Date.now()}`, // **新增**: 手動生成ID
          name: name || `我的搭配-${this.savedOutfits.length + 1}`,
          outfit: this.currentOutfit,
          freeMode: this.freeMode,
          createdAt: new Date().toISOString(),
        };
        await DressingCore.saveData('outfits', outfitData);
        this.savedOutfits.push(outfitData);
        this.showNotification(`⭐ 搭配已儲存: ${name}`, 'success');
      } catch (error) {
        this.showNotification('❌ 儲存搭配失敗', 'error');
      }
    },

    loadOutfit(outfit) {
      this.currentOutfit = deepClone(outfit.outfit);
      this.freeMode = deepClone(outfit.freeMode || { itemPositions: {}, itemScales: {} });
      this.selectedCharacterId = this.currentOutfit.character?.id || null;
      this.recordHistory();
      this.showNotification(`⭐ 已載入搭配: ${outfit.name}`, 'success');
    },

    async deleteOutfit(outfitId) {
      try {
        await DressingCore.deleteOutfit(outfitId);
        this.savedOutfits = this.savedOutfits.filter(o => o.id !== outfitId);
        this.showNotification('🗑️ 搭配已刪除', 'success');
      } catch (error) {
        this.showNotification('❌ 刪除搭配失敗', 'error');
      }
    },

    // --- 匯入與資料管理 ---
    async addNewItem(itemData) {
      await DressingCore.saveData('items', itemData);
      this.wardrobeItems.push(itemData);
    },

    async addPack(packInfo) {
      await DressingCore.saveData('packs', packInfo);
      const index = this.availablePacks.findIndex(p => p.id === packInfo.id);
      if (index !== -1) { this.availablePacks[index] = packInfo; }
      else { this.availablePacks.push(packInfo); }
    },

    async deletePack(packId) {
      this.ui.loading = true;
      try {
        const pack = this.availablePacks.find(p => p.id === packId);
        await DressingCore.deletePackAndItems(packId);
        this.wardrobeItems = this.wardrobeItems.filter(item => item.packId !== packId);
        this.availablePacks = this.availablePacks.filter(p => p.id !== packId);
        this.showNotification(`圖包 "${pack.displayName}" 已刪除`, 'success');
      } catch (error) {
        this.showNotification('刪除圖包失敗', 'error');
      } finally {
        this.ui.loading = false;
      }
    },

    async clearAllData() {
      this.ui.loading = true;
      try {
        await DressingCore.clearAllData();
        this.wardrobeItems = []; this.savedOutfits = []; this.availablePacks = [];
        this.clearCurrentOutfit(); this.clearHistory();
        this.showNotification('所有數據已清空', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        this.showNotification('清空數據失敗', 'error');
        this.ui.loading = false;
      }
    },

    // --- 自由模式 ---
    setCanvasMode(mode) {
      this.canvasMode = mode;
    },
    setItemPosition(itemId, position) {
      this.freeMode.itemPositions[itemId] = position;
      // 這裡不立即記錄歷史，通常拖拽結束後才記錄
    },
    setItemScale(itemId, scale) {
      this.freeMode.itemScales[itemId] = scale;
      // 同上，縮放結束後記錄
    },

    // --- UI & 通知 ---
    showNotification(message, type = 'info', duration = 3000) {
      this.ui.notification = { message, type };
      setTimeout(() => { this.ui.notification = null; }, duration);
    },
    setCurrentPage(page) { this.ui.currentPage = page; },
    toggleSearch() { this.ui.showSearch = !this.ui.showSearch; },
    toggleSettings() { this.ui.showSettings = !this.ui.showSettings; },
    toggleWardrobe() { this.ui.wardrobeCollapsed = !this.ui.wardrobeCollapsed; },
    toggleControls() { this.ui.controlsCollapsed = !this.ui.controlsCollapsed; },
    setMobileMode(isMobile) { this.ui.isMobile = isMobile; },
  }
})