<template>
  <div class="wardrobe-container">
    <!-- 摺疊按鈕 -->
    <button 
      @click="gameStore.toggleWardrobe()" 
      class="collapse-handle"
      :title="gameStore.ui.wardrobeCollapsed ? '展開衣櫃' : '收合衣櫃'"
    >
      <span class="icon">{{ gameStore.ui.wardrobeCollapsed ? '▶' : '◀' }}</span>
    </button>
    
    <!-- 衣櫃內容 (未摺疊時顯示) -->
    <div v-if="!gameStore.ui.wardrobeCollapsed" class="wardrobe-content">
      <div class="wardrobe-header">
        <h2>👗 衣櫃</h2>
      </div>
      
      <!-- 分類標籤 -->
      <div class="category-tabs">
        <button
          v-for="category in gameStore.categories"
          :key="category.key"
          :class="['category-tab', { active: activeCategory === category.key }]"
          @click="setActiveCategory(category.key)"
          :title="category.name"
        >
          <span class="category-icon">{{ category.icon }}</span>
          <span class="category-name">{{ category.name }}</span>
          <span v-if="getCategoryCount(category.key) > 0" class="category-count">
            {{ getCategoryCount(category.key) }}
          </span>
        </button>
      </div>
      
      <!-- 篩選與排序控制 -->
      <div class="controls-panel">
        <select v-model="selectedPack" class="filter-select" title="按圖包篩選">
          <option value="">所有圖包</option>
          <option v-for="pack in availablePacks" :key="pack.name" :value="pack.name">
            {{ pack.displayName || pack.name }}
          </option>
        </select>
        <select v-model="sortBy" class="filter-select" title="排序方式">
          <option value="name">按名稱</option>
          <option value="pack">按圖包</option>
          <option value="recent">最近加入</option>
        </select>
      </div>
      
      <!-- 物件列表容器 (虛擬滾動的核心) -->
      <div class="items-list-container" ref="scrollContainer" @scroll="handleScroll">
        <div class="items-list-sizer" :style="{ height: `${totalContentHeight}px` }">
          <div 
            v-if="activeCategory === 'starred'" 
            class="items-grid"
            :style="{ transform: `translateY(${visibleItems.offsetY}px)` }"
          >
            <div
              v-for="outfit in visibleItems.items"
              :key="`outfit-${outfit.id}`"
              class="grid-item outfit-card"
              @click="loadOutfit(outfit)"
            >
              <div class="item-thumbnail">
                <!-- 簡易預覽 -->
                <span class="preview-icon">⭐</span>
              </div>
              <div class="item-info">
                <span class="item-name">{{ outfit.name }}</span>
              </div>
            </div>
          </div>
          <div 
            v-else 
            class="items-grid"
            :style="{ transform: `translateY(${visibleItems.offsetY}px)` }"
          >
            <div
              v-for="item in visibleItems.items"
              :key="item.id"
              :class="['grid-item', 'item-card', { 
                'equipped': gameStore.isItemInCurrentOutfit(item),
                'expression-available': isExpressionAvailable(item)
              }]"
              @click="handleItemClick(item)"
            >
              <div class="item-thumbnail">
                <img :src="item.imageData" :alt="item.displayName" loading="lazy" />
                <div v-if="gameStore.isItemInCurrentOutfit(item)" class="equipped-badge">✓</div>
              </div>
              <div class="item-info">
                <span class="item-name" :title="item.displayName">{{ item.displayName }}</span>
                <span class="item-pack-name">{{ item.packName }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空狀態提示 -->
        <div v-if="filteredAndSortedItems.length === 0" class="empty-state">
           <div class="empty-icon">{{ currentCategoryIcon }}</div>
           <p>此分類暫無物件</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useGameStore } from '../store/index.js';

const gameStore = useGameStore();

// 響應式狀態
const activeCategory = ref('character');
const selectedPack = ref('');
const sortBy = ref('name');
const scrollContainer = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(600); // 預設值

// --- 虛擬滾動設定 ---
const ITEM_WIDTH = 100; // 物件卡片寬度
const ITEM_HEIGHT = 130; // 物件卡片高度
const GAP = 10; // 間距

// --- Computed: 數據處理 ---
const availablePacks = computed(() => gameStore.availablePacks);

const filteredAndSortedItems = computed(() => {
  let items;
  if (activeCategory.value === 'starred') {
    items = [...gameStore.savedOutfits];
  } else {
    items = gameStore.getItemsByCategory(activeCategory.value);
  }

  // 篩選
  if (selectedPack.value && activeCategory.value !== 'starred') {
    items = items.filter(item => item.packName === selectedPack.value);
  }

  // 排序
  items.sort((a, b) => {
    switch (sortBy.value) {
      case 'pack':
        return (a.packName || '').localeCompare(b.packName || '');
      case 'recent':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'name':
      default:
        return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    }
  });

  return items;
});

