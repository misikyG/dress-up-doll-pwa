<template>
  <section
    aria-label="衣櫃"
    class="wardrobe"
    :class="{ collapsed: gameStore.ui.wardrobeCollapsed, 'mobile-bottom-sheet': gameStore.ui.isMobile, 'tablet-style': gameStore.ui.isTablet }"
  >
    <template v-if="!gameStore.ui.isMobile">
      <!-- 桌面版和平板版摺疊按鈕 -->
      <button
        @click="gameStore.toggleWardrobe()"
        class="panel-toggle-handle panel-toggle-handle--right"
        :title="gameStore.ui.wardrobeCollapsed ? '展開衣櫥' : '收合衣櫥'"
      >
        <span class="icon">{{ gameStore.ui.wardrobeCollapsed ? '▶' : '◀' }}</span>
      </button>
    </template>

    <!-- 衣櫥內容 -->
    <div class="wardrobe-content" :class="{ 'mobile-style': gameStore.ui.isMobile }">
      <!-- 桌面版和平板版：垂直佈局 -->
      <div v-if="!gameStore.ui.isMobile" class="desktop-wardrobe">
        <!-- 分類佈局 (垂直) -->
        <div class="category-sidebar" :class="{ collapsed: gameStore.ui.wardrobeCollapsed }">
          <button v-for="category in gameStore.categories" :key="category.key"
            :class="['category-tab', { active: activeCategory === category.key }]"
            @click="setActiveCategory(category.key)" :title="category.name">
            <div class="tab-icon" v-html="category.svg"></div>
            <span class="tab-label">{{ category.name }}</span>
          </button>
        </div>

        <!-- 物件顯示區域 -->
        <div v-if="!gameStore.ui.wardrobeCollapsed" class="items-display">
          <!-- 控制面板 -->
          <div class="items-controls">
            <!-- 篩選器按鈕 -->
            <button class="filter-toggle-btn" @click="showFilterPanel = !showFilterPanel" 
                    :class="{ active: showFilterPanel || hasActiveFilters }"
                    aria-label="篩選">
              <span class="filter-icon" v-html="filterIcon"></span>
              <span v-if="hasActiveFilters" class="filter-badge">{{ activeFilterCount }}</span>
            </button>
            
            <!-- 排序方式 (單選) -->
            <select v-model="sortBy" class="filter-select sort-select" title="排序方式" aria-label="排序方式">
              <option value="name">按名稱</option>
              <option value="pack">按圖包</option>
              <option value="recent">最近加入</option>
            </select>
          </div>

          <!-- 篩選面板 (可展開) -->
          <transition name="slide-down">
            <div v-if="showFilterPanel" class="filter-panel">
              <!-- 圖包多選 -->
              <div class="filter-section">
                <div class="filter-section-header">
                  <span class="filter-section-title">圖包篩選</span>
                  <button class="filter-clear-btn" @click="clearPackFilters" v-if="selectedPacks.length > 0">
                    清除
                  </button>
                </div>
                <div class="filter-checkboxes">
                  <label v-for="pack in availablePacks" :key="pack.id" class="filter-checkbox-item">
                    <input type="checkbox" :value="pack.id" v-model="selectedPacks" />
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-label">{{ pack.displayName || pack.name }}</span>
                  </label>
                </div>
              </div>

              <!-- Tag 篩選 (根據當前分類顯示) -->
              <div class="filter-section" v-if="characterOptions.length > 0 && activeCategory !== 'starred'">
                <div class="filter-section-header">
                  <span class="filter-section-title">人物篩選</span>
                  <button class="filter-clear-btn" @click="clearCharacterFilters" v-if="selectedCharacters.length > 0">
                    清除
                  </button>
                </div>
                <div class="filter-checkboxes">
                  <label v-for="char in characterOptions" :key="char.id" class="filter-checkbox-item">
                    <input type="checkbox" :value="char.id" v-model="selectedCharacters" />
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-label">{{ char.name }}<span v-if="char.pack"> · {{ char.pack }}</span></span>
                  </label>
                </div>
              </div>

              <!-- Tag 篩選 (根據當前分類顯示) -->
              <div class="filter-section" v-if="currentCategoryTags.length > 0">
                <div class="filter-section-header">
                  <span class="filter-section-title">屬性標籤</span>
                  <button class="filter-clear-btn" @click="clearTagFilters" v-if="selectedTags.length > 0">
                    清除
                  </button>
                </div>
                <div class="filter-checkboxes tag-checkboxes">
                  <label v-for="tag in currentCategoryTags" :key="tag.key" class="filter-checkbox-item tag-item">
                    <input type="checkbox" :value="tag.key" v-model="selectedTags" />
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-label">{{ tag.key }}<span v-if="tag.count"> ({{ tag.count }})</span></span>
                  </label>
                </div>
              </div>

              <!-- 隱藏物件開關 -->
              <div class="filter-section">
                <label class="filter-checkbox-item hide-toggle">
                  <input type="checkbox" v-model="showHidden" />
                  <span class="checkbox-custom"></span>
                  <span class="checkbox-label">顯示隱藏的物件</span>
                  <span v-if="gameStore.hiddenItems.length > 0" class="hidden-count">
                    ({{ gameStore.hiddenItems.length }})
                  </span>
                </label>
              </div>
            </div>
          </transition>

          <!-- 物件網格 -->
          <div class="items-grid-container" ref="scrollContainer" @scroll="handleScroll">
            <div class="items-grid-sizer" :style="{ height: `${totalContentHeight}px` }">
              <div v-if="activeCategory === 'starred'" class="items-grid"
                :style="{ transform: `translateY(${visibleItems.offsetY}px)` }">
                <div v-for="outfit in visibleItems.items" :key="`outfit-${outfit.id}`" class="grid-item outfit-card"
                  @click="loadOutfit(outfit)"
                  @contextmenu="handleOutfitContextMenu(outfit, $event)"
                  @touchstart="handleOutfitTouchStart(outfit, $event)"
                  @touchmove="handleItemTouchMove"
                  @touchend="handleOutfitTouchEnd"
                  @touchcancel="handleOutfitTouchEnd">
                  <div class="item-thumbnail outfit-preview">
                    <img v-if="outfit.previewImage" :src="outfit.previewImage" :alt="outfit.name" loading="lazy" />
                    <span v-else class="preview-icon">⭐</span>
                  </div>
                  <div class="item-info">
                    <span class="item-name" :title="outfit.name">{{ outfit.name }}</span>
                    <span class="outfit-date">{{ formatDate(outfit.createdAt) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="items-grid" :style="{ transform: `translateY(${visibleItems.offsetY}px)` }">
                <div v-for="item in visibleItems.items" :key="item.id" :class="['grid-item', 'item-card', {
                  'equipped': gameStore.isItemInCurrentOutfit(item),
                  'expression-available': isExpressionAvailable(item),
                  'has-variant': item.hasVariant,
                  'highlighted': gameStore.ui.highlightedItemId === item.id
                }]" 
                  @click="handleItemClick(item)"
                  @contextmenu="handleItemContextMenu(item, $event)"
                  @touchstart="handleItemTouchStart(item, $event)"
                  @touchmove="handleItemTouchMove"
                  @touchend="handleItemTouchEnd"
                  @touchcancel="handleItemTouchEnd">
                  <div class="item-thumbnail">
                    <img :src="item.thumbnailData || item.imageData" :alt="item.displayName" loading="lazy" />
                    <div v-if="gameStore.isItemInCurrentOutfit(item)" class="equipped-badge"></div>
                    <div v-if="item.hasVariant" class="variant-indicator" title="右鍵或長按選擇變體">◆</div>
                  </div>
                  <div class="item-info">
                    <span class="item-name" :title="item.displayName">{{ item.displayName }}</span>
                    <div class="item-meta-row">
                      <span class="item-pack-name">{{ getPackName(item) }}</span>
                      <!-- Tag 標籤顯示 -->
                      <div v-if="item.tags && item.tags.length > 0" class="item-tags">
                        <span v-for="tag in item.tags" :key="tag" class="item-tag" :title="getTagDisplayName(item.category, tag)">
                          {{ getTagDisplayName(item.category, tag) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 空狀態提示 -->
            <div v-if="filteredAndSortedItems.length === 0" class="empty-state">
              <div class="empty-icon" v-html="currentCategoryIcon"></div>
              <p>此分類暫無物件</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 手機版：底部抽屜式佈局 -->
      <div v-else class="mobile-wardrobe" :class="{ collapsed: gameStore.ui.wardrobeCollapsed }">
        <button
          class="mobile-drawer-toggle"
          @click="gameStore.toggleWardrobe()"
          :title="gameStore.ui.wardrobeCollapsed ? '展開衣櫥' : '收合衣櫥'"
        >
          <div class="drawer-handle"></div>
          <div class="drawer-title">
            <span>衣櫃</span>
          </div>
        </button>

        <div class="mobile-wardrobe-body">
          <!-- 分類 TAB -->
          <div class="mobile-categories">
            <div class="categories-scroll" @wheel.prevent="onMobileCategoriesWheel">
              <button
                v-for="category in gameStore.categories"
                :key="category.key"
                :class="['mobile-category-tab', { active: activeCategory === category.key }]"
                @click="setActiveCategory(category.key)"
              >
                <div class="mobile-tab-icon" v-html="category.svg"></div>
                <span class="mobile-tab-label" :class="{ visible: activeCategory === category.key }">
                  {{ category.name }}
                </span>
              </button>
            </div>
          </div>

          <!-- 物件水平滾動列表 -->
          <div class="mobile-items-scroll" ref="mobileScrollContainer" @wheel.prevent="onMobileItemsWheel" @scroll="onMobileItemsScroll">
            <!-- 儲存搭配顯示 (starred 分類) -->
            <template v-if="activeCategory === 'starred'">
              <div
                v-for="outfit in gameStore.savedOutfits"
                :key="`mobile-outfit-${outfit.id}`"
                class="mobile-item mobile-outfit-item"
                @click="loadOutfit(outfit)"
                @touchstart="handleOutfitTouchStart(outfit, $event)"
                @touchmove="handleItemTouchMove"
                @touchend="handleOutfitTouchEnd"
                @touchcancel="handleOutfitTouchEnd"
              >
                <img v-if="outfit.previewImage" :src="outfit.previewImage" :alt="outfit.name" loading="lazy" />
                <span v-else class="mobile-outfit-icon">⭐</span>
                <span class="mobile-outfit-name">{{ outfit.name }}</span>
              </div>
            </template>
            <!-- 普通物件顯示 -->
            <template v-else>
              <div
                v-for="item in mobileVisibleItems"
                :key="item.id"
                :class="['mobile-item', { 'equipped': gameStore.isItemInCurrentOutfit(item), 'has-variant': item.hasVariant }]"
                @click="handleItemClick(item)"
                @touchstart="handleItemTouchStart(item, $event)"
                @touchmove="handleItemTouchMove"
                @touchend="handleItemTouchEnd"
                @touchcancel="handleItemTouchEnd"
                @contextmenu="handleItemContextMenu(item, $event)"
              >
                <img :src="item.thumbnailData || item.imageData" :alt="item.displayName" loading="lazy" />
                <div v-if="gameStore.isItemInCurrentOutfit(item)" class="mobile-equipped-badge">✓</div>
                <div v-if="item.hasVariant" class="mobile-variant-indicator" title="長按選擇變體">◆</div>
              </div>
            </template>
          </div>

          <!-- 衣櫃空狀態 -->
          <div v-if="activeCategory !== 'starred' && filteredAndSortedItems.length === 0" class="mobile-wardrobe-empty">
            {{ gameStore.availablePacks.length === 0 ? '衣櫃空空如也' : '此分類暫無物件' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 上下文選單 (右鍵/長按選單) -->
    <Teleport to="body">
      <div v-if="contextMenu.visible" class="context-menu-overlay" @click="hideContextMenu">
        <div 
          class="context-menu" 
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
          @click.stop>
          <div class="context-menu-header">
            <span class="context-menu-title">{{ contextMenu.item?.displayName }}</span>
            <button class="context-menu-close" @click="hideContextMenu">✕</button>
          </div>
          <div class="context-menu-content">
            <!-- 變體選項 -->
            <template v-if="contextMenu.item?.hasVariant">
              <div class="context-menu-section">
                <span class="context-menu-section-title">選擇變體</span>
                <button 
                  v-for="variant in contextMenu.item?.variants || []" 
                  :key="getVariantKey(variant)"
                  :class="['context-menu-option variant-option', { 
                    'active': getCurrentVariant(contextMenu.item) === getVariantKey(variant) 
                  }]"
                  @click="selectVariant(getVariantKey(variant))">
                  <span class="option-icon">{{ getCurrentVariant(contextMenu.item) === getVariantKey(variant) ? '◆' : '◇' }}</span>
                  <span class="option-name">{{ getVariantDisplayName(variant) }}</span>
                </button>
              </div>
              <div class="context-menu-divider"></div>
            </template>
            
            <!-- 手機版物件詳細資訊 -->
            <template v-if="gameStore.ui.isMobile && contextMenu.item">
              <div class="context-menu-section mobile-item-details">
                <span class="context-menu-section-title">物件資訊</span>
                <div class="detail-row">
                  <span class="detail-label">名稱：</span>
                  <span class="detail-value">{{ contextMenu.item.displayName }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">圖包：</span>
                  <span class="detail-value">{{ getPackName(contextMenu.item) }}</span>
                </div>
                <div v-if="contextMenu.item.tags && contextMenu.item.tags.length > 0" class="detail-row">
                  <span class="detail-label">標籤：</span>
                  <span class="detail-value detail-tags">
                    <span v-for="tag in contextMenu.item.tags" :key="tag" class="detail-tag">
                      {{ getTagDisplayName(contextMenu.item.category, tag) }}
                    </span>
                  </span>
                </div>
              </div>
              <div class="context-menu-divider"></div>
            </template>
            
            <!-- 物件操作 -->
            <div class="context-menu-section">
              <button class="context-menu-option" @click="toggleHideItem(contextMenu.item)">
                <span class="option-icon" v-html="isItemHidden(contextMenu.item) ? icons.eyeShow : icons.eyeHide"></span>
                <span class="option-name">{{ isItemHidden(contextMenu.item) ? '取消隱藏' : '隱藏' }}</span>
              </button>
              <button class="context-menu-option" @click="renameItem(contextMenu.item)">
                <span class="option-icon" v-html="icons.rename"></span>
                <span class="option-name">重新命名</span>
              </button>
              <button class="context-menu-option danger" @click="deleteItem(contextMenu.item)">
                <span class="option-icon" v-html="icons.trash"></span>
                <span class="option-name">刪除</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 搭配上下文選單 -->
      <div v-if="outfitContextMenu.visible" class="context-menu-overlay" @click="hideOutfitContextMenu">
        <div 
          class="context-menu" 
          :style="{ left: outfitContextMenu.x + 'px', top: outfitContextMenu.y + 'px' }"
          @click.stop>
          <div class="context-menu-header">
            <span class="context-menu-title">{{ outfitContextMenu.outfit?.name }}</span>
            <button class="context-menu-close" @click="hideOutfitContextMenu">✕</button>
          </div>
          <div class="context-menu-content">
            <div class="context-menu-section">
              <button class="context-menu-option" @click="loadOutfit(outfitContextMenu.outfit); hideOutfitContextMenu();">
                <span class="option-icon" v-html="icons.camera"></span>
                <span class="option-name">載入搭配</span>
              </button>
              <button class="context-menu-option" @click="renameOutfit(outfitContextMenu.outfit)">
                <span class="option-icon" v-html="icons.rename"></span>
                <span class="option-name">重新命名</span>
              </button>
              <button class="context-menu-option danger" @click="deleteOutfit(outfitContextMenu.outfit)">
                <span class="option-icon" v-html="icons.trash"></span>
                <span class="option-name">刪除搭配</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';

const gameStore = useGameStore();

const activeCategory = ref('character');
const selectedPacks = ref([]);  // 改為多選陣列
const selectedTags = ref([]);   // Tag 多選陣列
const selectedCharacters = ref([]); // 人物篩選
const sortBy = ref('name');
const scrollContainer = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(600);
const showFilterPanel = ref(false);
const showHidden = ref(false);  // 顯示隱藏物件的開關

// 上下文選單狀態 (整合變體選單)
const contextMenu = ref({
  visible: false,
  item: null,
  x: 0,
  y: 0
});

const outfitContextMenu = ref({
  visible: false,
  outfit: null,
  x: 0,
  y: 0
});

let longPressTimer = null;

const filterIcon = icons.filter;

const ITEM_WIDTH = 120;
const ITEM_HEIGHT = 130;
const INFO_HEIGHT = 58;
const GAP = 12;
let resizeObserver = null;

const availablePacks = computed(() => gameStore.availablePacks);

const characterOptions = computed(() => {
  const chars = gameStore.wardrobeItems.filter(item => item.category === 'character');
  return chars.map(item => ({
    id: item.id,
    name: item.displayName,
    pack: gameStore.getPackName(item)
  }));
});

const effectiveCharacterFilters = computed(() => {
  if (selectedCharacters.value.length > 0) return selectedCharacters.value;
  return gameStore.selectedCharacterId ? [gameStore.selectedCharacterId] : [];
});

// 切換分類前的基礎物件池（尚未套用 Tag 篩選）
const baseItemsForCategory = computed(() => {
  if (activeCategory.value === 'starred') return [...gameStore.savedOutfits];

  let items = gameStore.getItemsByCategory(activeCategory.value);

  if (showHidden.value) {
    items = items.filter(item => gameStore.hiddenItems.includes(item.id));
  } else {
    items = items.filter(item => !gameStore.hiddenItems.includes(item.id));
  }

  if (selectedPacks.value.length > 0) {
    items = items.filter(item => selectedPacks.value.includes(item.packId));
  }
  // 人物篩選：僅當 item 有綁定時才受影響
  if (effectiveCharacterFilters.value.length > 0) {
    const allowIds = new Set(effectiveCharacterFilters.value);
    items = items.filter(item => {
      if (!item.characterId || item.category === 'character') return true;
      return allowIds.has(item.characterId);
    });
  }

  return items;
});

const currentCategoryTags = computed(() => {
  if (activeCategory.value === 'starred') return [];
  const tagCounts = new Map();
  baseItemsForCategory.value.forEach((item) => {
    (item.tags || []).forEach((tag) => {
      const trimmed = String(tag || '').trim();
      if (!trimmed) return;
      tagCounts.set(trimmed, (tagCounts.get(trimmed) || 0) + 1);
    });
  });
  return Array.from(tagCounts.entries()).map(([key, count]) => ({ key, count }));
});

const hasActiveFilters = computed(() => {
  return selectedPacks.value.length > 0 || selectedTags.value.length > 0 || selectedCharacters.value.length > 0;
});

const activeFilterCount = computed(() => {
  return selectedPacks.value.length + selectedTags.value.length + selectedCharacters.value.length;
});

const getTagDisplayName = (_category, tagKey) => tagKey;

const clearPackFilters = () => {
  selectedPacks.value = [];
};

const clearCharacterFilters = () => {
  selectedCharacters.value = [];
};

const clearTagFilters = () => {
  selectedTags.value = [];
};

const filteredAndSortedItems = computed(() => {
  let items = [...baseItemsForCategory.value];

  // Tag 篩選 (如果有選擇 tag，物件必須包含至少一個選中的 tag)
  if (selectedTags.value.length > 0 && activeCategory.value !== 'starred') {
    items = items.filter(item => {
      if (!item.tags || item.tags.length === 0) return false;
      return item.tags.some(tag => selectedTags.value.includes(tag));
    });
  }

  items.sort((a, b) => {
    switch (sortBy.value) {
      case 'pack':
        return (getPackName(a) || '').localeCompare(getPackName(b) || '');
      case 'recent':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      case 'name':
      default:
        return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
    }
  });

  return items;
});

// --- 手機版：限制渲染數量以防止 iOS Safari 記憶體溢出 ---
const MOBILE_MAX_ITEMS = 50;
const mobileLoadedCount = ref(MOBILE_MAX_ITEMS);
const mobileScrollContainer = ref(null);

const mobileVisibleItems = computed(() => {
  return filteredAndSortedItems.value.slice(0, mobileLoadedCount.value);
});

const onMobileItemsScroll = () => {
  const el = mobileScrollContainer.value;
  if (!el) return;
  // 當滾動接近右端時載入更多
  if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 100) {
    if (mobileLoadedCount.value < filteredAndSortedItems.value.length) {
      mobileLoadedCount.value = Math.min(
        mobileLoadedCount.value + MOBILE_MAX_ITEMS,
        filteredAndSortedItems.value.length
      );
    }
  }
};

const itemsPerRow = computed(() => {
  if (!scrollContainer.value || gameStore.ui.wardrobeCollapsed) return 1;
  return Math.max(1, Math.floor(scrollContainer.value.clientWidth / (ITEM_WIDTH + GAP)));
});

const computedRowHeight = computed(() => {
  if (!scrollContainer.value || !itemsPerRow.value) return ITEM_HEIGHT;
  const cols = Math.max(1, itemsPerRow.value);
  const totalGap = Math.max(0, (cols - 1) * GAP);
  const columnWidth = Math.floor((scrollContainer.value.clientWidth - totalGap) / cols);
  return columnWidth + INFO_HEIGHT;
});

const totalContentHeight = computed(() => {
  const rowCount = Math.ceil(filteredAndSortedItems.value.length / itemsPerRow.value);
  return rowCount * (computedRowHeight.value + GAP);
});

const visibleItems = computed(() => {
  const rowHeightWithGap = computedRowHeight.value + GAP;
  const totalRows = Math.ceil(filteredAndSortedItems.value.length / itemsPerRow.value);

  const visibleStartRow = Math.floor(scrollTop.value / rowHeightWithGap);
  const visibleEndRow = Math.min(totalRows, visibleStartRow + Math.ceil(containerHeight.value / rowHeightWithGap) + 1);

  const startIndex = visibleStartRow * itemsPerRow.value;
  const endIndex = Math.min(filteredAndSortedItems.value.length, visibleEndRow * itemsPerRow.value);

  return {
    items: filteredAndSortedItems.value.slice(startIndex, endIndex),
    offsetY: visibleStartRow * rowHeightWithGap
  };
});

const currentCategoryIcon = computed(() => {
  return gameStore.categories.find(c => c.key === activeCategory.value)?.svg || icons.other;
});

const setActiveCategory = (categoryKey) => {
  activeCategory.value = categoryKey;
  selectedTags.value = [];
  mobileLoadedCount.value = MOBILE_MAX_ITEMS;
  if (scrollContainer.value) scrollContainer.value.scrollTop = 0;
  if (mobileScrollContainer.value) mobileScrollContainer.value.scrollLeft = 0;
};

const getPackName = (item) => gameStore.getPackName(item);

const handleItemClick = (item) => {
  if (activeCategory.value === 'starred') {
    loadOutfit(item);
  } else {
    if (gameStore.isItemInCurrentOutfit(item)) {
      gameStore.removeItem(item);
    } else {
      gameStore.wearItem(item);
    }
  }
};

const loadOutfit = async (outfit) => {
  await gameStore.loadOutfit(outfit);
  gameStore.setCurrentPage('dressing');
};

const isExpressionAvailable = (item) => {
  if (item.category !== 'character') return false;
  return gameStore.wardrobeItems.some(i => 
    i.category === 'expression' && i.characterId === item.id
  );
};

const formatDate = (dateString) => gameStore.formatDate(dateString);

const showContextMenu = (item, event) => {
  event.preventDefault();
  event.stopPropagation();
  
  const menuWidth = 200;
  const menuHeight = 280;
  let x = event.clientX || event.touches?.[0]?.clientX || 0;
  let y = event.clientY || event.touches?.[0]?.clientY || 0;
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  contextMenu.value = {
    visible: true,
    item: item,
    x: x,
    y: y
  };
};

const hideContextMenu = () => {
  contextMenu.value.visible = false;
  contextMenu.value.item = null;
};

const selectVariant = (variantKey) => {
  const item = contextMenu.value.item;
  if (!item) return;
  
  // 如果物品已穿戴，切換變體
  if (gameStore.isItemInCurrentOutfit(item)) {
    gameStore.switchItemVariant(item.id, variantKey);
  } else {
    // 如果物品未穿戴，穿戴並選擇變體
    gameStore.wearItem(item, variantKey);
  }
  
  hideContextMenu();
};

const isItemHidden = (item) => {
  return gameStore.hiddenItems?.includes(item.id) || false;
};

const toggleHideItem = async (item) => {
  await gameStore.toggleHideItem(item.id);
  hideContextMenu();
};

const renameItem = async (item) => {
  const newName = prompt('請輸入新的名稱：', item.displayName);
  if (newName && newName.trim() && newName !== item.displayName) {
    await gameStore.renameItem(item.id, newName.trim());
    gameStore.showNotification(`已重新命名為「${newName.trim()}」`, 'success');
  }
  hideContextMenu();
};

const deleteItem = async (item) => {
  if (confirm(`確定要刪除「${item.displayName}」嗎？此操作無法復原！`)) {
    await gameStore.deleteItem(item.id);
    gameStore.showNotification(`已刪除「${item.displayName}」`, 'info');
  }
  hideContextMenu();
};

const getVariantDisplayName = (variant) => {
  if (typeof variant === 'object') {
    return variant.name || variant.key;
  }
  return variant;
};

const getVariantKey = (variant) => {
  if (typeof variant === 'object') {
    return variant.key;
  }
  return variant;
};

// 獲取物品當前選擇的變體
const slotNameMap = { accessory: 'accessories', carry: 'carries', underwear: 'underwears', other: 'others' };
const getCurrentVariant = (item) => {
  if (!item) return null;
  // 檢查是否在穿戴中並有當前變體
  const slot = slotNameMap[item.category] || item.category;
  const items = gameStore.currentOutfit?.[slot];
  if (Array.isArray(items)) {
    const equippedItem = items.find(i => i.id === item.id);
    if (equippedItem?.currentVariant) {
      return equippedItem.currentVariant;
    }
  }
  return item.defaultVariant || null;
};

// 長按事件處理
let longPressMoved = false;

const handleItemTouchStart = (item, event) => {
  longPressMoved = false;
  longPressTimer = setTimeout(() => {
    if (!longPressMoved) {
      showContextMenu(item, event);
    }
  }, 500); // 500ms 長按
};

const handleItemTouchMove = () => {
  // 手指移動時取消長按，避免水平滾動選單時誤觸
  longPressMoved = true;
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

const handleItemTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

const handleItemContextMenu = (item, event) => {
  showContextMenu(item, event);
};

// 已儲存搭配的右鍵菜單處理
const handleOutfitContextMenu = (outfit, event) => {
  showOutfitContextMenu(outfit, event);
};

const handleOutfitTouchStart = (outfit, event) => {
  longPressMoved = false;
  longPressTimer = setTimeout(() => {
    if (!longPressMoved) {
      showOutfitContextMenu(outfit, event);
    }
  }, 500);
};

const handleOutfitTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

const showOutfitContextMenu = (outfit, event) => {
  event.preventDefault();
  event.stopPropagation();
  
  const menuWidth = 180;
  const menuHeight = 120;
  let x = event.clientX || event.touches?.[0]?.clientX || 0;
  let y = event.clientY || event.touches?.[0]?.clientY || 0;
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }
  
  outfitContextMenu.value = {
    visible: true,
    outfit: outfit,
    x: x,
    y: y
  };
};

const hideOutfitContextMenu = () => {
  outfitContextMenu.value.visible = false;
  outfitContextMenu.value.outfit = null;
};

const deleteOutfit = async (outfit) => {
  if (confirm(`確定要刪除搭配「${outfit.name}」嗎？`)) {
    await gameStore.deleteOutfit(outfit.id);
  }
  hideOutfitContextMenu();
};

const renameOutfit = async (outfit) => {
  if (!outfit || !outfit.id) {
    gameStore.showNotification('無法取得搭配資訊', 'error');
    hideOutfitContextMenu();
    return;
  }
  
  // 先保存 outfit 資訊，再關閉選單
  const outfitId = outfit.id;
  const currentName = outfit.name || '';
  hideOutfitContextMenu();
  
  setTimeout(async () => {
    const newName = prompt('請輸入新的搭配名稱：', currentName);
    if (newName?.trim() && newName !== currentName) {
      await gameStore.renameOutfit(outfitId, newName.trim());
    }
  }, 100);
};

const handleScroll = () => {
  if (scrollContainer.value) {
    scrollTop.value = scrollContainer.value.scrollTop;
  }
};

const onMobileItemsWheel = (e) => {
  const container = e.currentTarget;
  if (container) {
    container.scrollLeft += e.deltaY || e.deltaX;
  }
};

const onMobileCategoriesWheel = (e) => {
  const container = e.currentTarget;
  if (container) {
    container.scrollLeft += e.deltaY || e.deltaX;
  }
};

const updateContainerHeight = () => {
  if (scrollContainer.value) {
    containerHeight.value = scrollContainer.value.clientHeight;
  }
};

let resizeDebounceTimer = null;
const debouncedUpdateContainerHeight = () => {
  if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(updateContainerHeight, 100);
};

onMounted(() => {
  updateContainerHeight();
  if (scrollContainer.value) {
    resizeObserver = new ResizeObserver(() => debouncedUpdateContainerHeight());
    resizeObserver.observe(scrollContainer.value);
  }
  window.addEventListener('resize', debouncedUpdateContainerHeight);
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
  window.removeEventListener('resize', debouncedUpdateContainerHeight);
  if (longPressTimer) {
    clearTimeout(longPressTimer);
  }
});

watch(() => gameStore.ui.wardrobeCollapsed, async () => {
  await nextTick();
  debouncedUpdateContainerHeight();
});

watch(showFilterPanel, async () => {
  await nextTick();
  debouncedUpdateContainerHeight();
});

// 監聽衣櫃分類切換
watch(() => gameStore.ui.wardrobeCategory, (newCategory) => {
  if (newCategory) {
    setActiveCategory(newCategory);
    // 清除設定，避免重複跳轉
    gameStore.ui.wardrobeCategory = null;
  }
});

// 監聽人物切換，預設勾選當前人物
watch(() => gameStore.selectedCharacterId, (id) => {
  if (id) {
    selectedCharacters.value = [id];
  } else {
    selectedCharacters.value = [];
  }
}, { immediate: true });

// 清理不存在的 tag / character 篩選值
watch(currentCategoryTags, (tags) => {
  if (selectedTags.value.length === 0) return;
  const tagKeys = new Set(tags.map(t => t.key));
  const filtered = selectedTags.value.filter(tag => tagKeys.has(tag));
  if (filtered.length !== selectedTags.value.length) {
    selectedTags.value = filtered;
  }
});

watch(characterOptions, (options) => {
  if (selectedCharacters.value.length === 0) return;
  const optionIds = new Set(options.map(opt => opt.id));
  const filtered = selectedCharacters.value.filter(id => optionIds.has(id));
  if (filtered.length !== selectedCharacters.value.length) {
    selectedCharacters.value = filtered;
  }
});
</script>

<style scoped>
.wardrobe { 
  position: relative;
  background-color: color-mix(in srgb, var(--color-bg-card) 95%, transparent); 
  -webkit-backdrop-filter: blur(5px);
  backdrop-filter: blur(5px); 
  overflow: hidden; 
  display: flex; 
  flex-direction: column; 
  transition: width 0.25s ease-out; 
  height: 100%;
  max-height: 100%;
}

.mobile-bottom-sheet {
  height: auto;
  max-height: none;
}

.wardrobe-content { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  min-height: 0; 
}

.desktop-wardrobe { 
  height: 100%; 
  width: 100%;
  display: flex; 
  flex-direction: row; 
  min-height: 0;
}

.panel-toggle-handle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 50px;
  background: color-mix(in srgb, var(--color-text-primary) 75%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: none;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: var(--color-bg-card);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  border-radius: 50px 0 0 50px;
  padding-left: 2px;
}

.panel-toggle-handle:hover {
  background: var(--color-primary);
  width: 24px;
}

.panel-toggle-handle .icon {
  transition: transform 0.2s ease;
}

.panel-toggle-handle--right {
  right: -5px;
}

/* 僅桌面版/平板版收合時限制寬度，手機版不限制 */
@media (min-width: 768px) {
  .left-panel.collapsed {
    width: 68px;
    min-width: 68px;
    max-width: 68px;
  }
}

.wardrobe.collapsed .items-display {
  opacity: 0;
  visibility: hidden;
  width: 0;
  overflow: hidden;
  flex: 0;
  pointer-events: none;
}

.wardrobe.collapsed .category-sidebar {
  width: 100%;
  max-width: none;
}

.category-sidebar { 
  background-color: var(--color-bg-panel); 
  display: flex; 
  flex-direction: column; 
  padding: 0.5rem 0; 
  width: 68px;
  min-width: 68px;
  max-width: 68px;
  transition: none; 
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.category-sidebar::-webkit-scrollbar {
  width: 3px;
}

.category-sidebar::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.category-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.category-sidebar.collapsed { 
  width: 68px;
  min-width: 68px;
  max-width: 68px;
}

.category-tab { 
  display: flex; 
  flex-direction: column;
  align-items: center; 
  gap: 0.25rem; 
  padding: 0.5rem 0.25rem; 
  border: none; 
  background: none; 
  cursor: pointer; 
  transition: all 0.2s ease; 
  color: var(--color-text-primary); 
  min-height: 52px;
  border-radius: 8px;
  margin: 2px;
}

.category-tab:hover { 
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); 
  color: var(--color-primary); 
}

.category-tab.active { 
  background-color: var(--color-primary); 
  color: var(--color-bg-card); 
}

.tab-icon { 
  width: 20px; 
  height: 20px; 
  flex-shrink: 0; 
}

.tab-label { 
  font-size: 0.75rem;
  text-align: center; 
  white-space: nowrap; 
  transition: opacity 0.3s ease;
  line-height: 1.1;
  word-break: keep-all;
}

.category-sidebar.collapsed .tab-label { 
  display: block;
}

.items-display { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  min-height: 0; 
  min-width: 0;
  opacity: 1;
  visibility: visible;
  transition: opacity 0.15s ease-out, width 0.2s ease-out;
}

.items-controls { 
  display: flex; 
  gap: 0.5rem; 
  padding: 0.75rem 1rem; 
  background-color: var(--color-bg-panel); 
  flex-wrap: wrap;
  align-items: center;
}

.filter-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-card);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.filter-toggle-btn:hover {
  border-color: var(--color-primary);
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.filter-toggle-btn.active {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
  color: var(--color-bg-card);
}

.filter-toggle-btn .filter-icon {
  width: 18px;
  height: 18px;
}

.filter-toggle-btn .filter-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  background-color: var(--color-error);
  color: var(--color-bg-main);
  border-radius: 50%;
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.sort-select {
  flex: 1;
  max-width: 80px;
}

.filter-panel {
  background-color: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filter-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.filter-clear-btn {
  font-size: 0.75rem;
  color: var(--color-primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.filter-clear-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.filter-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.filter-checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.45rem;
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
}

.filter-checkbox-item:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

/* checkbox 樣式由 App.vue 全局管理 */

.tag-item {
  background-color: color-mix(in srgb, var(--color-bg-panel) 20%, transparent);
}

.tag-item:hover {
  background-color: color-mix(in srgb, var(--color-bg-panel) 30%, transparent);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-main);
  font-size: 0.8rem;
  color: var(--color-text-primary);
  transition: border-color 0.2s;
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.items-grid-container { 
  flex: 1; 
  overflow-y: auto; 
  position: relative; 
  padding-inline: clamp(0.75rem, 1vw, 1.25rem);
  padding-top: 0.5rem;
  padding-bottom: 1.6rem;
  min-height: 0;
}

.items-grid-container::-webkit-scrollbar {
  width: 5px;
}

.items-grid-container::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.items-grid-container::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.items-grid-container::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-border) 80%, var(--color-text-primary));
}

.items-grid-sizer { 
  position: relative; 
  width: 100%; 
}

.items-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); 
  gap: 12px; 
  padding: 0; 
  position: absolute; 
  width: 100%;
  border-right: none !important;
  box-shadow: none !important;
}

