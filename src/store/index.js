/**
 * store/index.js
 * 紙娃娃遊戲的核心狀態管理
 */
import { defineStore } from 'pinia'
import DressingCore from '../core/index.js'
import { icons } from '../icons.js'

/* ========================================
   工具函式
   ======================================== */

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `outfit-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// 共用的資料標準化函式
const normalizeOutfitData = (outfit) => ({
  ...outfit,
  outfit: normalizeOutfit(outfit.outfit),
  layerOrder: deepClone(outfit.layerOrder || [])
});

/* ========================================
   常數與映射表
   ======================================== */

const slotNameMap = {
  accessory: 'accessories',
  carry: 'carries',
  underwear: 'underwears',
  other: 'others'
};

const getSlotName = (category) => slotNameMap[category] || category;

const categoryOrder = [
  'filter', 'background', 'character', 'expression', 'hair', 'underwear',
  'top', 'bottom', 'outer', 'dress', 'shoes',
  'accessory', 'carry', 'other'
];

const defaultZIndexMap = {
  filter: -10,
  background: 0, character: 100, expression: 150, hair: 200,
  underwear: 180, top: 300, bottom: 250, outer: 500, dress: 275, shoes: 50,
  accessory: 600, carry: 650, other: 700
};

const singleSlotCategories = new Set(['filter', 'background', 'character', 'expression']);

// 儲存最初載入時的主題 CSS，確保預設主題與 index.html 同步
// 注意：使用 rgba 而非 rgb(from ...) 確保 iOS Safari 相容性
const hardcodedDefaultThemeCSS = `
:root {
  --color-primary: #618b6a;
  --color-primary-light: #7da585;
  --color-bg-main: #f8f5ea;
  --color-bg-panel: #f1f7e5;
  --color-bg-card: #ffffff;
  --color-bg-canvas: #f0f2f5;
  --color-text-primary: #472d25;
  --color-text-secondary: #666666;
  --color-border: #c0b7a3;
  --color-border-light: #e8e8e8;
  --color-success: #709172;
  --color-error: #ad4b44;
  --color-warning: #f5bb64;
  --color-info: #71a2ca;
  /* iOS Safari 相容性：使用 rgba 取代 rgb(from ...) */
  --shadow-sm: 0 1px 3px rgba(71, 45, 37, 0.05);
  --shadow-md: 0 2px 8px rgba(71, 45, 37, 0.08);
  --shadow-lg: 0 4px 12px rgba(71, 45, 37, 0.12);
  --shadow-xl: 0 8px 24px rgba(71, 45, 37, 0.15);
  --panel-width: 320px;
  --wardrobe-width: clamp(320px, 28vw, 500px);
  --controls-width: clamp(300px, 26vw, 420px);
  --wardrobe-sidebar-width: clamp(150px, 15vw, 210px);
  --collapsed-width: 80px;
  --handle-width: 20px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 50%;
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
}
`;

let initialThemeCSS = '';
const captureInitialThemeCSS = () => {
  if (initialThemeCSS || typeof document === 'undefined') return;
  const el = document.getElementById('theme-variables');
  if (el) {
    initialThemeCSS = el.innerHTML;
  }
};

/* ========================================
   穿搭資料結構
   ======================================== */

const createEmptyOutfit = () => ({
  filter: [],
  background: [],
  character: [],
  expression: [],
  hair: [],
  underwears: [],
  top: [],
  bottom: [],
  outer: [],
  dress: [],
  shoes: [],
  accessories: [],
  carries: [],
  others: []
});

const normalizeOutfit = (outfit) => {
  const normalized = createEmptyOutfit();
  if (!outfit) return normalized;
  Object.keys(normalized).forEach((key) => {
    const value = outfit[key];
    if (!value) return;
    normalized[key] = Array.isArray(value)
      ? deepClone(value)
      : [deepClone(value)];
  });
  return normalized;
};

/* ========================================
   圖層構建
   ======================================== */

const buildLayers = (outfit, layerOrder, hiddenSet = new Set()) => {
  const layers = [];

  categoryOrder.forEach((category) => {
    const slot = getSlotName(category);
    const items = outfit[slot] || [];
    const safeItems = Array.isArray(items) ? items : items ? [items] : [];

    safeItems.forEach((item, index) => {
      if (!item) return;
      const layerId = `${item.id}-${category}-${index}`;
      const customOrder = layerOrder.find(l => l.id === layerId || l.id === item.id);
      layers.push({
        id: layerId,
        item,
        category,
        zIndex: customOrder?.zIndex ?? (defaultZIndexMap[category] + index),
        isCustomOrder: Boolean(customOrder),
        hidden: hiddenSet.has(layerId)
      });
    });
  });

  return layers.sort((a, b) => a.zIndex - b.zIndex);
};

/* ========================================
   Store 定義
   ======================================== */

export const useGameStore = defineStore('game', {
  /* ----------------------------------------
     State - 應用程式狀態
     ---------------------------------------- */
  state: () => ({
    // 初始化狀態
    isInitialized: false,
    
    // 核心資料
    wardrobeItems: [],
    savedOutfits: [],
    availablePacks: [],
    hiddenItems: [],
    hiddenLayerIds: [],

    // 畫布設定
    canvasSize: { width: 2000, height: 3800 },
    backgroundSize: { width: 2000, height: 3800 },
    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },

    // 當前穿搭狀態
    currentOutfit: createEmptyOutfit(),
    selectedCharacterId: null,
    selectedItem: null,
    layerOrder: [],

    // 畫布模式
    canvasMode: 'fixed',
    freeMode: {
      itemPositions: {},
      itemScales: {},
      itemFlips: {},
      itemRotations: {},

      enableFreeScale: true,
      enableFreeRotation: false,
    },

    // Undo/Redo 歷史記錄
    history: [],
    historyIndex: -1,
    isRestoring: false,

    // UI 狀態
    ui: {
      currentPage: 'dressing',
      loading: true,
      notification: null,
      showSearch: false,
      showSettings: false,
      wardrobeCollapsed: false,
      controlsCollapsed: false,
      isMobile: false,
      isTablet: false,
      layerPanelCollapsed: false,
      highlightedItemId: null, // 搜尋跳轉高亮物件
    },

    // 分類定義 (順序：星號→濾鏡→背景→人物→表情→髮型→內衣→上衣→下身→外套→套裝→鞋子→配飾→攜帶品→其他)
    categories: [
      { key: 'starred', name: '已儲存搭配', icon: '⭐', svg: icons.starred },
      { key: 'filter', name: '濾鏡', icon: '🎛', svg: icons.filterLayer },
      { key: 'background', name: '背景', icon: '🌄', svg: icons.background },
      { key: 'character', name: '人物', icon: '🧍', svg: icons.character },
      { key: 'expression', name: '表情', icon: '😊', svg: icons.expression },
      { key: 'hair', name: '髮型', icon: '💇', svg: icons.hair },
      { key: 'underwear', name: '內衣', icon: '👙', svg: icons.underwear },
      { key: 'top', name: '上衣', icon: '👕', svg: icons.top },
      { key: 'bottom', name: '下身', icon: '👖', svg: icons.bottom },
      { key: 'outer', name: '外套', icon: '🧥', svg: icons.outer },
      { key: 'dress', name: '套裝', icon: '👗', svg: icons.dress },
      { key: 'shoes', name: '鞋子', icon: '👠', svg: icons.shoes },
      { key: 'accessory', name: '配飾', icon: '💎', svg: icons.accessory },
      { key: 'carry', name: '攜帶品', icon: '👜', svg: icons.carry },
      { key: 'other', name: '其他', icon: '📦', svg: icons.other }
    ],

    // Tag 定義
    categoryTags: {},

    // 主題與自定義樣式
    theme: {
      currentTheme: 'default',
      customThemes: [],
      customCSS: '',
    },

    // 已刪除的附贈圖包 ID 列表
    dismissedBundledPacks: [],
  }),

  /* ----------------------------------------
     Getters - 計算屬性
     ---------------------------------------- */
  getters: {
    // 物件查詢
    getItemsByCategory: (state) => (category) => {
      if (category === 'starred') return state.savedOutfits;
      if (category === 'expression' && state.selectedCharacterId) {
        return state.wardrobeItems.filter(item =>
          item.category === 'expression' && item.characterId === state.selectedCharacterId
        );
      }
      return state.wardrobeItems.filter(item => item.category === category);
    },

    isItemInCurrentOutfit: (state) => (item) => {
      if (!item) return false;
      const slot = getSlotName(item.category);
      const list = state.currentOutfit[slot] || [];
      return list.some(i => i.id === item.id);
    },

    // 圖層計算
    currentLayers: (state) => buildLayers(state.currentOutfit, state.layerOrder, new Set(state.hiddenLayerIds)),

    // 歷史記錄狀態
    canUndo: (state) => state.historyIndex > 0,
    canRedo: (state) => state.historyIndex < state.history.length - 1,

    // 工具函式
    getCategoryName: (state) => (category) => {
      const cat = state.categories.find(c => c.key === category);
      return cat ? cat.name : category;
    },

    getPackName: (state) => (item) => {
      if (!item?.packId) return '未知圖包';
      const pack = state.availablePacks.find(p => p.id === item.packId);
      return pack ? (pack.displayName || pack.name) : '未知圖包';
    },
  },

  /* ----------------------------------------
     Actions - 操作方法
     ---------------------------------------- */
  actions: {
    /* ========================================
       初始化與狀態管理
       ======================================== */

    async initializeApp() {
      this.ui.loading = true;
      try {
        await DressingCore.init();
        const [items, outfits, packs] = await Promise.all([
          DressingCore.getAllData('items'),
          DressingCore.getAllData('outfits'),
          DressingCore.getAllData('packs'),
        ]);

        // 載入主題設定
        let themeData = null;
        try {
          themeData = await DressingCore.getData('theme', 'settings');
        } catch (error) {
          console.log('主題設定尚未建立，使用預設值');
        }
        if (!themeData) {
          try {
            const cached = localStorage.getItem('theme-settings-cache');
            if (cached) {
              themeData = JSON.parse(cached);
              console.log('從 localStorage 載入主題設定備援');
            }
          } catch (cacheErr) {
            console.warn('讀取主題設定備援失敗', cacheErr);
          }
        }
        this.wardrobeItems = items;
        this.savedOutfits = outfits.map(normalizeOutfitData);
        this.availablePacks = packs;

        // 套用主題設定
        if (themeData) {
          this.theme.currentTheme = themeData.currentTheme || 'default';
          this.theme.customThemes = Array.isArray(themeData.customThemes) ? themeData.customThemes : [];
          this.theme.customCSS = themeData.customCSS || '';
          this.theme.previewColors = themeData.previewColors || null;

        console.log('🎨 已載入主題設定');

          // 優先套用預覽顏色，否則套用當前主題
          if (this.theme.previewColors && Object.keys(this.theme.previewColors).length > 0) {
            const root = document.documentElement;
            Object.entries(this.theme.previewColors).forEach(([key, value]) => {
              root.style.setProperty(`--${key}`, value);
            });
          } else {
            this.applyTheme(this.theme.currentTheme);
          }
          
          this.applyCustomCSS(this.theme.customCSS);
        }

        // 載入其他設定
        await this.loadHiddenItems();
        await this.loadAppState();
        await this.loadDismissedBundledPacks();

        this.clearHistory();
        this.recordHistory();
        this.isInitialized = true;
        this.showNotification('✅ 系統準備就緒', 'success');
      } catch (error) {
        console.error("初始化失敗", error);
        this.showNotification(`❌ 系統初始化失敗: ${error}`, 'error');
      } finally {
        this.ui.loading = false;
      }
    },

    /* ========================================
       應用程式狀態快取
       ======================================== */

    async saveAppState() {
      try {
        const appState = {
          currentOutfit: deepClone(this.currentOutfit),
          selectedCharacterId: this.selectedCharacterId,
          layerOrder: deepClone(this.layerOrder),
          canvasMode: this.canvasMode,
          freeMode: deepClone(this.freeMode),
          canvasZoom: this.canvasZoom,
          canvasPan: deepClone(this.canvasPan),
          currentPage: this.ui.currentPage,
          wardrobeCollapsed: this.ui.wardrobeCollapsed,
          layerPanelCollapsed: this.ui.layerPanelCollapsed,
          hiddenLayerIds: deepClone(this.hiddenLayerIds),
        };
        await DressingCore.setData('settings', 'appState', appState);
      } catch (error) {
        console.error('保存應用程式狀態失敗:', error);
      }
    },

    async loadAppState() {
      try {
        const appState = await DressingCore.getData('settings', 'appState');
        if (appState) {
          if (appState.currentOutfit) this.currentOutfit = normalizeOutfit(appState.currentOutfit);
          if (appState.selectedCharacterId) this.selectedCharacterId = appState.selectedCharacterId;
          if (appState.layerOrder) this.layerOrder = appState.layerOrder;
          if (appState.canvasMode) this.canvasMode = appState.canvasMode;
          if (appState.freeMode) this.freeMode = { ...this.freeMode, ...appState.freeMode };
          if (appState.canvasZoom) this.canvasZoom = appState.canvasZoom;
          if (appState.canvasPan) this.canvasPan = appState.canvasPan;
          if (appState.currentPage) this.ui.currentPage = appState.currentPage;
          if (typeof appState.wardrobeCollapsed === 'boolean') this.ui.wardrobeCollapsed = appState.wardrobeCollapsed;
          if (typeof appState.layerPanelCollapsed === 'boolean') this.ui.layerPanelCollapsed = appState.layerPanelCollapsed;
          if (Array.isArray(appState.hiddenLayerIds)) this.hiddenLayerIds = appState.hiddenLayerIds;
          console.log('📦 已恢復應用程式狀態');
        } else {
          this.currentOutfit = createEmptyOutfit();
        }
      } catch (error) {
        console.log('應用程式狀態尚未建立，使用預設值');
        this.currentOutfit = createEmptyOutfit();
      }
    },

    debouncedSaveAppState() {
      if (this._saveAppStateTimer) clearTimeout(this._saveAppStateTimer);
      this._saveAppStateTimer = setTimeout(() => this.saveAppState(), 1000);
    },

    /* ========================================
       核心換裝操作
       ======================================== */

    wearItem(item, variantKey = null) {
      if (!item) return;
      const slot = getSlotName(item.category);
      const currentItems = this.currentOutfit[slot] || [];

      let itemToWear = deepClone(item);
      if (variantKey && item.variants) {
        itemToWear.currentVariant = variantKey;
        if (item.variantImages && item.variantImages[variantKey]) {
          itemToWear.imageData = item.variantImages[variantKey];
        }
      }

      const exists = currentItems.some(i => i.id === item.id);
      if (exists) return;

      if (singleSlotCategories.has(item.category)) {
        this.currentOutfit[slot] = [itemToWear];
      } else {
        this.currentOutfit[slot] = [...currentItems, itemToWear];
      }

      if (item.category === 'character') {
        this.selectedCharacterId = item.id;
        // 切換人物時清除表情，避免跨人物表情殘留
        this.currentOutfit.expression = [];
      }
      if (item.category === 'expression' && item.characterId) {
        this.selectedCharacterId = item.characterId;
      }

      this.selectedItem = null;

      if (!this.isRestoring) {
        this.recordHistory();
        this.showNotification(`✨ 已穿戴：${item.displayName}`, 'success');
      }
    },

    switchItemVariant(itemId, variantKey) {
      for (const slotKey of Object.keys(this.currentOutfit)) {
        const items = this.currentOutfit[slotKey];
        if (!Array.isArray(items)) continue;

        const itemIndex = items.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
          const item = items[itemIndex];
          const originalItem = this.wardrobeItems.find(w => w.id === itemId);
          if (originalItem && originalItem.variants) {
            item.currentVariant = variantKey;
            if (originalItem.variantImages && originalItem.variantImages[variantKey]) {
              item.imageData = originalItem.variantImages[variantKey];
            }
            this.recordHistory();
            this.showNotification(`🔄 已切換變體：${originalItem.variants.find(v => v.key === variantKey)?.name || variantKey}`, 'info');
          }
          break;
        }
      }
    },

    removeItem(item) {
      if (!item) return;
      const slot = getSlotName(item.category);
      const filtered = (this.currentOutfit[slot] || []).filter(i => i.id !== item.id);
      this.currentOutfit[slot] = filtered;

      this.hiddenLayerIds = this.hiddenLayerIds.filter(id => !id.startsWith(`${item.id}-`));

      if (item.category === 'character' && this.selectedCharacterId === item.id) {
        this.selectedCharacterId = filtered[0]?.id || null;
      }

      this.selectedItem = null;

      if (!this.isRestoring) {
        this.recordHistory();
        this.showNotification(`🗑️ 已移除：${item.displayName}`, 'info');
      }
    },

    selectItem(layer) {
      this.selectedItem = layer;
      if (layer?.category === 'character') {
        this.selectedCharacterId = layer.item.id;
      }
    },

    clearSelection() {
      this.selectedItem = null;
    },

    clearCurrentOutfit() {
      Object.keys(this.currentOutfit).forEach(key => {
        this.currentOutfit[key] = [];
      });
      this.selectedCharacterId = null;
      this.selectedItem = null;
      this.layerOrder = [];
      this.freeMode.itemPositions = {};
      this.freeMode.itemScales = {};
      this.freeMode.itemFlips = {};
      this.freeMode.itemRotations = {};
      this.hiddenLayerIds = [];

      if (!this.isRestoring) {
        this.recordHistory();
        this.showNotification('🗑️ 已清空穿搭', 'info');
      }
    },

    /* ========================================
       圖層管理
       ======================================== */

    moveLayerUp(layerId) {
      const layers = this.currentLayers;
      const currentIndex = layers.findIndex(l => l.id === layerId);
      if (currentIndex < layers.length - 1) {
        const targetIndex = currentIndex + 1;
        const targetLayer = layers[targetIndex];
        this.updateCustomLayerOrder(layerId, targetLayer.zIndex + 1);
        this.recordHistory();
      }
    },

    moveLayerDown(layerId) {
      const layers = this.currentLayers;
      const currentIndex = layers.findIndex(l => l.id === layerId);
      if (currentIndex > 0) {
        const targetIndex = currentIndex - 1;
        const targetLayer = layers[targetIndex];
        this.updateCustomLayerOrder(layerId, targetLayer.zIndex - 1);
        this.recordHistory();
      }
    },

    updateCustomLayerOrder(layerId, newZIndex) {
      const existingIndex = this.layerOrder.findIndex(l => l.id === layerId);
      if (existingIndex >= 0) {
        this.layerOrder[existingIndex].zIndex = newZIndex;
      } else {
        this.layerOrder.push({ id: layerId, zIndex: newZIndex });
      }
    },

    updateLayerOrder(newOrder) {
      this.layerOrder = newOrder.map((layer, index) => ({
        id: layer.id,
        zIndex: index * 10
      }));
      this.recordHistory();
    },

    isLayerHidden(layerId) {
      return this.hiddenLayerIds.includes(layerId);
    },

    toggleLayerHidden(layerId) {
      const idx = this.hiddenLayerIds.indexOf(layerId);
      if (idx === -1) {
        this.hiddenLayerIds.push(layerId);
      } else {
        this.hiddenLayerIds.splice(idx, 1);
      }
      this.recordHistory();
    },

    resetLayerOrder() {
      this.layerOrder = [];
      this.recordHistory();
    },

    /* ========================================
       自由模式與變換
       ======================================== */

    setItemPosition(itemId, position) {
      this.freeMode.itemPositions[itemId] = { ...position };
    },

    setItemScale(itemId, scale) {
      this.freeMode.itemScales[itemId] = scale;
    },

    setItemFlip(itemId, flip) {
      this.freeMode.itemFlips[itemId] = { ...flip };
    },

    setItemRotation(itemId, rotation) {
      this.freeMode.itemRotations[itemId] = rotation;
    },

    resetItemTransforms() {
      this.freeMode.itemPositions = {};
      this.freeMode.itemScales = {};
      this.freeMode.itemFlips = {};
      this.freeMode.itemRotations = {};
      this.selectedItem = null;
      this.recordHistory();
      this.showNotification('🔄 已重置所有變換', 'info');
    },

    /* ========================================
       歷史記錄管理 (Undo/Redo)
       ======================================== */

    recordHistory() {
      if (this.isRestoring) return;

      const currentState = {
        outfit: deepClone(this.currentOutfit),
        selectedCharacterId: this.selectedCharacterId,
        freeMode: deepClone(this.freeMode),
        layerOrder: deepClone(this.layerOrder),
        canvasMode: this.canvasMode,
        hiddenLayerIds: deepClone(this.hiddenLayerIds)
      };

      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(currentState);

      if (this.history.length > 50) {
        this.history = this.history.slice(-50);
      }

      this.historyIndex = this.history.length - 1;
      this.debouncedSaveAppState();
    },

    clearHistory() {
      this.history = [];
      this.historyIndex = -1;
    },

    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.restoreFromHistory();
      }
    },

    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.restoreFromHistory();
      }
    },

    restoreFromHistory() {
      if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
        this.isRestoring = true;
        const state = this.history[this.historyIndex];
        this.currentOutfit = deepClone(state.outfit);
        this.selectedCharacterId = state.selectedCharacterId;
        this.freeMode = deepClone(state.freeMode);
        this.layerOrder = deepClone(state.layerOrder || []);
        this.canvasMode = state.canvasMode || this.canvasMode;
        this.hiddenLayerIds = deepClone(state.hiddenLayerIds || []);
        this.isRestoring = false;
      }
    },

    /* ========================================
       穿搭儲存管理
       ======================================== */

    async saveCurrentOutfit(name, previewImage = null) {
      const trimmedName = name?.trim();
      if (!trimmedName) {
        this.showNotification('❌ 請輸入穿搭名稱', 'error');
        return;
      }

      const existing = this.savedOutfits.find(o => o.name === trimmedName);
      if (existing) {
        const confirmOverwrite = confirm('是否要將舊搭配覆蓋？');
        if (!confirmOverwrite) {
          this.showNotification('ℹ️ 已取消覆蓋', 'info');
          return;
        }
      }

      const outfitData = {
        id: existing?.id || generateId(),
        name: trimmedName,
        outfit: deepClone(this.currentOutfit),
        layerOrder: deepClone(this.layerOrder),
        freeMode: deepClone(this.freeMode),
        canvasZoom: this.canvasZoom,
        canvasPan: deepClone(this.canvasPan),
        canvasMode: this.canvasMode,
        previewImage: previewImage,
        createdAt: existing?.createdAt || new Date().toISOString()
      };

      try {
        await DressingCore.saveData('outfits', outfitData);
        await this._refreshOutfits();
        this.showNotification(`💾 穿搭「${trimmedName}」已保存`, 'success');
      } catch (error) {
        console.error('保存穿搭失敗:', error);
        this.showNotification('❌ 保存失敗', 'error');
      }
    },

    async importOutfit(outfitData) {
      if (!outfitData) return;
      const normalized = {
        ...outfitData,
        id: outfitData.id || generateId(),
        outfit: normalizeOutfit(outfitData.outfit),
        layerOrder: deepClone(outfitData.layerOrder || [])
      };
      try {
        await DressingCore.saveData('outfits', normalized);
        await this._refreshOutfits();
      } catch (error) {
        console.error('匯入穿搭失敗:', error);
        this.showNotification('❌ 匯入穿搭失敗', 'error');
      }
    },

    async deleteOutfit(outfitId) {
      try {
        await DressingCore.deleteData('outfits', outfitId);
        await this._refreshOutfits();
        this.showNotification('🗑️ 穿搭已刪除', 'info');
      } catch (error) {
        console.error('刪除穿搭失敗:', error);
        this.showNotification('❌ 刪除失敗', 'error');
      }
    },

    async renameOutfit(outfitId, newName) {
      try {
        if (!outfitId || !newName) {
          this.showNotification('❌ 重新命名失敗：缺少必要參數', 'error');
          return false;
        }
        
        const originalOutfit = await DressingCore.getData('outfits', outfitId);
        if (!originalOutfit) {
          this.showNotification('❌ 找不到該穿搭', 'error');
          return false;
        }
        
        const updatedOutfit = { ...originalOutfit, name: newName };
        await DressingCore.saveData('outfits', updatedOutfit);
        await this._refreshOutfits();
        this.showNotification('✏️ 穿搭已重新命名', 'success');
        return true;
      } catch (error) {
        console.error('重新命名穿搭失敗:', error);
        this.showNotification('❌ 重新命名失敗', 'error');
        return false;
      }
    },

    loadOutfit(outfit) {
      this.isRestoring = true;
      const normalized = normalizeOutfit(outfit.outfit);
      this.currentOutfit = normalized;
      this.freeMode = deepClone(outfit.freeMode || {
        itemPositions: {}, itemScales: {}, itemFlips: {}, itemRotations: {},
        enableFreeScale: true, enableFreeRotation: false
      });
      this.layerOrder = deepClone(outfit.layerOrder || []);
      this.canvasZoom = outfit.canvasZoom || 1;
      this.canvasPan = deepClone(outfit.canvasPan || { x: 0, y: 0 });
      this.canvasMode = outfit.canvasMode || 'fixed';
      this.selectedCharacterId = normalized.character[0]?.id || null;
      this.isRestoring = false;
      this.recordHistory();
      this.showNotification(`📷 已載入穿搭: ${outfit.name}`, 'success');
    },

    /* ========================================
       圖包管理
       ======================================== */

    async addNewItem(itemData) {
      try {
        await DressingCore.saveData('items', itemData);
        this.wardrobeItems = await DressingCore.getAllData('items');
        return itemData;
      } catch (error) {
        console.error('添加物品失敗:', error);
        throw error;
      }
    },

    async addPack(packData) {
      try {
        await DressingCore.saveData('packs', packData);
        this.availablePacks = await DressingCore.getAllData('packs');
        return packData;
      } catch (error) {
        console.error('添加圖包失敗:', error);
        throw error;
      }
    },

    async deletePack(packId) {
      try {
        const pack = this.availablePacks.find(p => p.id === packId);
        const isBundledPack = pack?.isBundled === true;

        const itemsToDelete = this.wardrobeItems.filter(item => item.packId === packId);
        for (const item of itemsToDelete) {
          await DressingCore.deleteData('items', item.id);
        }

        await DressingCore.deleteData('packs', packId);

        this.wardrobeItems = this.wardrobeItems.filter(item => item.packId !== packId);
        this.availablePacks = this.availablePacks.filter(pack => pack.id !== packId);

        // 如果是附贈圖包，記錄到已刪除列表
        if (isBundledPack) {
          await this.dismissBundledPack(packId);
        }

        this.cleanupOutfit();
        this.showNotification('🗑️ 圖包已刪除', 'info');
      } catch (error) {
        console.error('刪除圖包失敗:', error);
        this.showNotification('❌ 刪除失敗', 'error');
      }
    },

    cleanupOutfit() {
      const validItemIds = this.wardrobeItems.map(item => item.id);
      Object.keys(this.currentOutfit).forEach(key => {
        this.currentOutfit[key] = (this.currentOutfit[key] || []).filter(item =>
          validItemIds.includes(item.id)
        );
      });
      this.hiddenLayerIds = this.hiddenLayerIds.filter(id => {
        const itemId = id.split('-')[0];
        return validItemIds.includes(itemId);
      });
    },

    async clearAllData() {
      try {
        await DressingCore.clearAllData();
        this.wardrobeItems = [];
        this.savedOutfits = [];
        this.availablePacks = [];
        this.hiddenItems = [];
        this.clearCurrentOutfit();
        this.clearHistory();
        this.showNotification('🗑️ 所有資料已清空', 'info');
      } catch (error) {
        console.error('清空資料失敗:', error);
        this.showNotification('❌ 清空失敗', 'error');
      }
    },

    /* ========================================
       物件管理
       ======================================== */

    async toggleHideItem(itemId) {
      const index = this.hiddenItems.indexOf(itemId);
      if (index === -1) {
        this.hiddenItems.push(itemId);
        this.showNotification('👁️ 物件已隱藏', 'info');
      } else {
        this.hiddenItems.splice(index, 1);
        this.showNotification('👁️ 物件已取消隱藏', 'info');
      }
      await this.saveHiddenItems();
    },

    async saveHiddenItems() {
      try {
        await DressingCore.setData('settings', 'hiddenItems', { items: this.hiddenItems });
      } catch (error) {
        console.error('保存隱藏物件失敗:', error);
      }
    },

    async loadHiddenItems() {
      try {
        const data = await DressingCore.getData('settings', 'hiddenItems');
        if (data && data.items) {
          this.hiddenItems = data.items;
        }
      } catch (error) {
        console.log('隱藏物件資料尚未建立');
      }
    },

    async renameItem(itemId, newName) {
      const item = this.wardrobeItems.find(i => i.id === itemId);
      if (item) {
        item.displayName = newName;
        await DressingCore.saveData('items', item);
      }
    },

    async deleteItem(itemId) {
      try {
        await DressingCore.deleteData('items', itemId);
        this.wardrobeItems = this.wardrobeItems.filter(i => i.id !== itemId);
        this.cleanupOutfit();
      } catch (error) {
        console.error('刪除物件失敗:', error);
        this.showNotification('❌ 刪除失敗', 'error');
      }
    },

    /* ========================================
       畫布控制
       ======================================== */

    setCanvasZoom(zoom) {
      const maxZoom = Math.max(5, this.canvasSize.width / 400);
      this.canvasZoom = Math.max(0.1, Math.min(maxZoom, zoom));
    },

    setCanvasPan(pan) {
      this.canvasPan = { ...pan };
    },

    resetCanvasView() {
      this.canvasZoom = 1;
      this.canvasPan = { x: 0, y: 0 };
    },

    setCanvasMode(mode) {
      this.canvasMode = mode;
      if (mode === 'fixed') {
        this.freeMode.itemPositions = {};
        this.freeMode.itemScales = {};
        this.freeMode.itemFlips = {};
        this.freeMode.itemRotations = {};
      }
      this.recordHistory();
    },

    zoomIn() {
      this.setCanvasZoom(this.canvasZoom * 1.1);
    },

    zoomOut() {
      this.setCanvasZoom(this.canvasZoom * 0.9);
    },

    resetZoom() {
      this.setCanvasZoom(1);
      this.setCanvasPan({ x: 0, y: 0 });
    },

    /* ========================================
       UI 狀態管理
       ======================================== */

    setCurrentPage(page) {
      this.ui.currentPage = page;
    },

    toggleWardrobe() {
      this.ui.wardrobeCollapsed = !this.ui.wardrobeCollapsed;
    },

    toggleControls() {
      this.ui.controlsCollapsed = !this.ui.controlsCollapsed;
    },

    toggleLayerPanel() {
      this.ui.layerPanelCollapsed = !this.ui.layerPanelCollapsed;
    },

    setWardrobeCategory(category) {
      this.ui.wardrobeCategory = category;
    },

    setHighlightedItemId(itemId) {
      this.ui.highlightedItemId = itemId;
      setTimeout(() => {
        this.ui.highlightedItemId = null;
      }, 3000);
    },

    toggleSearch() {
      this.ui.showSearch = !this.ui.showSearch;
    },

    toggleSettings() {
      this.ui.showSettings = !this.ui.showSettings;
    },

    setMobileMode(isMobile) {
      this.ui.isMobile = isMobile;
    },

    setTabletMode(isTablet) {
      this.ui.isTablet = isTablet;
    },

    showNotification(message, type = 'info') {
      this.ui.notification = { message, type };
      setTimeout(() => {
        this.ui.notification = null;
      }, 3000);
    },

    /* ========================================
       工具函式
       ======================================== */

    // 內部共用方法：重新載入穿搭資料
    async _refreshOutfits() {
      const outfits = await DressingCore.getAllData('outfits');
      this.savedOutfits = outfits.map(normalizeOutfitData);
    },

    formatDate(dateString, options = {}) {
      if (!dateString) return '未知時間';
      const date = new Date(dateString);
      const defaultOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return date.toLocaleDateString('zh-TW', { ...defaultOptions, ...options });
    },

    /* ========================================
       主題管理
       ======================================== */

    async saveThemeSettings() {
      // 將 Pinia 代理物件轉成純資料，避免 IndexedDB DataCloneError
      const themeData = deepClone({
        currentTheme: this.theme.currentTheme,
        customThemes: this.theme.customThemes,
        customCSS: this.theme.customCSS,
        previewColors: this.theme.previewColors || null,
      });
      try {
        await DressingCore.setData('theme', 'settings', themeData);
        localStorage.setItem('theme-settings-cache', JSON.stringify(themeData));
      } catch (error) {
        console.error('保存主題設定失敗', error);
      }
    },

    async setCurrentTheme(themeName) {
      this.theme.currentTheme = themeName;
      this.applyTheme(themeName);
      await this.saveThemeSettings();
    },

    async addCustomTheme(theme) {
      const newTheme = {
        id: `theme-${Date.now()}`,
        name: theme.name || '未命名主題',
        colors: { ...theme.colors },
        createdAt: new Date().toISOString(),
      };
      this.theme.customThemes.push(newTheme);
      await this.saveThemeSettings();
      return newTheme;
    },

    async updateCustomTheme(themeId, updates) {
      const index = this.theme.customThemes.findIndex(t => t.id === themeId);
      if (index !== -1) {
        this.theme.customThemes[index] = {
          ...this.theme.customThemes[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        await this.saveThemeSettings();

        // 如果更新的是當前主題，重新套用
        if (this.theme.currentTheme === themeId) {
          this.applyTheme(themeId);
        }
      }
    },

    async deleteCustomTheme(themeId) {
      this.theme.customThemes = this.theme.customThemes.filter(t => t.id !== themeId);
      if (this.theme.currentTheme === themeId) {
        this.theme.currentTheme = 'default';
        this.applyTheme('default');
      }
      await this.saveThemeSettings();
    },

    applyTheme(themeName) {
      const root = document.documentElement;
      const styleElement = document.getElementById('theme-variables');
      captureInitialThemeCSS();
      const fallbackCSS = initialThemeCSS || hardcodedDefaultThemeCSS;
      const cssVars = [
        'color-primary', 'color-primary-light',
        'color-bg-main', 'color-bg-panel', 'color-bg-card', 'color-bg-canvas',
        'color-text-primary', 'color-text-secondary',
        'color-border', 'color-border-light',
        'color-success', 'color-error', 'color-warning', 'color-info'
      ];

      if (themeName === 'default') {
        // 重置為 index.html 中定義的主題
        if (styleElement && fallbackCSS) {
          styleElement.innerHTML = fallbackCSS;
        }
        cssVars.forEach(v => root.style.removeProperty(`--${v}`));
      } else {
        // 套用自定義主題
        const customTheme = this.theme.customThemes.find(t => t.id === themeName);
        if (customTheme && customTheme.colors) {
          Object.entries(customTheme.colors).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
          });
        }
      }
    },

    async setCustomCSS(css) {
      this.theme.customCSS = css;
      this.applyCustomCSS(css);
      await this.saveThemeSettings();
    },

    async savePreviewColors(colors) {
      // 儲存預覽顏色到主題設定中
      this.theme.previewColors = colors;
      await this.saveThemeSettings();
    },

    async clearPreviewColors() {
      // 清除預覽顏色
      this.theme.previewColors = null;
      await this.saveThemeSettings();
    },

    applyCustomCSS(css) {
      const styleElement = document.getElementById('custom-css');
      if (styleElement) {
        styleElement.textContent = css || '';
      }
    },

    exportThemeConfig() {
      const config = {
        type: 'theme-config',
        currentTheme: this.theme.currentTheme,
        customThemes: this.theme.customThemes,
        customCSS: this.theme.customCSS,
        exportedAt: new Date().toISOString(),
      };
      return config;
    },

    async importThemeConfig(config) {
      if (config.type !== 'theme-config') {
        throw new Error('無效的主題設定檔');
      }

      if (config.customThemes) {
        config.customThemes.forEach(newTheme => {
          const exists = this.theme.customThemes.find(t => t.name === newTheme.name);
          if (!exists) {
            this.theme.customThemes.push({
              ...newTheme,
              id: `theme-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            });
          }
        });
      }

      if (config.customCSS !== undefined) {
        this.theme.customCSS = config.customCSS;
        this.applyCustomCSS(config.customCSS);
      }

      await this.saveThemeSettings();
    },

    /* ========================================
       附贈圖包管理
       ======================================== */

    async loadDismissedBundledPacks() {
      try {
        const data = await DressingCore.getData('settings', 'dismissedBundledPacks');
        this.dismissedBundledPacks = data?.packIds || [];
      } catch (error) {
        console.log('尚無已刪除附贈圖包記錄');
        this.dismissedBundledPacks = [];
      }
    },

    async saveDismissedBundledPacks() {
      try {
        await DressingCore.saveData('settings', {
          id: 'dismissedBundledPacks',
          packIds: this.dismissedBundledPacks
        });
      } catch (error) {
        console.error('儲存已刪除附贈圖包記錄失敗', error);
      }
    },

    async dismissBundledPack(packId) {
      if (!this.dismissedBundledPacks.includes(packId)) {
        this.dismissedBundledPacks.push(packId);
        await this.saveDismissedBundledPacks();
      }
    },

    async restoreBundledPack(packId) {
      this.dismissedBundledPacks = this.dismissedBundledPacks.filter(id => id !== packId);
      await this.saveDismissedBundledPacks();
    },

    isBundledPackDismissed(packId) {
      return this.dismissedBundledPacks.includes(packId);
    },

    async getAvailableBundledPacks() {
      try {
        // 動態導入 manifest
        const manifestModule = await import('../assets/bundled-packs/manifest.json');
        const manifest = manifestModule.default || manifestModule;
        
        // 過濾掉已刪除和已匯入的圖包
        const availablePacks = manifest.packs.filter(pack => {
          const isDismissed = this.dismissedBundledPacks.includes(pack.id);
          const isImported = this.availablePacks.some(p => p.id === pack.id);
          return !isDismissed && !isImported;
        });

        return availablePacks;
      } catch (error) {
        console.error('載入附贈圖包清單失敗', error);
        return [];
      }
    },

    async loadBundledPack(packInfo) {
      try {
        // 動態載入附贈圖包的 ZIP 文件
        const packUrl = new URL(`../assets/bundled-packs/${packInfo.filename}`, import.meta.url).href;
        const response = await fetch(packUrl);
        if (!response.ok) {
          throw new Error(`無法載入附贈圖包: ${packInfo.filename}`);
        }
        const blob = await response.blob();
        const file = new File([blob], packInfo.filename, { type: 'application/zip' });
        
        return file;
      } catch (error) {
        console.error('載入附贈圖包失敗', error);
        throw error;
      }
    },
  }
})