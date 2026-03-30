import { defineStore } from 'pinia'
import DressingCore from '../core/index.js'
import { icons } from '../icons.js'

const cloneState = (obj) => JSON.parse(JSON.stringify(obj));
const generateId = () => crypto?.randomUUID?.() || `outfit-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const generateThumbnail = (dataUrl, maxDimension = 300) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const detectMax = 400;
      const detectScale = Math.min(detectMax / img.width, detectMax / img.height, 1);
      const dw = Math.max(1, Math.round(img.width * detectScale));
      const dh = Math.max(1, Math.round(img.height * detectScale));

      const detectCanvas = document.createElement('canvas');
      detectCanvas.width = dw;
      detectCanvas.height = dh;
      const dCtx = detectCanvas.getContext('2d', { willReadFrequently: true });
      dCtx.drawImage(img, 0, 0, dw, dh);

      let minX = dw, minY = dh, maxX = 0, maxY = 0;
      let hasContent = false;
      try {
        const id = dCtx.getImageData(0, 0, dw, dh);
        const px = id.data;
        for (let y = 0; y < dh; y++) {
          for (let x = 0; x < dw; x++) {
            if (px[(y * dw + x) * 4 + 3] > 10) {
              hasContent = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
      } catch { hasContent = false; }
      detectCanvas.width = 0; detectCanvas.height = 0;

      let srcX, srcY, srcW, srcH;
      if (hasContent && maxX >= minX && maxY >= minY) {
        const ox = minX / detectScale;
        const oy = minY / detectScale;
        const ow = (maxX - minX + 1) / detectScale;
        const oh = (maxY - minY + 1) / detectScale;
        const pad = Math.max(ow, oh) * 0.06;
        srcX = Math.max(0, Math.floor(ox - pad));
        srcY = Math.max(0, Math.floor(oy - pad));
        srcW = Math.min(img.width - srcX, Math.ceil(ow + pad * 2));
        srcH = Math.min(img.height - srcY, Math.ceil(oh + pad * 2));
      } else {
        srcX = 0; srcY = 0; srcW = img.width; srcH = img.height;
      }

      const scale = Math.min(maxDimension / srcW, maxDimension / srcH, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(srcW * scale));
      canvas.height = Math.max(1, Math.round(srcH * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

      let result;
      try {
        result = canvas.toDataURL('image/webp', 0.85);
        if (!result.startsWith('data:image/webp')) result = canvas.toDataURL('image/png');
      } catch { result = canvas.toDataURL('image/png'); }
      canvas.width = 0; canvas.height = 0;
      resolve(result);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
};

const imageCache = new Map();
const MAX_IMAGE_CACHE = 15;

// 快取內容邊界 (normalized 0-1)：用於自由模式的變換框定位
const contentBoundsCache = new Map();

/**
 * 計算圖片中非透明像素的最小外接矩形 (normalized 0-1)
 * 回傳 { x, y, w, h } 相對於原圖尺寸的比例
 * 使用 img.decode() 確保 iOS Safari 完全解碼後再 getImageData
 */
const computeContentBounds = async (dataUrl) => {
  const fallback = { x: 0, y: 0, w: 1, h: 1 };
  try {
    const img = new Image();
    img.src = dataUrl;
    // decode() 確保圖片完全解碼，解決 iOS Safari getImageData 讀到空白的問題
    await img.decode();

    const maxDim = 400;
    const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
    const dw = Math.max(1, Math.round(img.width * scale));
    const dh = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, dw, dh);

    let minX = dw, minY = dh, maxX = 0, maxY = 0;
    let found = false;
    const id = ctx.getImageData(0, 0, dw, dh);
    const px = id.data;
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        if (px[(y * dw + x) * 4 + 3] > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    c.width = 0; c.height = 0;

    if (found && maxX >= minX && maxY >= minY) {
      // 加 25% padding，讓操作框比內容稍大、手指容易操作
      const pad = Math.max((maxX - minX), (maxY - minY)) * 0.25;
      const x1 = Math.max(0, minX - pad);
      const y1 = Math.max(0, minY - pad);
      const x2 = Math.min(dw, maxX + 1 + pad);
      const y2 = Math.min(dh, maxY + 1 + pad);
      return { x: x1 / dw, y: y1 / dh, w: (x2 - x1) / dw, h: (y2 - y1) / dh };
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const resolveImageData = async (itemId, variantKey) => {
  const key = variantKey ? `${itemId}:${variantKey}` : itemId;
  if (imageCache.has(key)) return imageCache.get(key);
  try {
    const fullItem = await DressingCore.getData('items', itemId);
    if (!fullItem) return null;
    const data = variantKey && fullItem.variantImages?.[variantKey]
      ? fullItem.variantImages[variantKey] : fullItem.imageData;
    imageCache.set(key, data);
    if (imageCache.size > MAX_IMAGE_CACHE) imageCache.delete(imageCache.keys().next().value);
    return data;
  } catch { return null; }
};

const createOutfitSnapshot = (outfit) => {
  const snapshot = {};
  for (const [slot, items] of Object.entries(outfit)) {
    if (!items || !Array.isArray(items)) { snapshot[slot] = []; continue; }
    snapshot[slot] = items.map(({ imageData, variantImages, ...rest }) => ({ ...rest }));
  }
  return snapshot;
};

const resolveOutfitImages = async (outfit) => {
  const resolved = {};
  for (const [slot, items] of Object.entries(outfit)) {
    if (!items) { resolved[slot] = []; continue; }
    const arr = Array.isArray(items) ? items : [items];
    resolved[slot] = [];
    for (const item of arr) {
      if (!item?.id) continue;
      if (item.imageData) {
        // 確保也有 thumbnailData
        if (!item.thumbnailData) {
          try {
            const full = await DressingCore.getData('items', item.id);
            if (full?.thumbnailData) item.thumbnailData = full.thumbnailData;
          } catch {}
        }
        resolved[slot].push({ ...item });
        continue;
      }
      try {
        const full = await DressingCore.getData('items', item.id);
        if (!full) continue;
        const imgData = item.currentVariant && full.variantImages?.[item.currentVariant]
          ? full.variantImages[item.currentVariant] : full.imageData;
        if (imgData) {
          resolved[slot].push({
            ...item,
            imageData: imgData,
            thumbnailData: item.thumbnailData || full.thumbnailData || null,
          });
        }
      } catch { /* 單項解析失敗不影響其他項目 */ }
    }
  }
  return resolved;
};

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

const hardcodedDefaultThemeCSS = `
:root {
  --color-primary: #618b6a;
  --color-bg-main: #f8f5ea;
  --color-bg-panel: #f1f7e5;
  --color-bg-card: #ffffff;
  --color-bg-canvas: #f0f2f5;
  --color-text-primary: #472d25;
  --color-text-secondary: #666666;
  --color-border: #c0b7a3;
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

export const presetThemes = [
  {
    id: 'preset-crimson',
    name: '輕粉',
    colors: {
      'color-primary': '#c65c5c',
      'color-bg-main': '#efefe7',
      'color-bg-panel': '#f2dada',
      'color-bg-card': '#fffcfa',
      'color-bg-canvas': '#f2edea',
      'color-text-primary': '#707454',
      'color-text-secondary': '#a49090',
      'color-border': '#c48a76',
      'color-success': '#3d8b7a',
      'color-error': '#b83a32',
      'color-warning': '#d4a03c',
      'color-info': '#4a8b9b',
    }
  },
  {
    id: 'preset-amber',
    name: '琥珀',
    colors: {
      'color-primary': '#d2833a',
      'color-bg-main': '#fdf8f0',
      'color-bg-panel': '#fbf3e4',
      'color-bg-card': '#fffdf8',
      'color-bg-canvas': '#f5f0e8',
      'color-text-primary': '#867360',
      'color-text-secondary': '#a89ab3',
      'color-border': '#c69986',
      'color-success': '#7a9b5b',
      'color-error': '#b8453a',
      'color-warning': '#e6b830',
      'color-info': '#4a6fa5',
    }
  }
];

let initialThemeCSS = '';
const captureInitialThemeCSS = () => {
  if (initialThemeCSS || typeof document === 'undefined') return;
  const el = document.getElementById('theme-variables');
  if (el) initialThemeCSS = el.innerHTML;
};

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
    const arr = Array.isArray(value) ? value : [value];
    normalized[key] = arr.map(item => ({ ...item }));
  });
  return normalized;
};

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
    _baseCanvasScale: 1,
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
      highlightedItemId: null,
    },

    categories: [
      { key: 'starred', name: '已儲存搭配', svg: icons.starred },
      { key: 'filter', name: '濾鏡', svg: icons.filterLayer },
      { key: 'background', name: '背景', svg: icons.background },
      { key: 'character', name: '人物', svg: icons.character },
      { key: 'expression', name: '表情', svg: icons.expression },
      { key: 'hair', name: '髮型', svg: icons.hair },
      { key: 'underwear', name: '內衣', svg: icons.underwear },
      { key: 'top', name: '上衣', svg: icons.top },
      { key: 'bottom', name: '下身', svg: icons.bottom },
      { key: 'outer', name: '外套', svg: icons.outer },
      { key: 'dress', name: '套裝', svg: icons.dress },
      { key: 'shoes', name: '鞋子', svg: icons.shoes },
      { key: 'accessory', name: '配飾', svg: icons.accessory },
      { key: 'carry', name: '攜帶品', svg: icons.carry },
      { key: 'other', name: '其他', svg: icons.other }
    ],

    categoryTags: {},

    theme: {
      currentTheme: 'default',
      customThemes: [],
      customCSS: '',
      fontFamily: '',
      fontSize: 16,
    },

    dismissedBundledPacks: [],
  }),

  getters: {
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

    _hiddenSet: (state) => new Set(state.hiddenLayerIds),
    currentLayers() {
      return buildLayers(this.currentOutfit, this.layerOrder, this._hiddenSet);
    },
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
    async initializeApp() {
      this.ui.loading = true;
      try {
        await DressingCore.init();

        let items;
        try {
          items = await DressingCore.getAllItemsLightweight();
        } catch {
          const fullItems = await DressingCore.getAllData('items');
          items = fullItems.map(({ imageData, variantImages, ...rest }) => rest);
        }

        // 縮圖生成 (v2)
        const thumbVersionData = await DressingCore.getData('settings', 'thumbnailVersion').catch(() => null);
        const currentThumbVersion = thumbVersionData?.version || 0;
        const needsThumbnail = items.some(i => !i.thumbnailData) || currentThumbVersion < 2;
        if (needsThumbnail) {
          const ids = await DressingCore.getAllKeys('items');
          for (const id of ids) {
            const fullItem = await DressingCore.getData('items', id);
            if (fullItem?.imageData) {
              const needsRegen = !fullItem.thumbnailData ||
                fullItem.thumbnailData.startsWith('data:image/jpeg') ||
                currentThumbVersion < 2;
              if (needsRegen) {
                fullItem.thumbnailData = await generateThumbnail(fullItem.imageData);
                await DressingCore.saveData('items', fullItem);
                const memItem = items.find(i => i.id === id);
                if (memItem) memItem.thumbnailData = fullItem.thumbnailData;
                await new Promise(r => setTimeout(r, 50));
              }
            }
          }
          await DressingCore.setData('settings', 'thumbnailVersion', { version: 2 });
        }

        const [outfits, packs] = await Promise.all([
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
          id: o.id,
          name: o.name,
          previewImage: o.previewImage,
          createdAt: o.createdAt,
          layerOrder: o.layerOrder || [],
        }));
        this.availablePacks = packs;

        if (themeData) {
          this.theme.currentTheme = themeData.currentTheme || 'default';
          this.theme.customThemes = Array.isArray(themeData.customThemes) ? themeData.customThemes : [];
          this.theme.customCSS = themeData.customCSS || '';
          this.theme.previewColors = themeData.previewColors || null;
          this.theme.fontFamily = themeData.fontFamily || '';
          this.theme.fontSize = themeData.fontSize || 16;

          if (this.theme.previewColors && Object.keys(this.theme.previewColors).length > 0) {
            Object.entries(this.theme.previewColors).forEach(([key, value]) => {
              document.documentElement.style.setProperty(`--${key}`, value);
            });
          } else {
            this.applyTheme(this.theme.currentTheme);
          }
          this.applyFontSettings();
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

        const flushSave = () => {
          if (this._saveAppStateTimer) {
            clearTimeout(this._saveAppStateTimer);
            this._saveAppStateTimer = null;
          }
          this.saveAppState();
        };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') flushSave();
        });
        window.addEventListener('pagehide', flushSave);
        window.addEventListener('beforeunload', flushSave);

        this.showNotification('系統準備就緒', 'success');
      } catch (error) {
        console.error("初始化失敗", error);
        this.showNotification(`系統初始化失敗: ${error}`, 'error');
      } finally {
        this.ui.loading = false;
      }
    },

    async saveAppState() {
      try {
        const outfitSnapshot = createOutfitSnapshot(this.currentOutfit);
        const appState = {
          currentOutfit: outfitSnapshot,
          selectedCharacterId: this.selectedCharacterId,
          layerOrder: cloneState(this.layerOrder),
          canvasMode: this.canvasMode,
          freeMode: cloneState(this.freeMode),
          canvasZoom: this.canvasZoom,
          canvasPan: { ...this.canvasPan },
          currentPage: this.ui.currentPage,
          wardrobeCollapsed: this.ui.wardrobeCollapsed,
          layerPanelCollapsed: this.ui.layerPanelCollapsed,
          hiddenLayerIds: [...this.hiddenLayerIds],
          _savedAt: Date.now(),
        };
        // 同步寫入 localStorage（F5/關閉時 IndexedDB 可能來不及完成）
        // 去掉 thumbnailData 以減小體積，避免超過 localStorage 5MB 限制
        try {
          const lsState = { ...appState };
          const lsOutfit = {};
          for (const [slot, items] of Object.entries(outfitSnapshot)) {
            if (!Array.isArray(items)) { lsOutfit[slot] = items; continue; }
            lsOutfit[slot] = items.map(({ thumbnailData, ...rest }) => rest);
          }
          lsState.currentOutfit = lsOutfit;
          localStorage.setItem('appState-backup', JSON.stringify(lsState));
        } catch {}
        await DressingCore.setData('settings', 'appState', appState);
      } catch {}
    },

    async loadAppState() {
      let dbState = null;
      let lsState = null;
      try { dbState = await DressingCore.getData('settings', 'appState'); } catch {}
      try {
        const backup = localStorage.getItem('appState-backup');
        if (backup) lsState = JSON.parse(backup);
      } catch {}
      // 取最新的狀態（localStorage 是同步的，F5 時更可靠）
      const s = (lsState?._savedAt || 0) >= (dbState?._savedAt || 0) ? lsState : dbState;
      if (!s) { this.currentOutfit = createEmptyOutfit(); return; }
      try {
        if (s.currentOutfit) {
          const normalized = normalizeOutfit(s.currentOutfit);
          this.currentOutfit = await resolveOutfitImages(normalized);
        }
      } catch {
        this.currentOutfit = createEmptyOutfit();
      }
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
    },

    debouncedSaveAppState() {
      if (this._saveAppStateTimer) clearTimeout(this._saveAppStateTimer);
      this._saveAppStateTimer = setTimeout(() => this.saveAppState(), 600);
    },

    async wearItem(item, variantKey = null) {
      if (!item) return;
      const slot = getSlotName(item.category);
      const currentItems = this.currentOutfit[slot] || [];

      if (currentItems.some(i => i.id === item.id)) return;

      const imgData = await resolveImageData(item.id, variantKey);
      if (!imgData) return;

      const itemToWear = { ...item, imageData: imgData };
      if (variantKey) itemToWear.currentVariant = variantKey;
      // 確保縮圖存在（如果 wardrobeItem 本身沒有 thumbnailData）
      if (!itemToWear.thumbnailData) {
        try {
          const full = await DressingCore.getData('items', item.id);
          if (full?.thumbnailData) {
            itemToWear.thumbnailData = full.thumbnailData;
            // 同步更新 wardrobeItems
            const wi = this.wardrobeItems.find(w => w.id === item.id);
            if (wi && !wi.thumbnailData) wi.thumbnailData = full.thumbnailData;
          }
        } catch {}
      }

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
        this.showNotification(`已穿戴：${item.displayName}`, 'success');
      }
    },

    async switchItemVariant(itemId, variantKey) {
      for (const slotKey of Object.keys(this.currentOutfit)) {
        const items = this.currentOutfit[slotKey];
        if (!Array.isArray(items)) continue;

        const itemIndex = items.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
          const item = items[itemIndex];
          const originalItem = this.wardrobeItems.find(w => w.id === itemId);
          if (originalItem && originalItem.variants) {
            const imgData = await resolveImageData(itemId, variantKey);
            if (imgData) {
              item.currentVariant = variantKey;
              item.imageData = imgData;
            }
            this.recordHistory();
            this.showNotification(`已切換變體：${originalItem.variants.find(v => v.key === variantKey)?.name || variantKey}`, 'info');
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
      imageCache.delete(item.id);
      if (item.currentVariant) imageCache.delete(`${item.id}:${item.currentVariant}`);
      if (item.category === 'character' && this.selectedCharacterId === item.id) {
        this.selectedCharacterId = filtered[0]?.id || null;
      }
      this.selectedItem = null;
      if (!this.isRestoring) {
        this.recordHistory();
        this.showNotification(`已移除：${item.displayName}`, 'info');
      }
    },

    selectItem(layer) {
      this.selectedItem = layer;
      if (layer?.category === 'character') this.selectedCharacterId = layer.item.id;
    },

    toggleSelectItem(layer) {
      if (this.selectedItem?.id === layer.id) {
        this.selectedItem = null;
        return;
      }
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
      imageCache.clear();
      if (!this.isRestoring) {
        this.recordHistory();
        this.showNotification('已清空穿搭', 'info');
      }
    },

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

    isLayerHidden(layerId) { return this._hiddenSet.has(layerId); },

    toggleLayerHidden(layerId) {
      const idx = this.hiddenLayerIds.indexOf(layerId);
      idx === -1 ? this.hiddenLayerIds.push(layerId) : this.hiddenLayerIds.splice(idx, 1);
      this.recordHistory();
    },

    resetLayerOrder() {
      this.layerOrder = [];
      this.recordHistory();
    },

    setItemPosition(itemId, position) { this.freeMode.itemPositions[itemId] = { ...position }; },
    setItemScale(itemId, scale) { this.freeMode.itemScales[itemId] = scale; },
    setItemFlip(itemId, flip) { this.freeMode.itemFlips[itemId] = { ...flip }; },
    setItemRotation(itemId, rotation) { this.freeMode.itemRotations[itemId] = rotation; },

    /** 取得物件的內容邊界 (normalized 0-1)，結果會被快取 */
    async getContentBounds(itemId, imageData) {
      if (contentBoundsCache.has(itemId)) return contentBoundsCache.get(itemId);
      if (!imageData) return { x: 0, y: 0, w: 1, h: 1 };
      const bounds = await computeContentBounds(imageData);
      contentBoundsCache.set(itemId, bounds);
      return bounds;
    },

    resetItemTransforms() {
      Object.assign(this.freeMode, { itemPositions: {}, itemScales: {}, itemFlips: {}, itemRotations: {} });
      this.selectedItem = null;
      this.recordHistory();
      this.showNotification('已重置所有變換', 'info');
    },

    recordHistory() {
      if (this.isRestoring) return;
      const currentState = {
        outfit: createOutfitSnapshot(this.currentOutfit),
        selectedCharacterId: this.selectedCharacterId,
        freeMode: cloneState(this.freeMode),
        layerOrder: cloneState(this.layerOrder),
        canvasMode: this.canvasMode,
        hiddenLayerIds: [...this.hiddenLayerIds]
      };

      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(currentState);

      const maxHistory = 25;
      if (this.history.length > maxHistory) this.history = this.history.slice(-maxHistory);
      this.historyIndex = this.history.length - 1;
      this.debouncedSaveAppState();
    },

    clearHistory() { this.history = []; this.historyIndex = -1; },
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.restoreFromHistory(); } },
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.restoreFromHistory(); } },

    async restoreFromHistory() {
      if (this.historyIndex < 0 || this.historyIndex >= this.history.length) return;
      const targetIndex = this.historyIndex;
      this.isRestoring = true;
      const s = this.history[targetIndex];
      const resolvedOutfit = await resolveOutfitImages(s.outfit);
      if (this.historyIndex !== targetIndex) { this.isRestoring = false; return; }
      this.currentOutfit = resolvedOutfit;
      this.selectedCharacterId = s.selectedCharacterId;
      this.freeMode = cloneState(s.freeMode);
      this.layerOrder = [...(s.layerOrder || [])];
      this.canvasMode = s.canvasMode || this.canvasMode;
      this.hiddenLayerIds = [...(s.hiddenLayerIds || [])];
      this.isRestoring = false;
    },

    async saveCurrentOutfit(name, previewImage = null) {
      const trimmedName = name?.trim();
      if (!trimmedName) { this.showNotification('請輸入穿搭名稱', 'error'); return; }

      const existing = this.savedOutfits.find(o => o.name === trimmedName);
      if (existing && !confirm('是否要將舊搭配覆蓋？')) {
        this.showNotification('已取消覆蓋', 'info');
        return;
      }

      const outfitCopy = {};
      for (const [slot, items] of Object.entries(this.currentOutfit)) {
        outfitCopy[slot] = Array.isArray(items) ? JSON.parse(JSON.stringify(items)) : [];
      }

      const outfitData = {
        id: existing?.id || generateId(),
        name: trimmedName,
        outfit: outfitCopy,
        layerOrder: cloneState(this.layerOrder),
        freeMode: cloneState(this.freeMode),
        canvasZoom: this.canvasZoom,
        canvasPan: { ...this.canvasPan },
        canvasMode: this.canvasMode,
        previewImage,
        createdAt: existing?.createdAt || new Date().toISOString()
      };

      try {
        await DressingCore.saveData('outfits', outfitData);
        await this._reloadOutfits();
        this.showNotification(`穿搭「${trimmedName}」已保存`, 'success');
      } catch (e) {
        this.showNotification('保存失敗', 'error');
      }
    },

    async _reloadOutfits() {
      const outfits = await DressingCore.getAllData('outfits');
      this.savedOutfits = outfits.map(o => ({
        id: o.id,
        name: o.name,
        previewImage: o.previewImage,
        createdAt: o.createdAt,
        layerOrder: o.layerOrder || [],
      }));
    },

    async importOutfit(outfitData) {
      if (!outfitData) return;
      const normalized = {
        ...outfitData,
        id: outfitData.id || generateId(),
        outfit: normalizeOutfit(outfitData.outfit),
        layerOrder: outfitData.layerOrder || []
      };
      try {
        await DressingCore.saveData('outfits', normalized);
        await this._reloadOutfits();
      } catch {
        this.showNotification('匯入穿搭失敗', 'error');
      }
    },

    async deleteOutfit(outfitId) {
      try {
        await DressingCore.deleteData('outfits', outfitId);
        await this._reloadOutfits();
        this.showNotification('穿搭已刪除', 'info');
      } catch {
        this.showNotification('刪除失敗', 'error');
      }
    },

    async renameOutfit(outfitId, newName) {
      if (!outfitId || !newName) {
        this.showNotification('重新命名失敗：缺少必要參數', 'error');
        return false;
      }
      try {
        const original = await DressingCore.getData('outfits', outfitId);
        if (!original) {
          this.showNotification('找不到該穿搭', 'error');
          return false;
        }
        await DressingCore.saveData('outfits', { ...original, name: newName });
        await this._reloadOutfits();
        this.showNotification('穿搭已重新命名', 'success');
        return true;
      } catch {
        this.showNotification('重新命名失敗', 'error');
        return false;
      }
    },

    async loadOutfit(outfit) {
      this.isRestoring = true;
      try {
        const fullData = await DressingCore.getData('outfits', outfit.id);
        if (!fullData?.outfit) {
          this.showNotification('無法載入穿搭', 'error');
          this.isRestoring = false;
          return;
        }
        const normalized = normalizeOutfit(fullData.outfit);
        this.currentOutfit = normalized;
        this.freeMode = cloneState(fullData.freeMode || {
          itemPositions: {}, itemScales: {}, itemFlips: {}, itemRotations: {},
          enableFreeScale: true, enableFreeRotation: false
        });
        this.layerOrder = [...(fullData.layerOrder || [])];
        this.canvasZoom = fullData.canvasZoom || 1;
        this.canvasPan = fullData.canvasPan ? { ...fullData.canvasPan } : { x: 0, y: 0 };
        this.canvasMode = fullData.canvasMode || 'fixed';
        this.selectedCharacterId = normalized.character[0]?.id || null;
        this.isRestoring = false;
        this.recordHistory();
        this.showNotification(`已載入穿搭: ${outfit.name}`, 'success');
      } catch {
        this.isRestoring = false;
        this.showNotification('載入穿搭失敗', 'error');
      }
    },

    async getFullExportData() {
      const [items, outfits] = await Promise.all([
        DressingCore.getAllData('items'),
        DressingCore.getAllData('outfits'),
      ]);
      return { items, outfits };
    },

    async getAppStateForBackup() {
      await this.saveAppState();
      try {
        return await DressingCore.getData('settings', 'appState');
      } catch { return null; }
    },

    async restoreAppStateFromBackup(appStateData) {
      if (!appStateData) return;
      try {
        appStateData._savedAt = Date.now();
        await DressingCore.setData('settings', 'appState', appStateData);
        try { localStorage.setItem('appState-backup', JSON.stringify(appStateData)); } catch {}
        await this.loadAppState();
      } catch {}
    },

    async addNewItem(itemData) {
      if (!itemData.thumbnailData && itemData.imageData) {
        itemData.thumbnailData = await generateThumbnail(itemData.imageData);
      }
      await DressingCore.saveData('items', itemData);
      try {
        this.wardrobeItems = await DressingCore.getAllItemsLightweight();
      } catch {
        const items = await DressingCore.getAllData('items');
        this.wardrobeItems = items.map(({ imageData, variantImages, ...rest }) => rest);
      }
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
        this.showNotification('圖包已刪除', 'info');
      } catch {
        this.showNotification('刪除失敗', 'error');
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
        this.dismissedBundledPacks = [];
        this.clearCurrentOutfit();
        this.clearHistory();

        // 重置主題、自定義 CSS、字體設定
        this.theme.currentTheme = 'default';
        this.theme.customThemes = [];
        this.theme.customCSS = '';
        this.theme.previewColors = null;
        this.theme.fontFamily = '';
        this.theme.fontSize = 16;
        this.applyTheme('default');
        this.applyCustomCSS('');
        this.applyFontSettings();

        // 清除 localStorage 備份
        try { localStorage.removeItem('appState-backup'); } catch {}
        try { localStorage.removeItem('theme-settings-cache'); } catch {}

        this.showNotification('所有資料已清空', 'info');
      } catch {
        this.showNotification('清空失敗', 'error');
      }
    },

    async toggleHideItem(itemId) {
      const idx = this.hiddenItems.indexOf(itemId);
      idx === -1 ? this.hiddenItems.push(itemId) : this.hiddenItems.splice(idx, 1);
      this.showNotification(idx === -1 ? '物件已隱藏' : '物件已取消隱藏', 'info');
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
      const fullItem = await DressingCore.getData('items', itemId);
      if (fullItem) {
        fullItem.displayName = newName;
        await DressingCore.saveData('items', fullItem);
      }
    },

    async deleteItem(itemId) {
      try {
        await DressingCore.deleteData('items', itemId);
        this.wardrobeItems = this.wardrobeItems.filter(i => i.id !== itemId);
        this.cleanupOutfit();
      } catch {
        this.showNotification('刪除失敗', 'error');
      }
    },

    setCanvasZoom(zoom) {
      let maxZoom;
      if (this.ui.isMobile && this._baseCanvasScale > 0) {
        // 手機版最大縮放 = 畫布原始大小 (finalScale = baseCanvasScale * zoom = 1)
        maxZoom = 1 / this._baseCanvasScale;
      } else {
        maxZoom = Math.max(5, this.canvasSize.width / 400);
      }
      this.canvasZoom = Math.max(0.05, Math.min(maxZoom, zoom));
    },
    setCanvasPan(pan) { this.canvasPan = { ...pan }; },
    resetCanvasView() { this.canvasZoom = 1; this.canvasPan = { x: 0, y: 0 }; },
    zoomIn() { this.setCanvasZoom(this.canvasZoom * 1.2); },
    zoomOut() { this.setCanvasZoom(this.canvasZoom * 0.8); },
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

    formatDate(dateString, options = {}) {
      if (!dateString) return '未知時間';
      return new Date(dateString).toLocaleDateString('zh-TW', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', ...options
      });
    },

    async saveThemeSettings() {
      const themeData = cloneState({
        currentTheme: this.theme.currentTheme,
        customThemes: this.theme.customThemes,
        customCSS: this.theme.customCSS,
        previewColors: this.theme.previewColors || null,
        fontFamily: this.theme.fontFamily || '',
        fontSize: this.theme.fontSize || 16,
      });
      try {
        await DressingCore.setData('theme', 'settings', themeData);
        // 快取中額外儲存已解析的配色，供頁面載入時同步套用
        const resolvedColors = this._resolveThemeColors();
        const cacheData = { ...themeData };
        if (resolvedColors) cacheData._resolvedColors = resolvedColors;
        localStorage.setItem('theme-settings-cache', JSON.stringify(cacheData));
      } catch {}
    },

    _resolveThemeColors() {
      const themeName = this.theme.currentTheme;
      if (this.theme.previewColors && Object.keys(this.theme.previewColors).length > 0) {
        return this.theme.previewColors;
      }
      if (themeName === 'default') return null;
      const preset = presetThemes.find(t => t.id === themeName);
      const custom = preset || this.theme.customThemes.find(t => t.id === themeName);
      return custom?.colors || null;
    },

    async setCurrentTheme(themeName) {
      this.theme.currentTheme = themeName;
      this.theme.previewColors = null;
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
        'color-primary',
        'color-bg-main', 'color-bg-panel', 'color-bg-card', 'color-bg-canvas',
        'color-text-primary', 'color-text-secondary',
        'color-border',
        'color-success', 'color-error', 'color-warning', 'color-info'
      ];

      if (themeName === 'default') {
        const fallback = initialThemeCSS || hardcodedDefaultThemeCSS;
        if (styleElement && fallback) styleElement.innerHTML = fallback;
        cssVars.forEach(v => root.style.removeProperty(`--${v}`));
      } else {
        const preset = presetThemes.find(t => t.id === themeName);
        const custom = preset || this.theme.customThemes.find(t => t.id === themeName);
        if (custom?.colors) {
          Object.entries(custom.colors).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
        }
      }
    },

    applyFontSettings() {
      const root = document.documentElement;
      const size = this.theme.fontSize || 16;
      root.style.setProperty('--app-base-font-size', `${size}px`);
      root.style.fontSize = `${size}px`;
      if (this.theme.fontFamily) {
        document.body.style.fontFamily = this.theme.fontFamily;
      } else {
        document.body.style.fontFamily = '';
      }
    },

    async setFontSettings(fontFamily, fontSize) {
      this.theme.fontFamily = fontFamily;
      this.theme.fontSize = fontSize;
      this.applyFontSettings();
      await this.saveThemeSettings();
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

    async restoreThemeFromBackup(themeData) {
      if (!themeData) return;
      this.theme.currentTheme = themeData.currentTheme || 'default';
      this.theme.customThemes = Array.isArray(themeData.customThemes) ? themeData.customThemes : [];
      this.theme.customCSS = themeData.customCSS || '';
      this.theme.fontFamily = themeData.fontFamily || '';
      this.theme.fontSize = themeData.fontSize || 16;
      this.theme.previewColors = null;
      this.applyTheme(this.theme.currentTheme);
      this.applyCustomCSS(this.theme.customCSS);
      this.applyFontSettings();
      await this.saveThemeSettings();
    },

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