.grid-item { 
  cursor: pointer; 
  border-radius: 8px; 
  overflow: hidden; 
  transition: all 0.2s ease; 
  border: 2px solid transparent; 
  min-height: 0;
}

@media (hover: hover) {
  .grid-item:hover { 
    transform: scale(1.05); 
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-text-primary) 15%, transparent); 
  }
}

.item-card { 
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent); 
}

.item-card.equipped { 
  border-color: var(--color-primary); 
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent); 
}

.outfit-card { 
  background: linear-gradient(135deg, var(--color-info) 0%, color-mix(in srgb, var(--color-info) 70%, transparent) 100%); 
  color: var(--color-bg-main); 
}

.item-thumbnail { 
  aspect-ratio: 1; 
  position: relative; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  overflow: hidden; 
}

.item-thumbnail img { 
  width: 100%; 
  height: 100%; 
  object-fit: contain; 
}

.preview-icon { 
  font-size: 2rem; 
  opacity: 0.9; 
}

.equipped-badge { 
  position: absolute; 
  top: 4px; 
  right: 4px; 
  width: 20px; 
  height: 20px; 
  background-color: var(--color-primary); 
  color: var(--color-bg-main); 
  border-radius: 50%; 
  font-size: 0.7rem; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  font-weight: bold; 
}

