<template>
  <div class="help-modal modal-base modal-lg" @click.stop>
    <div class="modal-header">
      <h3><span class="title-icon" v-html="icons.help"></span> 使用說明</h3>
      <button @click="$emit('close')" class="close-btn" title="關閉">×</button>
    </div>
    
    <div class="help-content">
      <!-- 目錄 Tab -->
      <div class="help-tabs" ref="helpTabs" @wheel="handleTabsScroll">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          :class="['help-tab', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon" v-html="tab.icon"></span>
          <span class="tab-label">{{ tab.name }}</span>
        </button>
      </div>
      
      <!-- Tab 內容 -->
      <div class="help-tab-content">
        <!-- 快速入門 -->
        <div v-if="activeTab === 'quickstart'" class="help-section">
          <h4><span class="section-icon" v-html="icons.rocket"></span> 快速入門</h4>
          <div class="help-text">
            <p>歡迎使用紙娃娃換裝系統！以下是基本使用步驟：</p>
            <ol>
              <li><strong>匯入圖包</strong>：點擊右上角設定圖標，選擇「匯入圖包」載入素材</li>
              <li><strong>選擇物件</strong>：在左側衣櫃中點選分類，再點擊物件即可穿戴</li>
              <li><strong>調整圖層</strong>：使用底部物件選單調整物件層級順序</li>
              <li><strong>儲存搭配</strong>：點擊「★ 儲存搭配」將當前造型保存</li>
            </ol>
          </div>
        </div>
        
        <!-- 操作說明 -->
        <div v-if="activeTab === 'controls'" class="help-section">
          <h4><span class="section-icon" v-html="icons.gamepad"></span> 操作說明</h4>
          <div class="help-text">
            <h5>工具列按鈕</h5>
            <ul class="toolbar-list">
              <li><span class="toolbar-icon" v-html="icons.clear"></span><strong>清空畫布</strong>：移除畫布上所有已穿戴的物件</li>
              <li><span class="toolbar-icon" v-html="icons.reset"></span><strong>重置位置</strong>：將所有物件恢復到預設位置與大小</li>
              <li><span class="toolbar-icon" v-html="icons.hand"></span><strong>手型工具</strong>：啟用後可拖曳畫布平移視角，也可用滑鼠中鍵觸發</li>
              <li><span class="toolbar-icon" v-html="icons.download"></span><strong>儲存圖像</strong>：將目前畫布匯出為 PNG 圖片下載</li>
            </ul>

            <h5>滑鼠操作</h5>
            <ul>
              <li><strong>左鍵點擊</strong>：穿戴/脫下物件、選取物件</li>
              <li><strong>右鍵點擊</strong>：開啟物件選單（變體選擇、隱藏、重新命名等）</li>
              <li><strong>滾輪</strong>：縮放畫布</li>
              <li><strong>拖曳</strong>：在自由模式下移動物件</li>
            </ul>
            
            <h5>觸控操作（手機/平板）</h5>
            <ul>
              <li><strong>點擊</strong>：穿戴/脫下物件</li>
              <li><strong>長按</strong>：開啟物件選單</li>
              <li><strong>雙指捏合</strong>：縮放畫布</li>
            </ul>
          </div>
        </div>
        
        <!-- 模式說明 -->
        <div v-if="activeTab === 'modes'" class="help-section">
          <h4><span class="section-icon" v-html="icons.sliders"></span> 模式說明</h4>
          <div class="help-text">
            <h5>固定模式</h5>
            <p>物件會固定在預設位置，適合標準換裝。</p>
            
            <h5>自由模式</h5>
            <p>允許自由移動、縮放和旋轉物件：</p>
            <ul>
              <li><strong>移動</strong>：拖曳物件到任意位置</li>
              <li><strong>縮放</strong>：啟用縮放後，拖曳角落的縮放手柄</li>
              <li><strong>旋轉</strong>：啟用旋轉後，拖曳旋轉手柄</li>
              <li><strong>翻轉</strong>：使用「左右」「上下」按鈕翻轉選中物件</li>
            </ul>
          </div>
        </div>
        
        <!-- 衣櫃功能 -->
        <div v-if="activeTab === 'wardrobe'" class="help-section">
          <h4><span class="section-icon" v-html="icons.closet"></span> 衣櫃功能</h4>
          <div class="help-text">
            <h5>分類瀏覽</h5>
            <p>左側分類欄按物件類型分類，點擊圖標切換分類。</p>
            
            <h5>篩選與排序</h5>
            <ul>
              <li><strong>圖包篩選</strong>：只顯示特定圖包的物件</li>
              <li><strong>標籤篩選</strong>：按物件屬性標籤篩選</li>
              <li><strong>排序</strong>：按名稱、圖包或加入時間排序</li>
            </ul>
            
            <h5>物件管理</h5>
            <ul>
              <li><strong>隱藏物件</strong>：右鍵選擇「隱藏」可暫時隱藏不需要的物件</li>
              <li><strong>重新命名</strong>：右鍵選擇「重新命名」修改物件顯示名稱</li>
            </ul>
            
            <h5>變體切換</h5>
            <p>部分物件提供多種外觀變體，可在同一件物件上切換不同樣式。</p>
            <ul>
              <li><span class="variant-diamond">◆</span> 帶有此菱形標記的物件代表<strong>擁有變體</strong></li>
              <li>在桌面版<strong>右鍵點擊</strong>物件，或在手機版<strong>長按</strong>物件，即可開啟選單並選擇變體</li>
              <li>物件列表中會顯示目前使用的變體名稱，例如「長辮 (預設)」</li>
            </ul>
          </div>
        </div>
        
        <!-- 常見問題 -->
        <div v-if="activeTab === 'faq'" class="help-section">
          <h4><span class="section-icon" v-html="icons.questionCircle"></span> 常見問題</h4>
          <div class="help-text">
            <div class="faq-item">
              <p class="faq-question">Q: 如何製作自己的圖包？</p>
              <p class="faq-answer">A: 圖包需要遵循特定格式，請參考專案說明文件或範例圖包結構。</p>
            </div>
            
            <div class="faq-item">
              <p class="faq-question">Q: 資料存在哪裡？</p>
              <p class="faq-answer">A: 所有資料存儲在瀏覽器的 IndexedDB 中，清除瀏覽器資料會導致資料遺失。建議定期匯出備份。</p>
            </div>
            
            <div class="faq-item">
              <p class="faq-question">Q: 如何備份資料？</p>
              <p class="faq-answer">A: 在設定中點擊「匯出全部資料」可將所有資料匯出為檔案備份。</p>
            </div>
          </div>
        </div>

        <!-- 隱私權政策 -->
        <div v-if="activeTab === 'privacy'" class="help-section">
          <h4><span class="section-icon" v-html="icons.shield"></span> 隱私權政策</h4>
          <div class="help-text">
            <p>本應用重視您的隱私。以下是重點摘要：</p>
            <ul>
              <li><strong>本地儲存</strong>：所有資料預設存儲在您的瀏覽器中，不會自動上傳至任何伺服器</li>
              <li><strong>Google 雲端硬碟</strong>：僅在您主動授權時才會存取，且僅限本應用建立的檔案</li>
              <li><strong>不追蹤</strong>：我們不收集個人身分資訊、不使用 Cookie、不進行行為追蹤</li>
              <li><strong>您的權利</strong>：您可以隨時刪除本地資料或撤銷雲端授權</li>
            </ul>
            <p class="privacy-full-link">
              <a href="#/privacy" target="_blank" rel="noopener noreferrer">
                📄 查看完整隱私權政策（獨立頁面）
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { icons } from '../icons.js';

