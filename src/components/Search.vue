<template>
  <div class="search-modal modal-base modal-lg" @click.stop>
    <div class="modal-header">
      <h3><span class="title-icon" v-html="icons.search"></span> 全局搜尋</h3>
      <button @click="$emit('close')" class="close-btn" title="關閉">×</button>
    </div>
    
    <div class="search-input-wrapper">
      <div class="search-input-container">
        <span class="search-icon" v-html="icons.search"></span>
        <input 
          v-model="keyword" 
          placeholder="搜尋物件、搭配、圖包..." 
          ref="searchInput"
          @input="debounceSearch"
          class="search-input"
        />
        <button v-if="keyword" @click="clearSearch" class="clear-btn">×</button>
      </div>
    </div>

    <div class="search-results-wrapper">
      <!-- 搜尋中指示器 -->
      <div v-if="isSearching" class="searching-indicator">
        <div class="searching-spinner"></div>
        <span>搜尋中...</span>
      </div>
      
      <!-- 物件結果 -->
      <div v-if="results.items.length > 0" class="result-section">
        <h4 class="section-title">
          <span class="section-icon" v-html="icons.top"></span>
          物件 ({{ results.items.length }})
          <span class="section-hint">點選物件跳轉到衣櫃</span>
        </h4>
        <div class="result-list">
          <div v-for="item in results.items" :key="item.id" 
               class="result-item" 
               @click="handleItemClick(item)">
            <div class="item-thumbnail">
              <img :src="item.thumbnailData || item.imageData" :alt="item.displayName" />
              <div v-if="gameStore.isItemInCurrentOutfit(item)" class="equipped-indicator">✓</div>
            </div>
            <div class="item-details">
              <span class="item-name">{{ item.displayName }}</span>
              <span class="item-meta">{{ getItemMeta(item) }}</span>
            </div>
            <div class="item-actions">
              <button class="action-btn" 
                      @click.stop="toggleWear(item)"
                      :class="{ 'equipped': gameStore.isItemInCurrentOutfit(item) }">
                {{ gameStore.isItemInCurrentOutfit(item) ? '脫下' : '穿上' }}
              </button>

            </div>
          </div>
        </div>
      </div>
      
      <!-- 搭配結果 -->
      <div v-if="results.outfits.length > 0" class="result-section">
        <h4 class="section-title">
          <span class="section-icon" v-html="icons.starred"></span>
          搭配 ({{ results.outfits.length }})
        </h4>
        <div class="result-list">
          <div v-for="outfit in results.outfits" :key="outfit.id" 
               class="result-item" 
               @click="handleOutfitClick(outfit)">
            <div class="item-thumbnail outfit-thumbnail">
              <span class="outfit-icon" v-html="icons.starred"></span>
            </div>
            <div class="item-details">
              <span class="item-name">{{ outfit.name }}</span>
              <span class="item-meta">{{ formatDate(outfit.createdAt) }}</span>
            </div>
            <button class="action-btn" @click.stop="handleOutfitClick(outfit)">
              載入
            </button>
          </div>
        </div>
      </div>
      
      <!-- 圖包結果 -->
      <div v-if="results.packs.length > 0" class="result-section">
        <h4 class="section-title">
          <span class="section-icon" v-html="icons.import"></span>
          圖包 ({{ results.packs.length }})
        </h4>
        <div class="result-list">
          <div v-for="pack in results.packs" :key="pack.id" class="result-item pack-item">
            <div class="item-thumbnail pack-thumbnail">
              <span class="pack-icon" v-html="icons.import"></span>
            </div>
            <div class="item-details">
              <span class="item-name">{{ pack.displayName || pack.name }}</span>
              <span class="item-meta">{{ getPackItemCount(pack.id) }} 個物件</span>
            </div>
            <button class="action-btn pack-action" @click.stop="viewPack(pack)">
              查看
            </button>
          </div>
        </div>
      </div>
      
      <!-- 無結果 -->
      <div v-if="keyword && !isSearching && totalResults === 0" class="no-results">
        <div class="no-results-icon" v-html="icons.search"></div>
        <p class="no-results-text">找不到關於 "<strong>{{ keyword }}</strong>" 的結果</p>
        <p class="no-results-suggestion">嘗試使用不同的關鍵字或檢查拼寫</p>
      </div>
      
      <!-- 搜尋提示 -->
      <div v-if="!keyword" class="search-tips">
        <h4>搜尋提示</h4>
        <ul>
          <li>輸入物件名稱搜尋特定服裝</li>
          <li>輸入圖包名稱查找相關內容</li>
          <li>搜尋搭配名稱快速載入造型</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { useGameStore } from '../store/index.js';