.variant-indicator {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background-color: var(--color-warning);
  color: var(--color-bg-main);
  border-radius: 50%;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  cursor: help;
}

.item-card.has-variant {
  border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
}

.item-card.highlighted {
  animation: highlight-flash 0.6s ease-in-out 5;
  border-color: var(--color-success);
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-success) 50%, transparent);
}

@keyframes highlight-flash {
  0%, 100% {
    border-color: var(--color-success);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-success) 50%, transparent);
  }
  50% {
    border-color: transparent;
    box-shadow: none;
  }
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
  z-index: 10000;
}

.context-menu {
  position: fixed;
  min-width: 180px;
  max-width: 250px;
  background: var(--color-bg-card);
  border-radius: 12px;
  box-shadow: 0 8px 32px color-mix(in srgb, var(--color-text-primary) 25%, transparent);
  overflow: hidden;
  z-index: 10001;
}

.context-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.9rem;
  background: var(--color-primary);
  color: var(--color-bg-main);
}

.context-menu-title {
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.context-menu-close {
  background: none;
  border: none;
  color: var(--color-bg-main);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.context-menu-close:hover {
  opacity: 1;
}

.context-menu-content {
  max-height: 350px;
  overflow-y: auto;
  padding: 0.5rem;
}

.context-menu-section {
  margin-bottom: 0.5rem;
}

.context-menu-section-title {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  padding: 0.25rem 0.5rem;
  text-transform: uppercase;
}

.context-menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0.5rem 0;
}

.context-menu-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: left;
  font-size: 0.85rem;
  color: var(--color-text-primary);
}