defineEmits(['close']);

const activeTab = ref('quickstart');
const helpTabs = ref(null);

// 滾輪轉橫向滾動
const handleTabsScroll = (event) => {
  if (helpTabs.value) {
    event.preventDefault();
    helpTabs.value.scrollLeft += event.deltaY;
  }
};

const tabs = [
  { id: 'quickstart', name: '快速入門', icon: icons.rocket },
  { id: 'controls', name: '操作說明', icon: icons.gamepad },
  { id: 'modes', name: '模式說明', icon: icons.sliders },
  { id: 'wardrobe', name: '衣櫃功能', icon: icons.closet },
  { id: 'faq', name: '常見問題', icon: icons.questionCircle },
  { id: 'privacy', name: '隱私權政策', icon: icons.shield },
];
</script>

<style scoped>
/* ========================================
   Help.vue 樣式
   ----------------------------------------
   目錄：
   1. 內容容器
   2. Tab 標籤列
   3. Tab 內容區
   4. 說明文字
   5. FAQ 樣式
   6. 響應式設計
   ======================================== */

/* ========================================
   1. 內容容器
   ======================================== */

.help-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* ========================================
   2. Tab 標籤列
   ======================================== */

.help-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  flex-shrink: 0;
}

/* 自訂橫向滾動條（與物件列表同粗細） */
.help-tabs::-webkit-scrollbar {
  height: 6px;
}