// --- Computed: 虛擬滾動計算 ---
const itemsPerRow = computed(() => {
  if (!scrollContainer.value) return 3;
  return Math.max(1, Math.floor(scrollContainer.value.clientWidth / (ITEM_WIDTH + GAP)));
});

const totalContentHeight = computed(() => {
  const rowCount = Math.ceil(filteredAndSortedItems.value.length / itemsPerRow.value);
  return rowCount * (ITEM_HEIGHT + GAP);
});

const visibleItems = computed(() => {
  const rowHeight = ITEM_HEIGHT + GAP;
  const totalRows = Math.ceil(filteredAndSortedItems.value.length / itemsPerRow.value);
  
  // 計算可見範圍
  const visibleStartRow = Math.floor(scrollTop.value / rowHeight);
  const visibleEndRow = Math.min(totalRows, visibleStartRow + Math.ceil(containerHeight.value / rowHeight) + 1); // +1 buffer
  
  const startIndex = visibleStartRow * itemsPerRow.value;
  const endIndex = Math.min(filteredAndSortedItems.value.length, visibleEndRow * itemsPerRow.value);

  return {
    items: filteredAndSortedItems.value.slice(startIndex, endIndex),
    offsetY: visibleStartRow * rowHeight
  };
});

// --- Computed: 其他輔助 ---
const currentCategoryIcon = computed(() => {
  return gameStore.categories.find(c => c.key === activeCategory.value)?.icon || '📦';
});

// --- 方法 ---
const setActiveCategory = (categoryKey) => {
  activeCategory.value = categoryKey;
  // 切換分類時滾動到頂部
  if (scrollContainer.value) scrollContainer.value.scrollTop = 0;
};

const getCategoryCount = (categoryKey) => {
  if (categoryKey === 'starred') return gameStore.savedOutfits.length;
  return gameStore.wardrobeItems.filter(item => item.category === categoryKey).length;
};

const handleItemClick = (item) => {
  if (gameStore.isItemInCurrentOutfit(item)) {
    gameStore.removeItem(item);
  } else {
    gameStore.wearItem(item);
  }
};

const loadOutfit = (outfit) => {
  gameStore.loadOutfit(outfit);
};

const isExpressionAvailable = (item) => {
  return item.category === 'expression' && 
         gameStore.selectedCharacterId && 
         item.characterId === gameStore.selectedCharacterId;
};

const handleScroll = (event) => {
  scrollTop.value = event.target.scrollTop;
};

// --- 生命週期 ---
onMounted(() => {
  // 監聽容器尺寸變化
  const resizeObserver = new ResizeObserver(entries => {
    containerHeight.value = entries[0].contentRect.height;
  });
  if (scrollContainer.value) {
    resizeObserver.observe(scrollContainer.value);
  }
});

watch(activeCategory, () => {
    scrollTop.value = 0;
    if (scrollContainer.value) scrollContainer.value.scrollTop = 0;
});
</script>


<style scoped>
.wardrobe-container {
  position: relative;
  height: 100%;
  display: flex;
}

.collapse-handle {
  position: absolute;
  top: 50%;
  right: -15px;
  transform: translateY(-50%);
  width: 30px;
  height: 60px;
  background-color: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--primary-color);
}

.wardrobe-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wardrobe-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}
.wardrobe-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}
.category-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border: none;
  border-radius: 20px;
  background-color: #f0f2f5;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}
.category-tab:hover { background-color: #e0e4e8; }
.category-tab.active { background-color: var(--primary-color); color: white; }
.category-icon { font-size: 1rem; }
.category-count {
  font-size: 0.7rem;
  background-color: rgba(0,0,0,0.1);
  border-radius: 10px;
  padding: 2px 6px;
  min-width: 18px;
  text-align: center;
}
.category-tab.active .category-count { background-color: rgba(255,255,255,0.2); }

.controls-panel {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}
.filter-select {
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: #fff;
}

.items-list-container {
  flex: 1;
  overflow-y: auto;
  position: relative;
}
.items-list-sizer {
  position: relative;
  width: 100%;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  padding: 10px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.grid-item {
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}
.grid-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.item-card.equipped {
  border-color: var(--primary-color);
  background-color: #e9e9ff;
}
.item-card.expression-available {
  box-shadow: 0 0 0 2px #4CAF50; /* 綠色高亮顯示可用表情 */
}

.item-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background-color: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.preview-icon { font-size: 2rem; }

.equipped-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background-color: var(--primary-color);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
}

.item-info {
  padding: 0.5rem;
  text-align: center;
  background-color: #fff;
}
.item-name {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-pack-name {
  display: block;
  font-size: 0.7rem;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #999;
}
.empty-icon { font-size: 3rem; }
</style>