.context-menu-option:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
}

.context-menu-option.variant-option:hover {
  background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
}

.context-menu-option.variant-option.active {
  background-color: var(--color-bg-main);
  font-weight: 600;
}

.context-menu-option.danger {
  color: var(--color-error);
}

.context-menu-option.danger:hover {
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
}

.context-menu-option .option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  flex-shrink: 0;
}

.context-menu-option .option-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.context-menu-option .option-name {
  flex: 1;
  color: var(--color-text-primary);
}

.hide-toggle {
  background-color: color-mix(in srgb, var(--color-warning) 10%, transparent) !important;
  border: 1px dashed var(--color-warning) !important;
}

.hidden-count {
  font-size: 0.75rem;
  color: var(--color-warning);
  margin-left: 0.25rem;
}

.variant-option.active .variant-option-name {
  font-weight: 600;
  color: color-mix(in srgb, var(--color-warning) 90%, transparent);
}

.mobile-item-details {
  background: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
  border-radius: 8px;
  padding: 0.5rem !important;
  margin: 0.25rem 0;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.85rem;
}

.detail-label {
  color: var(--color-text-secondary);
  flex-shrink: 0;
  min-width: 50px;
}

.detail-value {
  color: var(--color-text-primary);
  word-break: break-word;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.detail-tag {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  background-color: color-mix(in srgb, var(--color-bg-panel) 20%, transparent);
  color: var(--color-primary);
  border-radius: 8px;
}


.item-info { 
  padding: 0.4rem 0.45rem; 
  display: flex; 
  flex-direction: column; 
  gap: 0.2rem; 
  background-color: var(--color-bg-card); 
  min-height: 58px;
}

.item-meta-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.16rem;
}

