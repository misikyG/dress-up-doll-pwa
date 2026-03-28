// store/index.js - 紙娃娃遊戲核心狀態管理
import { defineStore } from 'pinia'
import DressingCore from '../core/index.js'
import { icons } from '../icons.js'

// 工具函式
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
const generateId = () => crypto?.randomUUID?.() || `outfit-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// 常數與映射
const slotNameMap = { accessory: 'accessories', carry: 'carries', underwear: 'underwears', other: 'others' };
const getSlotName = (category) => slotNameMap[category] || category;

const categoryOrder = [
  'filter', 'background', 'character', 'expression', 'hair', 'underwear',
  'top', 'bottom', 'outer', 'dress', 'shoes', 'accessory', 'carry', 'other'
];

const defaultZIndexMap = {
  filter: -10, background: 0, character: 100, expression: 150, hair: 200,
  underwear: 180, top: 300, bottom: 250, outer: 500, dress: 275, shoes: 50,
  accessory: 600, carry: 650, other: 700
};

const singleSlotCategories = new Set(['filter', 'background', 'character', 'expression']);

// 主題 CSS 預設值
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
  if (el) initialThemeCSS = el.innerHTML;
};

// 穿搭資料結構
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
    normalized[key] = Array.isArray(value) ? deepClone(value) : [deepClone(value)];
  });
  return normalized;
};

// 圖層構建
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
        id: layerId, item, category,
        zIndex: customOrder?.zIndex ?? (defaultZIndexMap[category] + index),
        isCustomOrder: Boolean(customOrder),
        hidden: hiddenSet.has(layerId)
      });
    });
  });
  return layers.sort((a, b) => a.zIndex - b.zIndex);
};

// Store 定義
export const useGameStore = defineStore('game', {
  state: () => ({
    isInitialized: false,
    wardrobeItems: [],
    savedOutfits: [],
    availablePacks: [],
    hiddenItems: [],
    hiddenLayerIds: [],
    canvasSize: { width: 2000, height: 3800 },
    backgroundSize: { width: 2000, height: 3800 },
    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },
    currentOutfit: createEmptyOutfit(),
    selectedCharacterId: null,
    selectedItem: null,
    layerOrder: [],
    canvasMode: 'fixed',
    freeMode: {
      itemPositions: {},
      itemScales: {},
      itemFlips: {},
      itemRotations: {},
      enableFreeScale: true,
      enableFreeRotation: false,
    },
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
      return (state.currentOutfit[slot] || []).some(i => i.id === item.id);
    },

    currentLayers: (state) => buildLayers(state.currentOutfit, state.layerOrder, new Set(state.hiddenLayerIds)),
    canUndo: (state) => state.historyIndex > 0,
    canRedo: (state) => state.historyIndex < state.history.length - 1,

    getCategoryName: (state) => (category) => state.categories.find(c => c.key === category)?.name || category,
    getPackName: (state) => (item) => {
      if (!item?.packId) return '未知圖包';
      const pack = state.availablePacks.find(p => p.id === item.packId);
      return pack?.displayName || pack?.name || '未知圖包';
    },
  },

  actions: {
    // 初始化
    async initializeApp() {
      this.ui.loading = true;
      try {
        await DressingCore.init();
        const [items, outfits, packs] = await Promise.all([
          DressingCore.getAllData('items'),
          DressingCore.getAllData('outfits'),
          DressingCore.getAllData('packs'),
        ]);

        let themeData = await DressingCore.getData('theme', 'settings').catch(() => null);
        if (!themeData) {
          try {
            const cached = localStorage.getItem('theme-settings-cache');
            if (cached) themeData = JSON.parse(cached);
          } catch {}
        }

        this.wardrobeItems = items;
        this.savedOutfits = outfits.map(o => ({
          ...o,
          outfit: normalizeOutfit(o.outfit),
          layerOrder: deepClone(o.layerOrder || [])
        }));
        this.availablePacks = packs;

        if (themeData) {
          this.theme.currentTheme = themeData.currentTheme || 'default';
          this.theme.customThemes = Array.isArray(themeData.customThemes) ? themeData.customThemes : [];
          this.theme.customCSS = themeData.customCSS || '';
          this.theme.previewColors = themeData.previewColors || null;

          if (this.theme.previewColors && Object.keys(this.theme.previewColors).length > 0) {
            Object.entries(this.theme.previewColors).forEach(([key, value]) => {
              document.documentElement.style.setProperty(`--${key}`, value);
            });
          } else {
            this.applyTheme(this.theme.currentTheme);
          }
          this.applyCustomCSS(this.theme.customCSS);
        }

        await Promise.all([
          this.loadHiddenItems(),
          this.loadAppState(),
          this.loadDismissedBundledPacks()
        ]);

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
      } catch {}
    },

    async loadAppState() {
      try {
        const s = await DressingCore.getData('settings', 'appState');
        if (s) {
          if (s.currentOutfit) this.currentOutfit = normalizeOutfit(s.currentOutfit);
          if (s.selectedCharacterId) this.selectedCharacterId = s.selectedCharacterId;
          if (s.layerOrder) this.layerOrder = s.layerOrder;
          if (s.canvasMode) this.canvasMode = s.canvasMode;
          if (s.freeMode) this.freeMode = { ...this.freeMode, ...s.freeMode };
          if (s.canvasZoom) this.canvasZoom = s.canvasZoom;
          if (s.canvasPan) this.canvasPan = s.canvasPan;
          if (s.currentPage) this.ui.currentPage = s.currentPage;
          if (typeof s.wardrobeCollapsed === 'boolean') this.ui.wardrobeCollapsed = s.wardrobeCollapsed;
          if (typeof s.layerPanelCollapsed === 'boolean') this.ui.layerPanelCollapsed = s.layerPanelCollapsed;
          if (Array.isArray(s.hiddenLayerIds)) this.hiddenLayerIds = s.hiddenLayerIds;
        } else {
          this.currentOutfit = createEmptyOutfit();
        }
      } catch {
        this.currentOutfit = createEmptyOutfit();
      }
    },

    debouncedSaveAppState() {
      if (this._saveAppStateTimer) clearTimeout(this._saveAppStateTimer);
      this._saveAppStateTimer = setTimeout(() => this.saveAppState(), 1000);
    },

    // 核心換裝操作
    wearItem(item, variantKey = null) {
      if (!item) return;
      const slot = getSlotName(item.category);
      const currentItems = this.currentOutfit[slot] || [];

      let itemToWear = deepClone(item);
      if (variantKey && item.variants && item.variantImages?.[variantKey]) {
        itemToWear.currentVariant = variantKey;
        itemToWear.imageData = item.variantImages[variantKey];
      }

      if (currentItems.some(i => i.id === item.id)) return;

      this.currentOutfit[slot] = singleSlotCategories.has(item.category) 
        ? [itemToWear] 
        : [...currentItems, itemToWear];

      if (item.category === 'character') {
        this.selectedCharacterId = item.id;
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
      if (layer?.category === 'character') this.selectedCharacterId = layer.item.id;
    },

    clearSelection() { this.selectedItem = null; },

    clearCurrentOutfit() {
      Object.keys(this.currentOutfit).forEach(key => this.currentOutfit[key] = []);
      this.selectedCharacterId = null;
      this.selectedItem = null;
      this.layerOrder = [];
      Object.assign(this.freeMode, { itemPositions: {}, itemScales: {}, itemFlips: {}, itemRotations: {} });
      this.hiddenLayerIds = [];
      if (!this.isRestoring) {
        this.recordHistory();
        this.showNotification('🗑️ 已清空穿搭', 'info');
      }
    },

    // 圖層管理
    moveLayerUp(layerId) {
      const layers = this.currentLayers;
      const idx = layers.findIndex(l => l.id === layerId);
      if (idx < layers.length - 1) {
        this.updateCustomLayerOrder(layerId, layers[idx + 1].zIndex + 1);
        this.recordHistory();
      }
    },

    moveLayerDown(layerId) {
      const layers = this.currentLayers;
      const idx = layers.findIndex(l => l.id === layerId);
      if (idx > 0) {
        this.updateCustomLayerOrder(layerId, layers[idx - 1].zIndex - 1);
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
      this.layerOrder = newOrder.map((layer, i) => ({ id: layer.id, zIndex: i * 10 }));
      this.recordHistory();
    },

    isLayerHidden(layerId) { return this.hiddenLayerIds.includes(layerId); },

    toggleLayerHidden(layerId) {
      const idx = this.hiddenLayerIds.indexOf(layerId);
      idx === -1 ? this.hiddenLayerIds.push(layerId) : this.hiddenLayerIds.splice(idx, 1);
      this.recordHistory();
    },

    resetLayerOrder() {
      this.layerOrder = [];
      this.recordHistory();
    },

    // 自由模式變換
    setItemPosition(itemId, position) { this.freeMode.itemPositions[itemId] = { ...position }; },
    setItemScale(itemId, scale) { this.freeMode.itemScales[itemId] = scale; },
    setItemFlip(itemId, flip) { this.freeMode.itemFlips[itemId] = { ...flip }; },
    setItemRotation(itemId, rotation) { this.freeMode.itemRotations[itemId] = rotation; },

    resetItemTransforms() {
      Object.assign(this.freeMode, { itemPositions: {}, itemScales: {}, itemFlips: {}, itemRotations: {} });
      this.selectedItem = null;
      this.recordHistory();
      this.showNotification('🔄 已重置所有變換', 'info');
    },

    // 歷史記錄 (Undo/Redo)
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

      if (this.history.length > 50) this.history = this.history.slice(-50);
      this.historyIndex = this.history.length - 1;
      this.debouncedSaveAppState();
    },

    clearHistory() { this.history = []; this.historyIndex = -1; },
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreFromHistory(); } },
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreFromHistory(); } },

    restoreFromHistory() {
      if (this.historyIndex < 0 || this.historyIndex >= this.history.length) return;
      this.isRestoring = true;
      const s = this.history[this.historyIndex];
      this.currentOutfit = deepClone(s.outfit);
      this.selectedCharacterId = s.selectedCharacterId;
      this.freeMode = deepClone(s.freeMode);
      this.layerOrder = deepClone(s.layerOrder || []);
      this.canvasMode = s.canvasMode || this.canvasMode;
      this.hiddenLayerIds = deepClone(s.hiddenLayerIds || []);
      this.isRestoring = false;
    },

    // 穿搭儲存管理
    async saveCurrentOutfit(name, previewImage = null) {
      const trimmedName = name?.trim();
      if (!trimmedName) { this.showNotification('❌ 請輸入穿搭名稱', 'error'); return; }

      const existing = this.savedOutfits.find(o => o.name === trimmedName);
      if (existing && !confirm('是否要將舊搭配覆蓋？')) {
        this.showNotification('ℹ️ 已取消覆蓋', 'info');
        return;
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
        previewImage,
        createdAt: existing?.createdAt || new Date().toISOString()
      };

      try {
        await DressingCore.saveData('outfits', outfitData);
        await this._reloadOutfits();
        this.showNotification(`💾 穿搭「${trimmedName}」已保存`, 'success');
      } catch (e) {
        this.showNotification('❌ 保存失敗', 'error');
      }
    },

    async _reloadOutfits() {
      const outfits = await DressingCore.getAllData('outfits');
      this.savedOutfits = outfits.map(o => ({
        ...o, outfit: normalizeOutfit(o.outfit), layerOrder: deepClone(o.layerOrder || [])
      }));
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
        await this._reloadOutfits();
      } catch {
        this.showNotification('❌ 匯入穿搭失敗', 'error');
      }
    },

    async deleteOutfit(outfitId) {
      try {
        await DressingCore.deleteData('outfits', outfitId);
        await this._reloadOutfits();
        this.showNotification('🗑️ 穿搭已刪除', 'info');
      } catch {
        this.showNotification('❌ 刪除失敗', 'error');
      }
    },

    async renameOutfit(outfitId, newName) {
      if (!outfitId || !newName) {
        this.showNotification('❌ 重新命名失敗：缺少必要參數', 'error');
        return false;
      }
      try {
        const original = await DressingCore.getData('outfits', outfitId);
        if (!original) {
          this.showNotification('❌ 找不到該穿搭', 'error');
          return false;
        }
        await DressingCore.saveData('outfits', { ...original, name: newName });
        await this._reloadOutfits();
        this.showNotification('✏️ 穿搭已重新命名', 'success');
        return true;
      } catch {
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

    // 圖包管理
    async addNewItem(itemData) {
      await DressingCore.saveData('items', itemData);
      this.wardrobeItems = await DressingCore.getAllData('items');
      return itemData;
    },

    async addPack(packData) {
      await DressingCore.saveData('packs', packData);
      this.availablePacks = await DressingCore.getAllData('packs');
      return packData;
    },

    async deletePack(packId) {
      try {
        const pack = this.availablePacks.find(p => p.id === packId);
        const items = this.wardrobeItems.filter(i => i.packId === packId);
        for (const item of items) await DressingCore.deleteData('items', item.id);
        await DressingCore.deleteData('packs', packId);
        this.wardrobeItems = this.wardrobeItems.filter(i => i.packId !== packId);
        this.availablePacks = this.availablePacks.filter(p => p.id !== packId);
        if (pack?.isBundled) await this.dismissBundledPack(packId);
        this.cleanupOutfit();
        this.showNotification('🗑️ 圖包已刪除', 'info');
      } catch {
        this.showNotification('❌ 刪除失敗', 'error');
      }
    },

    cleanupOutfit() {
      const validIds = new Set(this.wardrobeItems.map(i => i.id));
      Object.keys(this.currentOutfit).forEach(key => {
        this.currentOutfit[key] = (this.currentOutfit[key] || []).filter(i => validIds.has(i.id));
      });
      this.hiddenLayerIds = this.hiddenLayerIds.filter(id => validIds.has(id.split('-')[0]));
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
        // 同步清除 IDB 中的隱藏物件記錄
        await this.saveHiddenItems();
        this.showNotification('🗑️ 所有資料已清空', 'info');
      } catch {
        this.showNotification('❌ 清空失敗', 'error');
      }
    },

    // 物件管理
    async toggleHideItem(itemId) {
      const idx = this.hiddenItems.indexOf(itemId);
      idx === -1 ? this.hiddenItems.push(itemId) : this.hiddenItems.splice(idx, 1);
      this.showNotification(idx === -1 ? '👁️ 物件已隱藏' : '👁️ 物件已取消隱藏', 'info');
      await this.saveHiddenItems();
    },

    async saveHiddenItems() {
      try {
        await DressingCore.setData('settings', 'hiddenItems', { items: this.hiddenItems });
      } catch {}
    },

    async loadHiddenItems() {
      try {
        const data = await DressingCore.getData('settings', 'hiddenItems');
        if (data?.items) this.hiddenItems = data.items;
      } catch {}
    },

    async renameItem(itemId, newName) {
      const item = this.wardrobeItems.find(i => i.id === itemId);
      if (!item) return;
      item.displayName = newName;
      await DressingCore.saveData('items', item);
    },

    async deleteItem(itemId) {
      try {
        await DressingCore.deleteData('items', itemId);
        this.wardrobeItems = this.wardrobeItems.filter(i => i.id !== itemId);
        this.cleanupOutfit();
      } catch {
        this.showNotification('❌ 刪除失敗', 'error');
      }
    },

    // 畫布控制
    setCanvasZoom(zoom) {
      const maxZoom = Math.max(5, this.canvasSize.width / 400);
      this.canvasZoom = Math.max(0.1, Math.min(maxZoom, zoom));
    },
    setCanvasPan(pan) { this.canvasPan = { ...pan }; },
    resetCanvasView() { this.canvasZoom = 1; this.canvasPan = { x: 0, y: 0 }; },
    zoomIn() { this.setCanvasZoom(this.canvasZoom * 1.1); },
    zoomOut() { this.setCanvasZoom(this.canvasZoom * 0.9); },
    resetZoom() { this.setCanvasZoom(1); this.setCanvasPan({ x: 0, y: 0 }); },

    setCanvasMode(mode) {
      this.canvasMode = mode;
      if (mode === 'fixed') {
        Object.assign(this.freeMode, {
          itemPositions: {}, itemScales: {}, itemFlips: {}, itemRotations: {}
        });
      }
      this.recordHistory();
    },

    // UI 狀態管理
    setCurrentPage(page) { this.ui.currentPage = page; },
    toggleWardrobe() { this.ui.wardrobeCollapsed = !this.ui.wardrobeCollapsed; },
    toggleControls() { this.ui.controlsCollapsed = !this.ui.controlsCollapsed; },
    toggleLayerPanel() { this.ui.layerPanelCollapsed = !this.ui.layerPanelCollapsed; },
    setWardrobeCategory(category) { this.ui.wardrobeCategory = category; },
    toggleSearch() { this.ui.showSearch = !this.ui.showSearch; },
    toggleSettings() { this.ui.showSettings = !this.ui.showSettings; },
    setMobileMode(isMobile) { this.ui.isMobile = isMobile; },
    setTabletMode(isTablet) { this.ui.isTablet = isTablet; },

    setHighlightedItemId(itemId) {
      this.ui.highlightedItemId = itemId;
      setTimeout(() => this.ui.highlightedItemId = null, 3000);
    },

    showNotification(message, type = 'info') {
      this.ui.notification = { message, type };
      setTimeout(() => this.ui.notification = null, 3000);
    },

    // 工具函式
    formatDate(dateString, options = {}) {
      if (!dateString) return '未知時間';
      return new Date(dateString).toLocaleDateString('zh-TW', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', ...options
      });
    },

    // 主題管理

    async saveThemeSettings() {
      const themeData = deepClone({
        currentTheme: this.theme.currentTheme,
        customThemes: this.theme.customThemes,
        customCSS: this.theme.customCSS,
        previewColors: this.theme.previewColors || null,
      });
      try {
        await DressingCore.setData('theme', 'settings', themeData);
        localStorage.setItem('theme-settings-cache', JSON.stringify(themeData));
      } catch {}
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
      const idx = this.theme.customThemes.findIndex(t => t.id === themeId);
      if (idx === -1) return;
      this.theme.customThemes[idx] = {
        ...this.theme.customThemes[idx], ...updates,
        updatedAt: new Date().toISOString(),
      };
      await this.saveThemeSettings();
      if (this.theme.currentTheme === themeId) this.applyTheme(themeId);
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
      const cssVars = [
        'color-primary', 'color-primary-light',
        'color-bg-main', 'color-bg-panel', 'color-bg-card', 'color-bg-canvas',
        'color-text-primary', 'color-text-secondary',
        'color-border', 'color-border-light',
        'color-success', 'color-error', 'color-warning', 'color-info'
      ];

      if (themeName === 'default') {
        const fallback = initialThemeCSS || hardcodedDefaultThemeCSS;
        if (styleElement && fallback) styleElement.innerHTML = fallback;
        cssVars.forEach(v => root.style.removeProperty(`--${v}`));
      } else {
        const custom = this.theme.customThemes.find(t => t.id === themeName);
        if (custom?.colors) {
          Object.entries(custom.colors).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
        }
      }
    },

    async setCustomCSS(css) {
      this.theme.customCSS = css;
      this.applyCustomCSS(css);
      await this.saveThemeSettings();
    },

    async savePreviewColors(colors) {
      this.theme.previewColors = colors;
      await this.saveThemeSettings();
    },

    async clearPreviewColors() {
      this.theme.previewColors = null;
      await this.saveThemeSettings();
    },

    applyCustomCSS(css) {
      const el = document.getElementById('custom-css');
      if (el) el.textContent = css || '';
    },

    exportThemeConfig() {
      return {
        type: 'theme-config',
        currentTheme: this.theme.currentTheme,
        customThemes: this.theme.customThemes,
        customCSS: this.theme.customCSS,
        exportedAt: new Date().toISOString(),
      };
    },

    async importThemeConfig(config) {
      if (config.type !== 'theme-config') throw new Error('無效的主題設定檔');
      config.customThemes?.forEach(newTheme => {
        if (!this.theme.customThemes.find(t => t.name === newTheme.name)) {
          this.theme.customThemes.push({
            ...newTheme,
            id: `theme-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          });
        }
      });
      if (config.customCSS !== undefined) {
        this.theme.customCSS = config.customCSS;
        this.applyCustomCSS(config.customCSS);
      }
      await this.saveThemeSettings();
    },

    /**
     * 從備份資料完整還原主題設定（覆蓋現有）。
     */
    async restoreThemeFromBackup(themeData) {
      if (!themeData) return;
      this.theme.currentTheme = themeData.currentTheme || 'default';
      this.theme.customThemes = Array.isArray(themeData.customThemes) ? themeData.customThemes : [];
      this.theme.customCSS = themeData.customCSS || '';
      this.theme.previewColors = null;
      this.applyTheme(this.theme.currentTheme);
      this.applyCustomCSS(this.theme.customCSS);
      await this.saveThemeSettings();
    },

    // 附贈圖包管理
    async loadDismissedBundledPacks() {
      try {
        const data = await DressingCore.getData('settings', 'dismissedBundledPacks');
        this.dismissedBundledPacks = data?.packIds || [];
      } catch {
        this.dismissedBundledPacks = [];
      }
    },

    async saveDismissedBundledPacks() {
      try {
        await DressingCore.saveData('settings', {
          id: 'dismissedBundledPacks',
          packIds: this.dismissedBundledPacks
        });
      } catch {}
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
        const manifestModule = await import('../assets/bundled-packs/manifest.json');
        const manifest = manifestModule.default || manifestModule;
        return manifest.packs.filter(pack =>
          !this.dismissedBundledPacks.includes(pack.id) &&
          !this.availablePacks.some(p => p.id === pack.id)
        );
      } catch {
        return [];
      }
    },

    async loadBundledPack(packInfo) {
      const packUrl = new URL(`../assets/bundled-packs/${packInfo.filename}`, import.meta.url).href;
      const response = await fetch(packUrl);
      if (!response.ok) throw new Error(`無法載入附贈圖包: ${packInfo.filename}`);
      const blob = await response.blob();
      return new File([blob], packInfo.filename, { type: 'application/zip' });
    },
  }
})