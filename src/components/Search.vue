<template>
  <div class="search-modal" @click.stop>
    <div class="search-header">
      <h3>🔍 全局搜尋</h3>
      <button @click="$emit('close')" class="close-btn" title="關閉">×</button>
    </div>
    <div class="search-input-wrapper">
      <input 
        v-model="keyword" 
        placeholder="搜尋物件、搭配、圖包..." 
        ref="searchInput"
        @input="debounceSearch"
      />
    </div>

    <div class="search-results-wrapper">
      <!-- 物件 -->
      <div v-if="results.items.length > 0" class="result-section">
        <h4>物件 ({{ results.items.length }})</h4>
        <div class="result-list">
          <div v-for="item in results.items" :key="item.id" class="result-item" @click="handleItemClick(item)">
            <img :src="item.imageData" class="item-thumb" />
            <span class="item-name">{{ item.displayName }}</span>
            <button class="action-btn" @click.stop="gameStore.wearItem(item)">穿上</button>
          </div>
        </div>
      </div>
      <!-- 搭配 -->
      <div v-if="results.outfits.length > 0" class="result-section">
        <h4>搭配 ({{ results.outfits.length }})</h4>
        <div class="result-list">
          <div v-for="outfit in results.outfits" :key="outfit.id" class="result-item" @click="handleOutfitClick(outfit)">
            <span class="item-thumb">⭐</span>
            <span class="item-name">{{ outfit.name }}</span>
            <button class="action-btn" @click.stop="handleOutfitClick(outfit)">載入</button>
          </div>
        </div>
      </div>
      <!-- 無結果 -->
      <div v-if="keyword && !isSearching && totalResults === 0" class="no-results">
        <p>找不到關於 "{{ keyword }}" 的結果</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { useGameStore } from '../store/index.js';

const emit = defineEmits(['close']);
const gameStore = useGameStore();
const searchInput = ref(null);
const keyword = ref('');
const isSearching = ref(false);
const results = reactive({ items: [], outfits: [] });
let debounceTimer = null;

const totalResults = computed(() => results.items.length + results.outfits.length);

const performSearch = async () => {
  if (!keyword.value.trim()) {
    results.items = [];
    results.outfits = [];
    return;
  }
  isSearching.value = true;
  const searchTerm = keyword.value.toLowerCase();
  
  // 搜尋物件
  results.items = gameStore.wardrobeItems.filter(item => 
    item.displayName.toLowerCase().includes(searchTerm) || 
    item.packName.toLowerCase().includes(searchTerm)
  );
  
  // 搜尋搭配
  results.outfits = gameStore.savedOutfits.filter(outfit => 
    outfit.name.toLowerCase().includes(searchTerm)
  );

  isSearching.value = false;
};

const debounceSearch = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(performSearch, 300);
};

const handleItemClick = (item) => {
  gameStore.wearItem(item);
  emit('close');
};

const handleOutfitClick = (outfit) => {
  gameStore.loadOutfit(outfit);
  emit('close');
};

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
});
</script>

<style scoped>
/* 樣式與 Importer, Settings 保持一致 */
.search-modal { width: 500px; max-width: 90vw; background: white; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 80vh; }
.search-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid #e0e0e0; }
.search-header h3 { margin: 0; }
.close-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #888; }
.search-input-wrapper { padding: 1rem 1.5rem; border-bottom: 1px solid #e0e0e0; }
.search-input-wrapper input { width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid #ccc; font-size: 1rem; }
.search-results-wrapper { flex: 1; overflow-y: auto; padding: 1rem 1.5rem; }
.result-section h4 { margin-top: 0; margin-bottom: 0.5rem; }
.result-list { display: flex; flex-direction: column; gap: 0.5rem; }
.result-item { display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border-radius: 6px; cursor: pointer; transition: background-color 0.2s; }
.result-item:hover { background-color: #f0f2f5; }
.item-thumb { width: 40px; height: 40px; object-fit: contain; background-color: #f0f2f5; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.item-name { flex: 1; }
.action-btn { padding: 0.4rem 0.8rem; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; }
.no-results { text-align: center; color: #888; padding: 2rem; }
</style>