.item-tag {
  font-size: 0.58rem;
  padding: 0.1rem 0.28rem;
  background-color: color-mix(in srgb, var(--color-bg-panel) 20%, transparent);
  color: var(--color-primary);
  border-radius: 8px;
  white-space: nowrap;
}

.item-name { 
  font-size: 0.78rem; 
  font-weight: 500; 
  color: var(--color-text-primary); 
  line-height: 1.15; 
  display: -webkit-box; 
  -webkit-line-clamp: 1; 
  -webkit-box-orient: vertical; 
  overflow: hidden; 
}

.item-pack-name, .outfit-date { 
  font-size: 0.68rem; 
  color: var(--color-text-secondary); 
  line-height: 1; 
}

.outfit-preview {
  background: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
}

.outfit-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px 6px 0 0;
}

.outfit-card .item-name, .outfit-card .outfit-date { 
  color: var(--color-text-primary); 
}

.empty-state { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  height: 200px; 
  color: var(--color-text-secondary);
  background-color: var(--color-bg-card);
}

.empty-icon { 
  font-size: 3rem; 
  margin-bottom: 1rem; 
  opacity: 0.5; 
}

.mobile-bottom-sheet {
  z-index: 90;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -12px 30px color-mix(in srgb, var(--color-text-primary) 18%, transparent);
  width: 100%;
  max-width: 100vw;
  margin: 0 auto;
  border-right: none;
  background-color: var(--color-bg-panel);
}

