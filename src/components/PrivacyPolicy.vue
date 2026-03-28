<template>
  <div class="privacy-page">
    <header class="privacy-header">
      <div class="privacy-header-inner">
        <h1>
          <svg xmlns="http://www.w3.org/2000/svg" class="header-icon" width="28" height="28" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          隱私權政策
        </h1>
        <router-link to="/" class="back-link">← 回到首頁</router-link>
      </div>
    </header>

    <main class="privacy-body">
      <div class="privacy-container">
        <p class="last-updated">最後更新日期：2026 年 2 月 14 日</p>

        <section class="policy-section">
          <h2>一、前言</h2>
          <p>
            歡迎使用「紙娃娃換裝系統」（以下簡稱「本應用」）。我們非常重視您的隱私權，本隱私權政策旨在說明我們如何收集、使用、儲存及保護您的個人資訊。使用本應用即表示您同意本政策的內容。
          </p>
        </section>

        <section class="policy-section">
          <h2>二、資料收集與使用</h2>
          <h3>2.1 本地儲存資料</h3>
          <p>本應用主要將資料儲存於您的瀏覽器本地環境中（IndexedDB），包括但不限於：</p>
          <ul>
            <li>您匯入的圖包素材與圖片資源</li>
            <li>換裝搭配紀錄與收藏</li>
            <li>應用程式偏好設定</li>
          </ul>
          <p>這些資料均儲存在您的裝置上，不會自動上傳至任何伺服器。</p>

          <h3>2.2 Google 雲端硬碟整合</h3>
          <p>
            本應用提供選擇性的 Google 雲端硬碟整合功能，用於備份和同步您的資料。當您選擇使用此功能時：
          </p>
          <ul>
            <li>我們會請求存取您 Google 雲端硬碟中<strong>由本應用建立的檔案</strong>（使用 <code>drive.file</code> 權限範圍）</li>
            <li>我們<strong>不會</strong>存取您雲端硬碟中的其他檔案</li>
            <li>資料傳輸透過 Google 官方 API 進行，受 Google 安全機制保護</li>
            <li>您可以隨時在 Google 帳戶設定中撤銷本應用的存取權限</li>
          </ul>

          <h3>2.3 我們不收集的資料</h3>
          <p>本應用<strong>不會</strong>收集以下資訊：</p>
          <ul>
            <li>個人身分資訊（姓名、電子郵件、電話等）</li>
            <li>位置資訊</li>
            <li>使用行為分析或追蹤資料</li>
            <li>Cookie 或第三方追蹤技術</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>三、資料儲存與安全</h2>
          <ul>
            <li><strong>本地資料</strong>：儲存在您瀏覽器的 IndexedDB 中，安全性取決於您的裝置和瀏覽器安全設定。清除瀏覽器資料可能導致本地資料遺失。</li>
            <li><strong>雲端資料</strong>：透過 Google 雲端硬碟儲存的資料，受 Google 的安全措施和加密保護。</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>四、第三方服務</h2>
          <p>本應用可能使用以下第三方服務：</p>
          <ul>
            <li><strong>Google 雲端硬碟 API</strong>：用於可選的雲端備份功能。使用時適用 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 隱私權政策</a>。</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>五、使用者權利</h2>
          <p>您擁有以下權利：</p>
          <ul>
            <li><strong>資料存取</strong>：您可以隨時查看和管理本應用中儲存的所有資料</li>
            <li><strong>資料刪除</strong>：您可以透過應用內設定或清除瀏覽器資料來刪除所有本地資料</li>
            <li><strong>撤銷授權</strong>：您可以隨時在 <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google 帳戶權限設定</a> 中撤銷本應用對 Google 雲端硬碟的存取權</li>
            <li><strong>資料匯出</strong>：您可以透過應用內的匯出功能備份您的資料</li>
          </ul>
        </section>

        <section class="policy-section">
          <h2>六、兒童隱私</h2>
          <p>
            本應用不針對 13 歲以下兒童設計，亦不會刻意收集兒童的個人資訊。
          </p>
        </section>

        <section class="policy-section">
          <h2>七、政策變更</h2>
          <p>
            我們可能會不定期更新本隱私權政策。政策變更時，我們會在本頁面上公布更新後的內容及生效日期。建議您定期查閱本政策以瞭解最新資訊。
          </p>
        </section>

        <section class="policy-section">
          <h2>八、聯繫方式</h2>
          <p>
            如對本隱私權政策有任何疑問或建議，歡迎透過應用內的「聯繫作者」功能與我們聯繫。
          </p>
        </section>
      </div>
    </main>

    <footer class="privacy-footer">
      <p>© 2026 紙娃娃換裝系統。保留所有權利。</p>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

