import Swal from 'sweetalert2';

// 從 CSS 變數中讀取當前主題色
const getThemeColor = (name) => {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || null;
};

const getThemeColors = () => ({
  primary: getThemeColor('color-primary') || '#a595d1',
  bgMain: getThemeColor('color-bg-main') || '#f8f5ea',
  bgCard: getThemeColor('color-bg-card') || '#ffffff',
  bgPanel: getThemeColor('color-bg-panel') || '#c6d3ac',
  textPrimary: getThemeColor('color-text-primary') || '#766258',
  textSecondary: getThemeColor('color-text-secondary') || '#7c7c7c',
  border: getThemeColor('color-border') || '#c6b99b',
  success: getThemeColor('color-success') || '#709172',
  error: getThemeColor('color-error') || '#ad4b44',
  warning: getThemeColor('color-warning') || '#f5bb64',
  info: getThemeColor('color-info') || '#77b6c4',
});

/** 取得配合主題的 SweetAlert2 預設選項 */
const getThemedDefaults = () => {
  const c = getThemeColors();
  return {
    background: c.bgCard,
    color: c.textPrimary,
    confirmButtonColor: c.primary,
    cancelButtonColor: c.textSecondary,
    denyButtonColor: c.error,
    iconColor: c.primary,
    customClass: {
      popup: 'swal-themed-popup',
      title: 'swal-themed-title',
      htmlContainer: 'swal-themed-html',
      confirmButton: 'swal-themed-btn',
      cancelButton: 'swal-themed-btn swal-themed-btn-cancel',
      denyButton: 'swal-themed-btn swal-themed-btn-deny',
      input: 'swal-themed-input',
    },
  };
};

/**
 * 確認對話框 — 取代 window.confirm()
 * @param {string} text 確認訊息
 * @param {object} [options] 額外選項
 * @returns {Promise<boolean>}
 */
export async function swalConfirm(text, options = {}) {
  const c = getThemeColors();
  const result = await Swal.fire({
    ...getThemedDefaults(),
    title: options.title || '確認',
    html: text.replace(/\n/g, '<br>'),
    icon: options.icon || 'question',
    iconColor: options.danger ? c.error : c.warning,
    showCancelButton: true,
    confirmButtonText: options.confirmText || '確定',
    cancelButtonText: options.cancelText || '取消',
    confirmButtonColor: options.danger ? c.error : c.primary,
    reverseButtons: true,
    ...options,
  });
  return result.isConfirmed;
}

/**
 * 輸入對話框 — 取代 window.prompt()
 * @param {string} text 提示訊息
 * @param {string} [defaultValue] 預設值
 * @param {object} [options] 額外選項
 * @returns {Promise<string|null>} 輸入值或 null（取消）
 */
export async function swalPrompt(text, defaultValue = '', options = {}) {
  const result = await Swal.fire({
    ...getThemedDefaults(),
    title: options.title || '請輸入',
    text,
    input: 'text',
    inputValue: defaultValue,
    showCancelButton: true,
    confirmButtonText: options.confirmText || '確定',
    cancelButtonText: options.cancelText || '取消',
    reverseButtons: true,
    inputValidator: options.inputValidator || null,
    ...options,
  });
  return result.isConfirmed ? result.value : null;
}

/**
 * 訊息通知 — 取代 window.alert()
 * @param {string} text 訊息
 * @param {object} [options] 額外選項
 */
export async function swalAlert(text, options = {}) {
  await Swal.fire({
    ...getThemedDefaults(),
    title: options.title || '提示',
    html: text.replace(/\n/g, '<br>'),
    icon: options.icon || 'info',
    confirmButtonText: options.confirmText || '知道了',
    ...options,
  });
}

/** 注入全域 CSS 以風格化 SweetAlert2 對話框 */
const injectSwalStyles = () => {
  if (document.getElementById('swal-theme-styles')) return;
  const style = document.createElement('style');
  style.id = 'swal-theme-styles';
  style.textContent = `
    .swal-themed-popup {
      border-radius: var(--radius-lg, 12px) !important;
      border: 1px solid var(--color-border, #c6b99b) !important;
      box-shadow: var(--shadow-xl, 0 8px 24px rgba(71, 45, 37, 0.15)) !important;
      font-family: inherit !important;
      padding: 1.5rem !important;
    }
    .swal-themed-title {
      font-size: 1.2rem !important;
      font-weight: 600 !important;
      color: var(--color-text-primary, #766258) !important;
    }
    .swal-themed-html {
      font-size: 0.95rem !important;
      color: var(--color-text-secondary, #7c7c7c) !important;
      line-height: 1.6 !important;
    }
    .swal-themed-btn {
      border-radius: var(--radius-md, 8px) !important;
      font-size: 0.9rem !important;
      font-weight: 500 !important;
      padding: 0.5rem 1.5rem !important;
      transition: all 0.2s ease !important;
      border: none !important;
      box-shadow: var(--shadow-sm, 0 1px 3px rgba(71, 45, 37, 0.05)) !important;
    }
    .swal-themed-btn:hover {
      filter: brightness(1.08) !important;
      box-shadow: var(--shadow-md, 0 2px 8px rgba(71, 45, 37, 0.08)) !important;
    }
    .swal-themed-btn-cancel {
      background-color: var(--color-bg-panel, #c6d3ac) !important;
      color: var(--color-text-primary, #766258) !important;
    }
    .swal-themed-btn-deny {
      background-color: var(--color-error, #ad4b44) !important;
    }
    .swal-themed-input {
      border-radius: var(--radius-md, 8px) !important;
      border: 1.5px solid var(--color-border, #c6b99b) !important;
      font-size: 0.95rem !important;
      padding: 0.5rem 0.75rem !important;
      background: var(--color-bg-main, #f8f5ea) !important;
      color: var(--color-text-primary, #766258) !important;
      transition: border-color 0.2s ease !important;
    }
    .swal-themed-input:focus {
      border-color: var(--color-primary, #a595d1) !important;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent) !important;
      outline: none !important;
    }
    /* 動畫微調 */
    .swal2-show {
      animation: swalFadeIn 0.2s ease !important;
    }
    @keyframes swalFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .swal2-icon {
      border-color: var(--color-border, #c6b99b) !important;
    }
  `;
  document.head.appendChild(style);
};

// 自動注入樣式
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSwalStyles);
  } else {
    injectSwalStyles();
  }
}