.mobile-wardrobe {
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-panel);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  transition: max-height 0.25s ease-out;
  max-height: 170px;
  min-height: 0;
  overflow: hidden;
}

.mobile-wardrobe.collapsed {
  max-height: 36px;
  min-height: 36px;
}

.mobile-wardrobe.collapsed .mobile-wardrobe-body {
  display: none;
}

.mobile-wardrobe.collapsed .mobile-drawer-toggle {
  padding: 0.35rem 0.75rem 0.4rem;
}

.mobile-drawer-toggle {
  width: 100%;
  background: none;
  border: none;
  padding: 0.35rem 0.75rem 0.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  position: sticky;
  top: 0;
  background: var(--color-bg-panel);
  z-index: 2;
}

.drawer-handle {
  width: 36px;
  height: 4px;
  background: var(--color-border);
  border-radius: 999px;
  display: inline-block;
  position: relative;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.drawer-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  display: none;
}

.drawer-icon {
  font-size: 0.7rem;
}

.mobile-wardrobe-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0 0.75rem 0.5rem;
}

.mobile-categories {
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid var(--color-border);
}

.categories-scroll {
  display: flex;
  flex-direction: row;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
  width: 100%;
}

.mobile-category-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.45rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

@media (hover: hover) {
  .mobile-category-tab:hover {
    border-color: var(--color-primary);
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}

.mobile-category-tab.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-bg-card);
  padding: 0.4rem 0.65rem;
}

