<template>
  <router-view />
</template>

<script setup>
// 根元件：僅負責掛載 <router-view>，所有頁面邏輯由各路由元件處理
</script>

<style>
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.icon-btn svg,
.title-icon svg,
.panel-icon svg,
.section-icon svg,
.empty-icon svg,
button svg {
  width: 1em;
  height: 1em;
  display: inline-block;
  vertical-align: middle;
}

*,
*::before,
*::after {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

input,
textarea,
[contenteditable="true"] {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

body {
  margin: 0;
  font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--color-bg-main);
  color: var(--color-text-primary);
}

#app-container {
  width: 100vw;
  /* iOS Safari 100vh 修復 - 使用多重回退 */
  height: 100vh;
  height: 100dvh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  /* 確保 safe-area padding 包含在高度內，
     避免 viewport-fit=cover 時底部內容被裁切 */
  box-sizing: border-box;
}

.modal-base {
  max-width: 90vw;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
}

.modal-sm { width: 400px; }
.modal-md { width: 500px; }
.modal-lg { width: 600px; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--color-bg-panel);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.15rem;
  font-weight: 600;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-border);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
  line-height: 1;
}

.btn-close:hover {
  background-color: rgba(71, 45, 37, 0.20);
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  color: var(--color-text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-primary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-primary);
}

.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-icon {
  font-size: 4rem;
  opacity: 0.3;
  margin-bottom: 1rem;
}

.empty-icon svg {
  width: 4rem;
  height: 4rem;
}

