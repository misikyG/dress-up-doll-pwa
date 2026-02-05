import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './components/App.vue'
import './assets/ios-safari-compat.css'

// iOS Safari 相容性檢測與修復
const applyIOSSafariFixes = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (isIOS || isSafari) {
    console.log('📱 偵測到 iOS/Safari，套用相容性修復...');
    document.documentElement.classList.add('is-ios-safari');
    
    // 動態注入 rgb(from ...) 的回退樣式
    const style = document.createElement('style');
    style.id = 'ios-safari-rgb-fallback';
    style.textContent = `
      /* iOS Safari rgb(from ...) 語法回退 */
      :root {
        --shadow-sm: 0 1px 3px rgba(119, 98, 88, 0.05);
        --shadow-md: 0 2px 8px rgba(119, 98, 88, 0.08);
        --shadow-lg: 0 4px 12px rgba(119, 98, 88, 0.12);
        --shadow-xl: 0 8px 24px rgba(119, 98, 88, 0.15);
      }
      
      /* 額外的 iOS Safari 樣式修復 */
      .wardrobe {
        background-color: rgba(255, 255, 255, 0.95) !important;
      }
      
      .panel-toggle-handle {
        background: rgba(165, 149, 209, 0.3) !important;
      }
      
      .panel-toggle-handle:hover {
        background: var(--color-primary) !important;
      }
      
      .category-tab:hover {
        background-color: rgba(165, 149, 209, 0.1) !important;
      }
      
      .filter-toggle-btn:hover {
        background-color: rgba(165, 149, 209, 0.1) !important;
      }
      
      .filter-clear-btn:hover {
        background-color: rgba(165, 149, 209, 0.1) !important;
      }
      
      .filter-checkbox-item:hover {
        background-color: rgba(198, 185, 155, 0.3) !important;
      }
      
      .tag-item {
        background-color: rgba(125, 165, 133, 0.2) !important;
      }
      
      .tag-item:hover {
        background-color: rgba(125, 165, 133, 0.3) !important;
      }
      
      .grid-item:hover {
        box-shadow: 0 4px 12px rgba(119, 98, 88, 0.15) !important;
      }
      
      .item-card.equipped {
        background-color: rgba(198, 185, 155, 0.3) !important;
      }
      
      .outfit-card {
        background: linear-gradient(135deg, var(--color-info) 0%, rgba(113, 162, 202, 0.7) 100%) !important;
      }
      
      .item-card.has-variant {
        border-color: rgba(245, 187, 100, 0.5) !important;
      }
      
      .item-card.highlighted {
        box-shadow: 0 0 12px rgba(112, 145, 114, 0.5) !important;
      }
      
      .context-menu-overlay {
        background-color: rgba(119, 98, 88, 0.3) !important;
      }
    `;
    document.head.appendChild(style);
    
    // 修復 iOS Safari 的 100vh 問題
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => {
      setTimeout(setViewportHeight, 100);
    });

    // 防止 iOS Safari 的橡皮筋效果
    document.body.addEventListener('touchmove', (e) => {
      if (e.target.closest('.items-grid-container, .layer-list, .mobile-items-scroll, .modal-content, .settings-content, .filter-checkboxes, .mobile-wardrobe-body, .categories-scroll')) {
        // 允許這些容器內的滾動
        return;
      }
      // 阻止其他區域的滾動
      if (!e.target.closest('.canvas-viewport')) {
        e.preventDefault();
      }
    }, { passive: false });
  }
};

// 在 DOM 準備好後執行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyIOSSafariFixes);
} else {
  applyIOSSafariFixes();
}

createApp(App).use(createPinia()).mount('#app')