.help-tabs::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.help-tabs::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.help-tabs::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary);
}

.help-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.help-tab:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  color: var(--color-text-primary);
}

.help-tab.active {
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border-color: var(--color-primary);
}

.tab-icon {
  font-size: 1rem;
  display: flex;
  align-items: center;
}

.tab-icon :deep(svg) {
  width: 1em;
  height: 1em;
}

/* ========================================
   3. Tab 內容區
   ======================================== */

.help-tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
}

.help-section h4 {
  margin: 0 0 1rem 0;
  color: var(--color-text-primary);
  font-size: 1.1rem;
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-icon {
  display: flex;
  align-items: center;
  color: var(--color-primary);
}

.section-icon :deep(svg) {
  width: 1.2em;
  height: 1.2em;
}

/* ========================================
   4. 說明文字
   ======================================== */

.help-text {
  color: var(--color-text-primary);
  line-height: 1.7;
}

.help-text h5 {
  margin: 1.25rem 0 0.5rem 0;
  color: var(--color-primary);
  font-size: 0.95rem;
}

.help-text p {
  margin: 0.5rem 0;
}

.help-text ul, .help-text ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.help-text li {
  margin: 0.35rem 0;
}

.help-text strong {
  color: var(--color-primary);
}

/* 工具列按鈕說明樣式 */
.toolbar-list {
  list-style: none;
  padding-left: 0;
}

.toolbar-list li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.5rem 0;
}

.toolbar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
}

.toolbar-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.variant-diamond {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background-color: var(--color-warning);
  color: var(--color-bg-main);
  border-radius: 50%;
  font-size: 0.6rem;
  font-weight: bold;
  margin-right: 0.3rem;
  vertical-align: middle;
}

/* ========================================
   5. FAQ 樣式
   ======================================== */

.faq-item {
  margin-bottom: 1.25rem;
  padding: 1rem;
  background: color-mix(in srgb, var(--color-bg-panel) 50%, transparent);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
}

.faq-question {
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem 0;
}

.faq-answer {
  color: var(--color-text-secondary);
  margin: 0;
}

/* ========================================
   6. 隱私權連結樣式
   ======================================== */

.privacy-full-link {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.privacy-full-link a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
  font-weight: 500;
  transition: color 0.2s ease;
}

.privacy-full-link a:hover {
  color: var(--color-primary);
}

/* ========================================
   7. 響應式設計
   ======================================== */

@media (max-width: 767px) {
  .help-tabs {
    padding: 0.5rem 0.75rem;
    gap: 0.35rem;
  }
  
  .help-tab {
    padding: 0.4rem 0.7rem;
    font-size: 0.8rem;
  }
  
  .tab-label {
    display: none;
  }
  
  .help-tab.active .tab-label {
    display: inline;
  }
  
  .help-tab-content {
    padding: 1rem;
  }
  
  .help-section h4 {
    font-size: 1rem;
  }
}
</style>