import { icons } from '../icons.js';

const emit = defineEmits(['close']);
const gameStore = useGameStore();
const searchInput = ref(null);
const keyword = ref('');
const isSearching = ref(false);
const results = reactive({ items: [], outfits: [], packs: [] });
let debounceTimer = null;

const totalResults = computed(() => 
  results.items.length + results.outfits.length + results.packs.length
);

// 檢查物件的 tags 是否匹配搜尋關鍵字
const matchesTags = (item, searchTerm) => {
  if (!item.tags || item.tags.length === 0) return false;
  
  // 檢查 tag 的 key 或 name 是否包含搜尋詞
  return item.tags.some(tagKey => String(tagKey).toLowerCase().includes(searchTerm));
};

const performSearch = async () => {
  if (!keyword.value.trim()) {
    results.items = [];
    results.outfits = [];
    results.packs = [];
    return;
  }
  
  isSearching.value = true;
  const searchTerm = keyword.value.toLowerCase();
  
  try {
    results.items = gameStore.wardrobeItems.filter(item => 
      item.displayName?.toLowerCase().includes(searchTerm) ||
      getPackName(item)?.toLowerCase().includes(searchTerm) ||
      item.category?.toLowerCase().includes(searchTerm) ||
      matchesTags(item, searchTerm)  // 新增 tag 搜尋
    ).slice(0, 50);
    
    results.outfits = gameStore.savedOutfits.filter(outfit => 
      outfit.name?.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
    
    results.packs = gameStore.availablePacks.filter(pack =>
      (pack.displayName || pack.name || '').toLowerCase().includes(searchTerm) ||
      (pack.description || '').toLowerCase().includes(searchTerm)
    );
  } catch (error) {
    console.error('搜尋時發生錯誤:', error);
  } finally {
    isSearching.value = false;
  }
};

const debounceSearch = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(performSearch, 300);
};

const clearSearch = () => {
  keyword.value = '';
  results.items = [];
  results.outfits = [];
  results.packs = [];
  searchInput.value?.focus();
};

const handleItemClick = (item) => {
  // 點擊物件預設跳轉到衣櫃
  gotoWardrobe(item);
};

const toggleWear = (item) => {
  if (gameStore.isItemInCurrentOutfit(item)) {
    gameStore.removeItem(item);
  } else {
    gameStore.wearItem(item);
  }
};

const gotoWardrobe = (item) => {
  // 設置衣櫃的分類為物件所屬分類並關閉搜尋
  gameStore.setWardrobeCategory(item.category);
  gameStore.setCurrentPage('dressing');
  // 展開衣櫃
  if (gameStore.ui.wardrobeCollapsed) {
    gameStore.toggleWardrobe();
  }
  // 設置高亮物件 ID，讓衣櫃閃爍提示
  gameStore.setHighlightedItemId(item.id);
  emit('close');
  gameStore.showNotification(`📍 已跳轉到「${getCategoryName(item.category)}」分類`, 'info');
};

const getCategoryName = (category) => gameStore.getCategoryName(category);

const handleOutfitClick = (outfit) => {
  gameStore.loadOutfit(outfit);
  gameStore.setCurrentPage('dressing');
  emit('close');
};

const viewPack = (pack) => {
  gameStore.showNotification(`圖包 "${pack.displayName}" 包含 ${getPackItemCount(pack.id)} 個物件`, 'info');
  emit('close');
};

// 使用 store 中的共用方法
const getPackName = (item) => gameStore.getPackName(item);

const getItemMeta = (item) => {
  const packName = getPackName(item);
  const categoryName = gameStore.getCategoryName(item.category);
  return `${categoryName} · ${packName}`;
};

const getPackItemCount = (packId) => {
  return gameStore.wardrobeItems.filter(item => item.packId === packId).length;
};

const formatDate = (dateString) => gameStore.formatDate(dateString);

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
});
</script>

<style scoped>
/* ========================================
   Search.vue 樣式
   ----------------------------------------
   目錄：
   1. 搜尋輸入區
   2. 結果容器
   3. 搜尋指示器
   4. 結果區塊
   5. 物件項目
   6. 操作按鈕
   7. 無結果與提示
   8. 響應式設計
   ======================================== */

/* 繼承全局 modal-base, modal-header 樣式 */

/* ========================================
   1. 搜尋輸入區
   ======================================== */

.search-input-wrapper { 
  padding: 1rem 1.5rem; 
  border-bottom: 1px solid var(--color-border);
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-secondary);
  font-size: 1rem;
}