.mobile-tab-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.mobile-tab-label {
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  transition: max-width 0.2s ease, opacity 0.2s ease;
}

.mobile-tab-label.visible {
  max-width: 120px;
  opacity: 1;
}

.mobile-items-scroll {
  display: flex;
  gap: 0.6rem;
  padding: 0.25rem 0.1rem 0.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: center;
  overscroll-behavior: contain;
  touch-action: pan-x;
}

.mobile-items-scroll::-webkit-scrollbar,
.categories-scroll::-webkit-scrollbar {
  height: 4px;
}

.mobile-items-scroll::-webkit-scrollbar-track,
.categories-scroll::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 2px;
}

.mobile-items-scroll::-webkit-scrollbar-thumb,
.categories-scroll::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.mobile-items-scroll::-webkit-scrollbar-thumb:hover,
.categories-scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-border) 80%, var(--color-text-primary));
}

.mobile-wardrobe-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.75rem;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
}

.mobile-item {
  width: 64px;
  height: 64px;
  background-color: rgba(var(--color-bg-canvas-rgb, 255, 251, 245), 0.6);
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  overflow: visible;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

@media (hover: hover) {
  .mobile-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  }
}

.mobile-item.equipped {
  border-color: var(--color-primary);
  background-color: rgba(var(--color-text-primary-rgb, 71, 45, 37), 0.3);
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

.mobile-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.mobile-equipped-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background-color: var(--color-primary);
  color: var(--color-bg-main);
  border-radius: 50%;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.mobile-variant-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  background-color: rgba(245, 158, 11, 0.9);
  background-color: var(--color-warning);
  color: var(--color-bg-main);
  border-radius: 50%;
  font-size: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  pointer-events: none;
}