// 隱私權頁面需要解除 body fixed + overflow:hidden 限制以允許滾動
onMounted(() => {
  document.body.classList.add('scrollable-page')
  document.documentElement.classList.add('scrollable-page')
})

onUnmounted(() => {
  document.body.classList.remove('scrollable-page')
  document.documentElement.classList.remove('scrollable-page')
})
</script>

<style scoped>
/* ========================================
   PrivacyPolicy.vue 樣式
   ======================================== */

.privacy-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-main);
  color: var(--color-text-primary);
  font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Header */
.privacy-header {
  background: var(--color-primary);
  color: var(--color-bg-card);
  padding: 1rem 1.5rem;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 10%, transparent);
  position: sticky;
  top: 0;
  z-index: 10;
}

.privacy-header-inner {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.privacy-header h1 {
  margin: 0;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-icon {
  flex-shrink: 0;
}

.back-link {
  color: color-mix(in srgb, var(--color-bg-card) 90%, transparent);
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--color-bg-card) 30%, transparent);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.back-link:hover {
  background: color-mix(in srgb, var(--color-bg-card) 15%, transparent);
  border-color: color-mix(in srgb, var(--color-bg-card) 50%, transparent);
}

/* Body */
.privacy-body {
  flex: 1;
  padding: 2rem 1.5rem;
}

.privacy-container {
  max-width: 800px;
  margin: 0 auto;
  background: var(--color-bg-card, var(--color-bg-card));
  border-radius: 12px;
  padding: 2rem 2.5rem;
  box-shadow: 0 2px 12px color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}

.last-updated {
  color: var(--color-text-secondary, var(--color-text-secondary));
  font-size: 0.85rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border, var(--color-border));
}

/* Sections */
.policy-section {
  margin-bottom: 2rem;
}

.policy-section:last-child {
  margin-bottom: 0;
}

.policy-section h2 {
  font-size: 1.2rem;
  color: var(--color-primary);
  margin: 0 0 0.75rem 0;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--color-primary, var(--color-primary));
}

.policy-section h3 {
  font-size: 1rem;
  color: var(--color-primary, var(--color-primary));
  margin: 1.25rem 0 0.5rem 0;
}

.policy-section p {
  line-height: 1.8;
  margin: 0.5rem 0;
}

.policy-section ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  line-height: 1.8;
}

.policy-section li {
  margin: 0.4rem 0;
}

.policy-section strong {
  color: var(--color-primary);
}

.policy-section code {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.9em;
  color: var(--color-primary);
}

.policy-section a {
  color: var(--color-primary, var(--color-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.policy-section a:hover {
  color: var(--color-primary);
}

/* Footer */
.privacy-footer {
  text-align: center;
  padding: 1.5rem;
  color: var(--color-text-secondary, var(--color-text-secondary));
  font-size: 0.8rem;
  border-top: 1px solid var(--color-border, var(--color-border));
}

.privacy-footer p {
  margin: 0;
}

/* Responsive */
@media (max-width: 767px) {
  .privacy-header h1 {
    font-size: 1.1rem;
  }

  .privacy-body {
    padding: 1rem 0.75rem;
  }

  .privacy-container {
    padding: 1.25rem 1rem;
    border-radius: 8px;
  }

  .policy-section h2 {
    font-size: 1.05rem;
  }
}
</style>


