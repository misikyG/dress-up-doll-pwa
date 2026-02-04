// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './components/App.vue'

// 導入 iOS Safari 相容性樣式
import './assets/ios-safari-compat.css'

/**
 * iOS Safari 相容性修復
 * 偵測並修復 iOS Safari 不支援的 CSS 功能
 */
const applyiOSSafariFixs = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (isIOS || isSafari) {
    console.log('📱 偵測到 iOS/Safari，套用相容性修復...');
    
    // 建立相容性 CSS
    const compatCSS = document.createElement('style');
    compatCSS.id = 'ios-safari-compat';
    compatCSS.textContent = `
      /* iOS Safari 相容性修復 - 為不支援 rgb(from ...) 的瀏覽器提供 fallback */
      
      /* 100vh 修復 */
      html, body {
        height: 100%;
        height: -webkit-fill-available;
      }
      
      /* 防止 iOS Safari 彈性滾動 */
      body {
        overscroll-behavior: none;
        -webkit-overflow-scrolling: touch;
      }
      
      /* 安全區域支援 */
      .app-header {
        padding-top: env(safe-area-inset-top, 0);
      }
      
      .notification {
        bottom: calc(20px + env(safe-area-inset-bottom, 0));
      }
      
      /* 觸控優化 */
      button, a, .clickable {
        -webkit-tap-highlight-color: transparent;
      }
      
      /* 滾動容器優化 */
      .items-grid-container,
      .layer-list,
      .mobile-items-scroll,
      .modal-content,
      .settings-content {
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(compatCSS);
    
    // 修復 iOS Safari 100vh 問題
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => {
      setTimeout(setVH, 100);
    });
  }
};

// 套用 iOS Safari 修復
applyiOSSafariFixs();

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

console.log('換裝紙娃娃啟動中...')