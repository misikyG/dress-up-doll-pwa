import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './components/App.vue'
import './assets/ios-safari-compat.css'

const applyIOSSafariFixes = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (isIOS || isSafari) {
    console.log('偵測到 iOS/Safari，套用相容性修復...');
    document.documentElement.classList.add('is-ios-safari');
    
    // 動態注入 rgb(from ...) 的回退樣式
    const style = document.createElement('style');
    style.id = 'ios-safari-rgb-fallback';
    style.textContent = `
      /* iOS Safari rgb(from ...) / color-mix() 回退 — 使用 rgba 硬編碼 */
      :root {
        --shadow-sm: 0 1px 3px rgba(71, 45, 37, 0.05);
        --shadow-md: 0 2px 8px rgba(71, 45, 37, 0.08);
        --shadow-lg: 0 4px 12px rgba(71, 45, 37, 0.12);
        --shadow-xl: 0 8px 24px rgba(71, 45, 37, 0.15);
      }
      
      /* 若瀏覽器支援 color-mix，使用主題色感知版本 */
      @supports (background: color-mix(in srgb, red 50%, transparent)) {
        :root {
          --shadow-sm: 0 1px 3px color-mix(in srgb, var(--color-text-primary) 5%, transparent);
          --shadow-md: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 8%, transparent);
          --shadow-lg: 0 4px 12px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
          --shadow-xl: 0 8px 24px color-mix(in srgb, var(--color-text-primary) 15%, transparent);
        }
      }
      
      /* 額外的 iOS Safari 樣式修復 — rgba 回退 */
      .wardrobe {
        background-color: rgba(255, 255, 255, 0.95) !important;
      }
      
      .panel-toggle-handle {
        background: rgba(97, 139, 106, 0.30) !important;
      }
      
      .panel-toggle-handle:hover {
        background: var(--color-primary) !important;
      }
      
      .category-tab:hover {
        background-color: rgba(97, 139, 106, 0.10) !important;
      }
      
      .filter-toggle-btn:hover {
        background-color: rgba(97, 139, 106, 0.10) !important;
      }
      
      .filter-clear-btn:hover {
        background-color: rgba(97, 139, 106, 0.10) !important;
      }
      
      .filter-checkbox-item:hover {
        background-color: rgba(71, 45, 37, 0.10) !important;
      }
      
      .tag-item {
        background-color: rgba(241, 247, 229, 0.20) !important;
      }
      
      .tag-item:hover {
        background-color: rgba(241, 247, 229, 0.30) !important;
      }
      
      .grid-item:hover {
        box-shadow: 0 4px 12px rgba(71, 45, 37, 0.15) !important;
      }
      
      .item-card.equipped {
        background-color: rgba(71, 45, 37, 0.10) !important;
      }
      
      .outfit-card {
        background: linear-gradient(135deg, var(--color-info) 0%, rgba(100, 181, 246, 0.70) 100%) !important;
      }
      
      .item-card.has-variant {
        border-color: rgba(245, 187, 100, 0.50) !important;
      }
      
      .item-card.highlighted {
        box-shadow: 0 0 12px rgba(129, 199, 132, 0.50) !important;
      }
      
      .context-menu-overlay {
        background-color: rgba(71, 45, 37, 0.30) !important;
      }
      
      /* 若瀏覽器支援 color-mix，覆蓋為主題色感知版本 */
      @supports (background: color-mix(in srgb, red 50%, transparent)) {
        .wardrobe {
          background-color: color-mix(in srgb, var(--color-bg-card) 95%, transparent) !important;
        }
        .panel-toggle-handle {
          background: color-mix(in srgb, var(--color-primary) 30%, transparent) !important;
        }
        .category-tab:hover {
          background-color: color-mix(in srgb, var(--color-primary) 10%, transparent) !important;
        }
        .filter-toggle-btn:hover {
          background-color: color-mix(in srgb, var(--color-primary) 10%, transparent) !important;
        }
        .filter-clear-btn:hover {
          background-color: color-mix(in srgb, var(--color-primary) 10%, transparent) !important;
        }
        .filter-checkbox-item:hover {
          background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent) !important;
        }
        .tag-item {
          background-color: color-mix(in srgb, var(--color-bg-panel) 20%, transparent) !important;
        }
        .tag-item:hover {
          background-color: color-mix(in srgb, var(--color-bg-panel) 30%, transparent) !important;
        }
        .grid-item:hover {
          box-shadow: 0 4px 12px color-mix(in srgb, var(--color-text-primary) 15%, transparent) !important;
        }
        .item-card.equipped {
          background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent) !important;
        }
        .outfit-card {
          background: linear-gradient(135deg, var(--color-info) 0%, color-mix(in srgb, var(--color-info) 70%, transparent) 100%) !important;
        }
        .item-card.has-variant {
          border-color: color-mix(in srgb, var(--color-warning) 50%, transparent) !important;
        }
        .item-card.highlighted {
          box-shadow: 0 0 12px color-mix(in srgb, var(--color-success) 50%, transparent) !important;
        }
        .context-menu-overlay {
          background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent) !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Controls.vue color-mix() 回退 — 針對不支援 color-mix 的舊版 iOS Safari
    const ctrlFallback = document.createElement('style');
    ctrlFallback.id = 'ios-controls-color-fallback';
    ctrlFallback.textContent = `
      /* 預設主題色 #472d25 = rgb(71,45,37) 的 rgba 回退 */
      .icon-btn-ctrl { background: rgba(71,45,37,0.7) !important; box-shadow: 0 2px 8px rgba(71,45,37,0.15) !important; }
      .badge-btn { background: rgba(71,45,37,0.7) !important; box-shadow: 0 2px 8px rgba(71,45,37,0.15) !important; }
      .badge-btn.mode { background: rgba(71,45,37,0.45) !important; }
      .badge-btn.flip { background: rgba(71,45,37,0.7) !important; }
      .badge-btn.save { background: linear-gradient(135deg, var(--color-info), rgba(113,162,202,0.8)) !important; }
      .zoom-badge { background: rgba(71,45,37,0.75) !important; box-shadow: 0 2px 8px rgba(71,45,37,0.15) !important; }
      .check-badge { background: rgba(71,45,37,0.7) !important; box-shadow: 0 2px 8px rgba(71,45,37,0.15) !important; }
      .toggle-btn { background: rgba(71,45,37,0.75) !important; box-shadow: 0 2px 8px rgba(71,45,37,0.15) !important; }
      .download-dialog-overlay { background: rgba(71,45,37,0.5) !important; }

      /* 若瀏覽器支援 color-mix，覆蓋為主題色感知版本 */
      @supports (background: color-mix(in srgb, red 50%, transparent)) {
        .icon-btn-ctrl { background: color-mix(in srgb, var(--color-text-primary) 70%, transparent) !important; box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent) !important; }
        .badge-btn { background: color-mix(in srgb, var(--color-text-primary) 70%, transparent) !important; box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent) !important; }
        .badge-btn.mode { background: color-mix(in srgb, var(--color-text-primary) 45%, transparent) !important; }
        .badge-btn.flip { background: color-mix(in srgb, var(--color-text-primary) 70%, transparent) !important; }
        .badge-btn.save { background: linear-gradient(135deg, var(--color-info), color-mix(in srgb, var(--color-info) 80%, transparent)) !important; }
        .zoom-badge { background: color-mix(in srgb, var(--color-text-primary) 75%, transparent) !important; box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent) !important; }
        .check-badge { background: color-mix(in srgb, var(--color-text-primary) 70%, transparent) !important; box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent) !important; }
        .toggle-btn { background: color-mix(in srgb, var(--color-text-primary) 75%, transparent) !important; box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 15%, transparent) !important; }
        .download-dialog-overlay { background: color-mix(in srgb, var(--color-text-primary) 50%, transparent) !important; }
      }
    `;
    document.head.appendChild(ctrlFallback);

    // 防止 iOS Safari 的橡皮筋效果
    document.body.addEventListener('touchmove', (e) => {
      // 獨立頁面（如隱私權政策）不攔截任何滾動
      if (document.documentElement.classList.contains('scrollable-page')) {
        return;
      }
      if (e.target.closest('.items-grid-container, .layer-list, .mobile-items-scroll, .modal-content, .settings-content, .filter-checkboxes, .mobile-wardrobe-body, .categories-scroll, .search-results-wrapper, .help-tab-content, .contact-content, .room-content, .wardrobe-content, .context-menu-content')) {
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

// 修復所有行動瀏覽器的 100vh 問題（Android Chrome 地址列、iOS Safari 等）
// --vh 必須在所有裝置上設定，否則 CSS 中 calc(var(--vh, 1vh) * 100) 會退回 100vh（大視窗高度）
const setViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};
setViewportHeight();
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
  setTimeout(setViewportHeight, 100);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyIOSSafariFixes);
} else {
  applyIOSSafariFixes();
}

createApp(App).use(createPinia()).use(router).mount('#app')

