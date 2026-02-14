<template>
  <div class="contact-modal modal-base modal-md" @click.stop>
    <div class="modal-header">
      <h3><span class="title-icon" v-html="icons.contact"></span> 聯繫作者</h3>
      <button @click="$emit('close')" class="btn-close" title="關閉">×</button>
    </div>
    
    <div class="contact-content">
      <!-- 作者資訊區塊 -->
      <div class="contact-section author-section">
        <div class="author-avatar">
          <img 
            :src="avatarUrl" 
            alt="作者頭貼" 
            class="avatar-img"
            @error="avatarError = true"
            v-if="!avatarError"
          />
          <span class="avatar-icon" v-else>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </span>
        </div>
        <div class="author-info">
          <h4 class="author-name">蟲餡包</h4>
          <p class="author-desc">感謝您使用本系統！如有任何問題或建議，歡迎透過以下方式聯繫。</p>
        </div>
      </div>

      <!-- 社交平台連結 -->
      <div class="contact-section">
        <h4 class="section-title">
          <span class="section-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </span>
          社交平台
        </h4>
        <div class="social-links">
          <a href="https://www.facebook.com/bao.chong.chong.chong" target="_blank" rel="noopener noreferrer" class="social-link facebook">
            <span class="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </span>
            <span class="social-name">Facebook</span>
          </a>
          <a href="https://www.plurk.com/misikyG" target="_blank" rel="noopener noreferrer" class="social-link plurk">
            <span class="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
            </span>
            <span class="social-name">Plurk</span>
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer" class="social-link website">
            <span class="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </span>
            <span class="social-name">個人網站</span>
          </a>
        </div>
      </div>

      <!-- 電子信箱 -->
      <div class="contact-section">
        <h4 class="section-title">
          <span class="section-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </span>
          電子信箱
        </h4>
        <div class="email-container">
          <a href="mailto:misiky1@gmail.com" class="email-link">
            <span class="email-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
            <span class="email-text">misiky1@gmail.com</span>
          </a>
          <button class="copy-btn" @click="copyEmail" title="複製信箱">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      </div>

      <!-- 意見回饋 Google 表單 -->
      <div class="contact-section feedback-section">
        <h4 class="section-title">
          <span class="section-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </span>
          意見回饋
        </h4>
        <p class="feedback-desc">有任何功能建議、問題回報或使用心得？歡迎填寫以下表單：</p>
        <div class="feedback-form-container">
          <iframe 
            src="https://docs.google.com/forms/d/e/1FAIpQLScxhDB6SGwSb-jW-RAW-T_BgmZ6QssIcyfywaGdiYw2cJUCcA/viewform?embedded=true" 
            width="100%" 
            height="400" 
            frameborder="0" 
            marginheight="0" 
            marginwidth="0"
            class="feedback-iframe"
          >載入中…</iframe>
        </div>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLScxhDB6SGwSb-jW-RAW-T_BgmZ6QssIcyfywaGdiYw2cJUCcA/viewform?embedded=true" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="open-form-btn">
          <span>在新視窗開啟表單</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { icons } from '../icons.js';
import { useGameStore } from '../store/index.js';

const emit = defineEmits(['close']);
const gameStore = useGameStore();

// 作者頭貼（放在 public/author-avatar.png）
const avatarUrl = `${import.meta.env.BASE_URL}author-avatar.png`;
const avatarError = ref(false);

const copyEmail = () => {
  navigator.clipboard.writeText('misiky1@gmail.com').then(() => {
    gameStore.showNotification('📋 已複製電子信箱', 'success');
  }).catch(() => {
    gameStore.showNotification('❌ 複製失敗', 'error');
  });
};
</script>

<style scoped>
/* ========================================
   Contact.vue 樣式
   ----------------------------------------
   目錄：
   1. 內容容器
   2. 作者資訊
   3. 區塊標題
   4. 社交連結
   5. 電子信箱
   6. 意見回饋
   7. 響應式設計
   ======================================== */

/* ========================================
   1. 內容容器
   ======================================== */

.contact-content {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  max-height: calc(85vh - 60px);
}

/* 自訂滾動條 */
.contact-content::-webkit-scrollbar {
  width: 4px;
}

.contact-content::-webkit-scrollbar-track {
  background: transparent;
}

.contact-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.contact-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary);
}

.contact-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border-light);
}

.contact-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

/* ========================================
   2. 作者資訊
   ======================================== */

.author-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, rgba(165, 149, 209, 0.1), rgba(125, 165, 133, 0.05));
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  border: none;
  margin-bottom: 1.5rem;
}

.author-avatar {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-full);
}

.avatar-icon {
  font-size: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-bg-main);
}

.author-info {
  flex: 1;
}

.author-name {
  margin: 0 0 0.35rem 0;
  font-size: 1.1rem;
  color: var(--color-text-primary);
}

.author-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

/* ========================================
   3. 區塊標題
   ======================================== */

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-icon {
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

/* ========================================
   4. 社交連結
   ======================================== */

.social-links {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.social-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: var(--radius-md);
  background: var(--color-bg-canvas);
  color: var(--color-text-primary);
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid var(--color-border);
}

.social-link:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.social-link.facebook:hover {
  background: #1877f2;
  color: white;
  border-color: #1877f2;
}

.social-link.website:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.social-link.plurk:hover {
  background: #cf682f;
  color: white;
  border-color: #cf682f;
}

.social-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.social-name {
  font-size: 0.9rem;
  font-weight: 500;
}

/* ========================================
   5. 電子信箱
   ======================================== */

.email-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
}

.email-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-primary);
  text-decoration: none;
  flex: 1;
}

.email-link:hover {
  text-decoration: underline;
}

.email-icon {
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.email-text {
  font-size: 0.95rem;
  font-family: monospace;
}

.copy-btn {
  background: none;
  border: none;
  padding: 0.35rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: rgba(192, 183, 163, 0.3);
  color: var(--color-primary);
}

/* ========================================
   6. 意見回饋
   ======================================== */

.feedback-desc {
  margin: 0 0 0.75rem 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.feedback-form-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.feedback-iframe {
  display: block;
  background: var(--color-bg-card);
}

.open-form-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-primary-dark);
  color: #fff;
  text-decoration: none;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.open-form-btn:hover {
  background: rgba(165, 149, 209, 0.85);
  transform: translateY(-1px);
}

/* ========================================
   7. 響應式設計
   ======================================== */

@media (max-width: 767px) {
  .contact-content {
    padding: 1rem;
    max-height: calc(100vh - 56px);
  }

  .author-section {
    flex-direction: column;
    text-align: center;
    padding: 1rem;
  }

  .author-avatar {
    width: 50px;
    height: 50px;
  }

  .avatar-icon {
    font-size: 1.5rem;
  }

  .author-name {
    font-size: 1rem;
  }

  .social-links {
    flex-direction: column;
  }

  .social-link {
    justify-content: center;
  }

  .feedback-form-container {
    margin-left: -1rem;
    margin-right: -1rem;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .feedback-iframe {
    height: 350px;
  }
}
</style>