.search-input { 
  width: 100%; 
  padding: 0.75rem 2.5rem; 
  border-radius: var(--radius-md); 
  border: 1px solid var(--color-border); 
  font-size: 0.8rem;
  transition: border-color 0.2s ease;
  background: var(--color-bg-main);
  color: var(--color-text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.clear-btn {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 1.2rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: var(--transition-fast);
}

.clear-btn:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
}

/* ========================================
   2. 結果容器
   ======================================== */

.search-results-wrapper { 
  flex: 1; 
  overflow-y: auto; 
  padding: 1rem 1.5rem; 
}

/* ========================================
   3. 搜尋指示器
   ======================================== */

.searching-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--color-text-secondary);
}

.searching-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid color-mix(in srgb, var(--color-text-primary) 30%, transparent);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

/* ========================================
   4. 結果區塊
   ======================================== */

.result-section { 
  margin-bottom: 1.5rem; 
}

.section-title { 
  margin: 0 0 0.75rem 0; 
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.section-hint {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.result-list { 
  display: flex; 
  flex-direction: column; 
  gap: 0.5rem; 
}

/* ========================================
   5. 物件項目
   ======================================== */

.result-item { 
  display: flex; 
  align-items: center; 
  gap: 1rem; 
  padding: 0.75rem; 
  border-radius: var(--radius-md); 
  cursor: pointer; 
  transition: var(--transition-fast);
  border: 1px solid transparent;
}

.result-item:hover { 
  background-color: color-mix(in srgb, var(--color-text-primary) 15%, transparent);
  border-color: var(--color-border);
}

.item-thumbnail { 
  width: 48px; 
  height: 48px; 
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent); 
  border-radius: var(--radius-sm); 
  display: flex; 
  align-items: center; 
  justify-content: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.outfit-thumbnail, .pack-thumbnail {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-bg-canvas) 60%, transparent) 0%, color-mix(in srgb, var(--color-text-primary) 30%, transparent) 100%);
}

.equipped-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border-radius: var(--radius-full);
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-details { 
  flex: 1;
  min-width: 0;
}

.item-name { 
  display: block;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta { 
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

/* ========================================
   6. 操作按鈕
   ======================================== */

.action-btn { 
  padding: 0.5rem 0.9rem; 
  border: 1px solid var(--color-border); 
  background: var(--color-bg-card); 
  border-radius: var(--radius-sm); 
  cursor: pointer;
  font-size: 0.85rem;
  transition: var(--transition-fast);
  flex-shrink: 0;
}

.action-btn:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  border-color: var(--color-primary);
}

.action-btn.equipped {
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border-color: var(--color-primary);
}

.goto-btn {
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.goto-btn:hover {
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border-color: var(--color-primary);
}

.pack-action {
  background-color: var(--color-warning);
  color: var(--color-bg-main);
  border-color: var(--color-warning);
}

.pack-action:hover {
  background-color: color-mix(in srgb, var(--color-warning) 85%, transparent);
}

/* ========================================
   7. 無結果與提示
   ======================================== */

.no-results { 
  text-align: center; 
  color: var(--color-text-secondary); 
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.no-results-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.no-results-text {
  font-size: 1rem;
  margin: 0;
}

.no-results-suggestion {
  font-size: 0.85rem;
  opacity: 0.7;
  margin: 0;
}

.search-tips {
  padding: 2rem;
  color: var(--color-text-secondary);
}

.search-tips h4 {
  margin: 0 0 1rem 0;
  color: var(--color-text-primary);
}

.search-tips ul {
  margin: 0;
  padding-left: 1.5rem;
  line-height: 1.6;
}

/* ========================================
   8. 響應式設計
   ======================================== */

@media (max-width: 767px) {
  .search-modal {
    width: 100vw;
    max-width: 100vw;
    /* iOS Safari 100vh 修復 */
    height: 100vh;
    height: 100dvh;
    height: calc(var(--vh, 1vh) * 100);
    max-height: 100vh;
    max-height: 100dvh;
    max-height: calc(var(--vh, 1vh) * 100);
    border-radius: 0;
  }
  
  .search-input-wrapper {
    padding: 0.75rem 1rem;
    /* iOS 安全區域支援 */
    padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
  }
  
  .search-results-wrapper {
    padding: 0.75rem 1rem;
    /* iOS 安全區域支援 */
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
  }
  
  .result-item {
    gap: 0.75rem;
    padding: 0.6rem;
  }
  
  .item-thumbnail {
    width: 40px;
    height: 40px;
  }
  
  .action-btn {
    padding: 0.4rem 0.7rem;
    font-size: 0.8rem;
  }
}
</style>