.empty-text {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.spinner {
  border: 3px solid rgba(71, 45, 37, 0.30);
  border: 3px solid color-mix(in srgb, var(--color-text-primary) 30%, transparent);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

.spinner-sm { width: 20px; height: 20px; }
.spinner-md { width: 32px; height: 32px; }
.spinner-lg { width: 48px; height: 48px; }

.btn {
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  padding: 0.6rem 1.2rem;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-secondary {
  background-color: rgba(192, 183, 163, 0.50);
  background-color: color-mix(in srgb, var(--color-border) 50%, transparent);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  padding: 0.6rem 1.2rem;
}

.btn-secondary:hover {
  background-color: var(--color-border-light);
}

.btn-danger {
  background-color: var(--color-error);
  color: var(--color-bg-main);
  padding: 0.6rem 1.2rem;
}

.btn-danger:hover {
  opacity: 0.85;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-custom-container input[type="checkbox"],
.filter-checkbox-item input[type="checkbox"],
.check-badge input[type="checkbox"],
.watermark-option input[type="checkbox"] {
  display: none;
}

.checkbox-custom,
.equipped-badge,
.selected-indicator {
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  flex-shrink: 0;
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-checkbox-item .checkbox-custom {
  width: 14px;
  height: 14px;
  min-width: 14px;
  min-height: 14px;
  border-width: 1.5px;
}

.check-badge .checkbox-indicator {
  width: 16px;
  height: 16px;
  min-width: 16px;
  min-height: 16px;
  flex-shrink: 0;
  border: 2px solid var(--color-bg-main);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

input[type="checkbox"]:checked + .checkbox-custom,
.equipped-badge,
.selected-indicator {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.check-badge input[type="checkbox"]:checked + .checkbox-indicator {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

input[type="checkbox"]:checked + .checkbox-custom::after,
.equipped-badge::after,
.selected-indicator::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid var(--color-bg-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.filter-checkbox-item input[type="checkbox"]:checked + .checkbox-custom::after {
  left: 3.5px;
  top: 1px;
  width: 3px;
  height: 6px;
  border-width: 0 1.5px 1.5px 0;
}

.check-badge input[type="checkbox"]:checked + .checkbox-indicator::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 7px;
  border: solid var(--color-bg-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.equipped-badge,
.selected-indicator {
  font-size: 0;
  color: transparent;
}

.thumbnail {
  background-color: rgba(240, 242, 245, 0.60);
  background-color: color-mix(in srgb, var(--color-bg-canvas) 60%, transparent);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumbnail-sm { width: 40px; height: 40px; }
.thumbnail-md { width: 50px; height: 50px; }
.thumbnail-lg { width: 70px; height: 70px; }

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: var(--color-primary);
  color: var(--color-bg-card);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(192, 183, 163, 0.30);
  border: 4px solid color-mix(in srgb, var(--color-border) 30%, transparent);
  border-top-color: var(--color-bg-main);
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.main-app {
  display: flex;
  flex-direction: column;
  /* 使用 100% 填滿 #app-container 的內容區域，
     而非重複使用 100dvh，避免 safe-area padding 導致溢出 */
  height: 100%;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 56px;
  background-color: var(--color-bg-panel);
  box-shadow: var(--shadow-sm);
  z-index: 100;
  position: relative;
}

.logo h1 {
  font-size: 1.25rem;
  margin: 0;
  color: var(--color-primary);
}

.main-nav {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
}

.main-nav button {
  padding: 0.5rem 1.25rem;
  border: none;
  background: none;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: var(--transition-fast);
  color: var(--color-text-secondary);
}

.main-nav button.active {
  background-color: var(--color-primary);
  color: var(--color-bg-card);
}

.main-nav button:not(.active):hover {
  background-color: rgba(71, 45, 37, 0.20);
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.header-actions button {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-full);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
  color: var(--color-text-secondary);
}

.header-actions button:hover {
  background-color: rgba(71, 45, 37, 0.20);
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  color: var(--color-text-primary);
}

.content-wrapper {
  flex: 1;
  display: grid;
  gap: 1rem;
  padding: 1rem;
  overflow: hidden;
  transition: var(--transition-normal);
  position: relative;
}

.layout-left-center {
  grid-template-columns: var(--wardrobe-width) 1fr;
}

.layout-center-only {
  grid-template-columns: 68px 1fr;
}

.layout-tablet {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  padding: 0.75rem;
}

.layout-tablet .left-panel {
  width: clamp(220px, 26vw, 280px);
  min-width: 200px;
  flex-shrink: 0;
  transition: width 0.3s ease, min-width 0.3s ease;
}

.layout-tablet .left-panel.collapsed {
  width: 68px;
  min-width: 68px;
  max-width: 68px;
}

.layout-tablet .center-panel {
  flex: 1;
  min-width: 0;
  transition: flex 0.3s ease;
}

.layout-mobile {
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr;
  padding: 0.5rem;
  gap: 0.5rem;
}

.panel {
  background-color: var(--color-bg-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: var(--transition-normal);
  position: relative;
}

.center-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.layer-panel-container.desktop {
  flex-shrink: 0;
  background-color: var(--color-bg-panel);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  overflow: hidden;
}

.main-content {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  position: relative;
  overflow: hidden;
  /* 確保畫布區域底色為 canvas 而非 panel，
     讓 dressing-container 的半透明 color-bg-canvas 正確疊加 */
  background-color: var(--color-bg-canvas);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(71, 45, 37, 0.50);
  background-color: color-mix(in srgb, var(--color-text-primary) 50%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  color: var(--color-bg-main);
  font-weight: 500;
  font-size: 0.9rem;
  z-index: 1001;
  box-shadow: var(--shadow-lg);
}

.notification.success { background-color: var(--color-success); }
.notification.error { background-color: var(--color-error); }
.notification.warning { background-color: var(--color-warning); }
.notification.info { background-color: var(--color-info); }

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (min-width: 768px) and (max-width: 1024px) {
  .app-header {
    padding: 0 1rem;
    height: 52px;
  }
  
  .main-nav button {
    padding: 0.4rem 1rem;
    font-size: 0.9rem;
  }
  
  .header-actions button {
    width: 36px;
    height: 36px;
  }
  
  .notification {
    bottom: 15px;
    right: 15px;
  }
}

@media (max-width: 767px) {
  .app-header {
    padding: 0 0.5rem;
    height: 48px;
  }
  
  .logo h1 {
    font-size: 1.1rem;
  }
  
  .logo h1 svg {
    width: 24px;
    height: 18px;
  }
  
  .main-nav {
    gap: 0.15rem;
  }
  
  .main-nav button {
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
  }
  
  .header-actions {
    gap: 0.15rem;
  }
  
  .header-actions button {
    width: 32px;
    height: 32px;
    font-size: 1rem;
    padding: 0.3rem;
  }
  
  .notification {
    top: 56px;
    bottom: auto;
    left: 10px;
    right: 10px;
    text-align: center;
  }

  .slide-fade-enter-from,
  .slide-fade-leave-to {
    transform: translateY(-100%);
    opacity: 0;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0;
    padding-bottom: 0;
  }

  .center-panel {
    order: 1;
    flex: 1 1 0;
    min-height: 0;
    transition: all 0.3s ease;
  }

  .left-panel {
    order: 2;
    flex: 0 1 auto;
    min-height: 36px;
    height: auto;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
  }

  .left-panel.collapsed {
    display: block;
    width: 100%;
    min-height: 36px;
  }

/* 平板視圖覆寫：保持收合時與分類列一致的寬度 */
.tablet-view .left-panel.collapsed {
  width: 68px;
  min-width: 68px;
  max-width: 68px;
}
  .modal-overlay {
    padding: 0;
    align-items: stretch;
  }
  
  .modal-base {
    width: 100% !important;
    max-width: 100vw;
    /* iOS Safari 100vh 修復 */
    max-height: 100vh;
    max-height: 100dvh;
    max-height: calc(var(--vh, 1vh) * 100);
    height: 100vh;
    height: 100dvh;
    height: calc(var(--vh, 1vh) * 100);
    border-radius: 0;
  }
  
  .modal-header {
    padding: 0.75rem 1rem;
    /* iOS 安全區域支援 */
    padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
  }
  
  .modal-content {
    padding: 1rem;
    /* iOS 安全區域支援 */
    padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  }
}

</style>