.mobile-item.has-variant {
  border-color: rgba(245, 158, 11, 0.5);
}

@supports (color: color-mix(in srgb, red, blue)) {
  .mobile-item.has-variant {
    border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
  }
}

.mobile-outfit-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 80px;
  height: auto;
  min-height: 80px;
  padding: 0.35rem 0.25rem;
}

.mobile-outfit-item img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
}

.mobile-outfit-icon {
  font-size: 1.5rem;
}

.mobile-outfit-name {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
  word-break: break-all;
}

.wardrobe-content:has(.category-sidebar.collapsed) .items-display {
  display: none;
}

@media (max-width: 767px) {
  .wardrobe {
    min-width: unset;
  }

  .mobile-wardrobe {
    max-height: clamp(140px, 28vh, 260px);
    transition: max-height 0.3s ease;
  }
  
  .mobile-wardrobe.collapsed {
    max-height: 36px;
    min-height: 36px;
  }

  .mobile-category-tab {
    padding: 0.35rem 0.55rem;
  }

  .mobile-tab-icon {
    width: 16px;
    height: 16px;
  }

  .mobile-tab-label.visible {
    max-width: 96px;
  }

  .mobile-items-scroll {
    gap: 0.45rem;
  }

  .mobile-item {
    width: 58px;
    height: 58px;
  }

  .mobile-equipped-badge {
    width: 14px;
    height: 14px;
    font-size: 0.6rem;
  }

  .mobile-variant-indicator {
    width: 12px;
    height: 12px;
    font-size: 0.45rem;
  }

  .context-menu {
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%);
    max-height: 80vh;
    max-height: 80dvh;
    max-width: calc(100vw - 32px);
    width: 260px;
    display: flex;
    flex-direction: column;
  }

  .context-menu-content {
    max-height: none;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .left-panel {
    width: clamp(160px, 22vw, 220px);
  }
  
  .left-panel.collapsed {
    width: 44px;
  }
  
  .category-sidebar {
    width: 40px;
  }
  
  .category-tab {
    width: 34px;
    height: 34px;
    border-radius: 6px;
  }
  
  .tab-icon {
    width: 16px;
    height: 16px;
  }
  
  .tab-label {
    font-size: 0.7rem;
    width: 100%;
    display: block;
    text-align: center;
  }
  
  .items-controls {
    padding: 0.5rem;
    gap: 0.35rem;
  }
  
  .filter-toggle-btn {
    width: 32px;
    height: 32px;
  }
  
  .filter-select {
    padding: 0.4rem;
    font-size: 0.8rem;
    min-width: 100px;
  }
  
  .filter-panel {
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }
  
  .filter-section-title {
    font-size: 0.8rem;
  }
  
  .filter-checkbox-item {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }
  
  .checkbox-custom {
    width: 12px;
    height: 12px;
  }
  
  .items-grid { 
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); 
    gap: 12px; 
  }

  .items-grid .grid-item {
    border-width: 1.5px;
    border-radius: 6px;
  }
  
  .items-grid .item-info {
    padding: 0.35rem;
  }
  
  .item-name {
    font-size: 0.72rem;
  }
  
  .item-pack-name, .outfit-date {
    font-size: 0.65rem;
  }
  
  .equipped-badge {
    width: 18px;
    height: 18px;
    font-size: 0.65rem;
  }
  
  .variant-indicator {
    width: 16px;
    height: 16px;
    font-size: 0.55rem;
  }
  
  .empty-state {
    height: 150px;
  }
  
  .empty-icon {
    font-size: 2rem;
    margin-bottom: 0.75rem;
  }
  
  .variant-menu {
    min-width: 140px;
    max-width: 200px;
  }
  
  .variant-menu-header {
    padding: 0.6rem 0.8rem;
  }
  
  .variant-menu-title {
    font-size: 0.85rem;
  }
  
  .variant-option {
    padding: 0.6rem;
    gap: 0.5rem;
  }
  
  .variant-option-name {
    font-size: 0.8rem;
  }
}

.tablet-style {
  height: 100%;
  transition: width 0.2s ease-out, min-width 0.2s ease-out, max-width 0.2s ease-out;
  display: flex;
  flex-direction: column;
}

.tablet-style .category-sidebar {
  width: 64px;
  min-width: 64px;
  max-width: 64px;
  align-items: center;
  padding: 0.4rem 0.2rem;
  transition: none;
}

.tablet-style .category-tab {
  padding: 0.35rem 0.25rem;
  min-height: 48px;
  width: calc(100% - 8px);
  border-radius: 8px;
  margin: 3px auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
  gap: 0.15rem;
}

.tablet-style .category-tab.active {
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-border) 70%, transparent);
}

.tablet-style .tab-icon {
  width: 18px;
  height: 18px;
}

.tablet-style .tab-label {
  font-size: 0.7rem;
  line-height: 1.15;
  white-space: normal;
  text-align: center;
  width: 100%;
  overflow: visible;
  text-overflow: clip;
  transform-origin: center;
  transform: scale(1);
  display: block;
  margin-top: 1px;
  word-break: keep-all;
}

.tablet-style.collapsed {
  width: 100%;
}

.tablet-style.collapsed .items-display {
  width: 0;
  min-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}

.tablet-style.collapsed .category-sidebar {
  width: 64px;
  min-width: 64px;
  max-width: 64px;
}

.tablet-style .wardrobe-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tablet-style .desktop-wardrobe {
  flex: 1;
  display: flex;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.tablet-style .category-sidebar {
  flex-shrink: 0;
}

.tablet-style .items-display {
  flex: 1 1 0;
  min-width: 0;
  width: 0;
  display: flex;
  flex-direction: column;
}

.tablet-style .items-grid-container {
  flex: 1;
  padding-inline: 0.5rem;
}

.tablet-style .items-grid {
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 8px;
}

.tablet-style .grid-item {
  min-height: 0;
}

.tablet-style .item-thumbnail {
  aspect-ratio: 1;
}

.tablet-style .panel-toggle-handle--right {
  display: flex;
}
</style>

