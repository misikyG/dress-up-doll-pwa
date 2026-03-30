<template>
  <div class="settings-modal" @click.stop>
    <div class="settings-header">
      <h3><span class="title-icon" v-html="icons.settings"></span> 設定</h3>
      <button @click="$emit('close')" class="close-btn" title="關閉">×</button>
    </div>
    
    <div class="settings-content">
      <div class="settings-section">
        <h4><span class="section-icon" v-html="icons.settings"></span> 主題管理</h4>
        
        <div class="theme-selector">
          <label>選擇主題</label>
          <div class="theme-options">
            <button 
              :class="['theme-option', { active: gameStore.theme.currentTheme === 'default' }]"
              @click="handleThemeClick('default')">
              <div class="theme-preview" :style="getDefaultThemePreviewStyle()"></div>
              <span>預設</span>
            </button>
            <button 
              v-for="preset in presetThemesList"
              :key="preset.id"
              :class="['theme-option', { active: gameStore.theme.currentTheme === preset.id }]"
              @click="handleThemeClick(preset.id)">
              <div class="theme-preview" :style="getThemePreviewStyle(preset)"></div>
              <span>{{ preset.name }}</span>
            </button>
            <div 
              v-for="theme in gameStore.theme.customThemes" 
              :key="theme.id"
              :class="['theme-option', { active: gameStore.theme.currentTheme === theme.id }]"
              @click="handleThemeClick(theme.id)">
              <div class="theme-preview" :style="getThemePreviewStyle(theme)"></div>
              <span>{{ theme.name }}</span>
              <button class="delete-theme-btn" @click.stop="deleteTheme(theme.id)" title="刪除">×</button>
            </div>
          </div>
        </div>

        <div class="subsection">
          <button class="subsection-toggle" @click="showColorEditor = !showColorEditor">
            <span class="toggle-icon">{{ showColorEditor ? '▼' : '▶' }}</span>
            自定義顏色
          </button>
          
          <div v-if="showColorEditor" class="subsection-content">
            <div class="color-swatches">
              <div class="color-swatch-item" v-for="(label, key) in colorLabels" :key="key">
                <div 
                  class="color-swatch" 
                  :style="{ backgroundColor: editingColors[key] }"
                  @click="openColorPicker(key)"
                  :title="label"
                  :class="{ active: activeColorKey === key }"
                ></div>
                <span class="swatch-label">{{ label }}</span>
              </div>
            </div>

            <div v-if="activeColorKey" class="color-picker-popup">
              <div class="color-picker-header">
                <span>{{ colorLabels[activeColorKey] }}</span>
                <button class="color-picker-close" @click="closeColorPicker">×</button>
              </div>
              <div class="color-picker-body">
                <div ref="iroPickerContainer" class="iro-picker-container"></div>
                <div class="color-input-section">
                  <div class="color-input-row">
                    <label class="color-input-label">HEX</label>
                    <input 
                      type="text" 
                      class="color-input hex-input"
                      :value="editingColors[activeColorKey]"
                      @input="handleHexInput($event)"
                      @blur="validateHexInput"
                      placeholder="#000000"
                      maxlength="7"
                    />
                  </div>
                  <div class="color-input-row rgb-row">
                    <label class="color-input-label">RGB</label>
                    <div class="rgb-inputs">
                      <input 
                        type="number" 
                        class="color-input rgb-input"
                        :value="getCurrentRgbValues().r"
                        @input="handleRgbInput('r', $event)"
                        min="0" max="255"
                        placeholder="R"
                      />
                      <input 
                        type="number" 
                        class="color-input rgb-input"
                        :value="getCurrentRgbValues().g"
                        @input="handleRgbInput('g', $event)"
                        min="0" max="255"
                        placeholder="G"
                      />
                      <input 
                        type="number" 
                        class="color-input rgb-input"
                        :value="getCurrentRgbValues().b"
                        @input="handleRgbInput('b', $event)"
                        min="0" max="255"
                        placeholder="B"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="subsection-actions">
              <input 
                type="text" 
                v-model="newThemeName" 
                placeholder="主題名稱"
                class="theme-name-input">
              <button class="primary-btn small" @click="saveCurrentTheme">儲存</button>
              <button class="secondary-btn small" @click="previewColors">預覽</button>
              <button class="secondary-btn small" @click="resetColors">重置</button>
            </div>

            <div class="subsection-footer">
              <button class="icon-btn-action" @click="exportColors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                匯出顏色
              </button>
              <button class="icon-btn-action" @click="triggerColorImport">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                匯入顏色
              </button>
              <input 
                ref="colorFileInput" 
                type="file" 
                accept=".json"
                @change="handleColorImport"
                style="display: none;">
            </div>
          </div>
        </div>

        <div class="subsection">
          <button class="subsection-toggle" @click="showCustomCSS = !showCustomCSS">
            <span class="toggle-icon">{{ showCustomCSS ? '▼' : '▶' }}</span>
            自定義 CSS
          </button>
          
          <div v-if="showCustomCSS" class="subsection-content">
            <textarea 
              v-model="customCSS"
              class="css-editor"
              placeholder="/* 在此輸入自定義 CSS */"></textarea>
            
            <div class="subsection-actions">
              <button class="primary-btn small" @click="applyCustomCSS">套用</button>
              <button class="secondary-btn small" @click="previewCustomCSS">預覽</button>
              <button class="secondary-btn small" @click="clearCustomCSS">清除</button>
            </div>

            <div class="subsection-footer">
              <button class="icon-btn-action" @click="exportCSS">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                匯出CSS
              </button>
              <button class="icon-btn-action" @click="triggerCSSImport">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                匯入CSS
              </button>
              <input 
                ref="cssFileInput" 
                type="file" 
                accept=".json,.css"
                @change="handleCSSImport"
                style="display: none;">
            </div>
          </div>
        </div>

        <div class="subsection">
          <button class="subsection-toggle" @click="showFontSettings = !showFontSettings">
            <span class="toggle-icon">{{ showFontSettings ? '▼' : '▶' }}</span>
            默認字體
          </button>
          
          <div v-if="showFontSettings" class="subsection-content">
            <div class="font-setting-row">
              <label>字體大小</label>
              <div class="font-size-control">
                <button class="font-size-btn" @click="decreaseFontSize" :disabled="editingFontSize <= 12">−</button>
                <span class="font-size-value">{{ editingFontSize }}px</span>
                <button class="font-size-btn" @click="increaseFontSize" :disabled="editingFontSize >= 24">+</button>
              </div>
            </div>
            <div class="font-setting-row">
              <label>更改默認字體</label>
              <select v-model="editingFontFamily" class="font-family-select" @change="applyFontSettings">
                <option value="">系統預設(思源黑體)</option>
                <option v-for="font in fontOptions" :key="font.value" :value="font.value" :style="{ fontFamily: font.value }">
                  {{ font.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h4><span class="section-icon" v-html="icons.import"></span> 圖包管理</h4>
        <div class="pack-actions">
          <button class="primary-btn" @click="showImporter = true">匯入圖包</button>
          <button class="secondary-btn" @click="loadDemoPack" :disabled="isLoadingDemo">
            {{ isLoadingDemo ? '載入中...' : '載入示範圖包' }}
          </button>
          <button class="secondary-btn" @click="loadDefaultFilters" :disabled="isLoadingFilters">
            {{ isLoadingFilters ? '載入中...' : '載入默認濾鏡' }}
          </button>
          <button class="secondary-btn" @click="exportAllPacks" :disabled="isExportingPacks">
            {{ isExportingPacks ? '匯出中...' : '匯出所有圖包' }}
          </button>
        </div>
        <div class="pack-delete">
          <label for="packSelect">匯出 / 刪除單一圖包</label>
          <div class="delete-row">
            <select id="packSelect" v-model="selectedPackId">
              <option disabled value="">選擇圖包</option>
              <option v-for="pack in gameStore.availablePacks" :key="pack.id" :value="pack.id">
                {{ pack.displayName || pack.name }}
              </option>
            </select>
            <button class="secondary-btn" @click="exportSelectedPack" :disabled="!selectedPackId">匯出</button>
            <button class="delete-btn" @click="deleteSelectedPack" :disabled="!selectedPackId">刪除</button>
          </div>
          <div v-if="gameStore.availablePacks.length === 0" class="empty-list">
            尚未匯入任何圖包
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h4><span class="section-icon" v-html="icons.cloud"></span> 雲端同步（Google Drive）</h4>

        <div class="cloud-status" :class="{ connected: isGoogleReady }">
          <span class="status-dot"></span>
          <span v-if="isGoogleReady" class="status-text">已連線 Google 雲端</span>
          <span v-else class="status-text">尚未連線</span>
        </div>

        <div class="cloud-actions">
          <template v-if="!isGoogleReady">
            <button class="primary-btn" @click="connectGoogle" :disabled="isCloudBusy">
              {{ isCloudBusy ? '連線中...' : '登入 Google' }}
            </button>
          </template>
          <template v-else>
            <button class="secondary-btn" @click="uploadToDrive" :disabled="isCloudBusy">
              {{ isCloudBusy ? '處理中...' : '上傳備份到雲端' }}
            </button>
            <button class="secondary-btn" @click="syncFromDrive" :disabled="isCloudBusy">
              {{ isCloudBusy ? '處理中...' : '從雲端還原' }}
            </button>
            <label class="auto-backup-toggle checkbox-custom-container">
              <input type="checkbox" :checked="autoBackupEnabled" @change="toggleAutoBackup" />
              <span class="checkbox-custom auto-backup-check"></span>
              <span>定時自動備份（每 5 分鐘）</span>
            </label>
            <p v-if="autoBackupEnabled" class="auto-backup-status hint">
              ⏱ 自動備份已啟用{{ nextAutoBackupText }}
            </p>
            <button class="danger-btn small" @click="disconnectGoogle">登出 Google</button>
          </template>
        </div>
        <p class="hint">備份資料存放於 Google Drive「dress-up-doll」資料夾中，最多保留最新 5 筆備份。</p>
      </div>
      
      <div class="settings-section">
        <h4><span class="section-icon" v-html="icons.database"></span> 資料管理</h4>
        <div class="dual-actions">
          <button class="primary-btn" @click="triggerImportAllData">匯入所有資料</button>
          <button class="secondary-btn" @click="exportAllData" :disabled="isExportingAll">
            {{ isExportingAll ? '匯出中...' : '匯出所有資料' }}
          </button>
        </div>
        <input
          ref="allDataFileInput"
          type="file"
          accept=".json"
          @change="handleImportAllData"
          style="display: none;">
      </div>

      <div class="settings-section">
        <h4><span class="section-icon" v-html="icons.warning"></span> 危險區域</h4>
        <div class="dual-actions">
          <button @click="clearAllData" class="danger-btn small-danger">清空所有本地數據</button>
        </div>
        <p class="hint">將刪除所有匯入物件、儲存搭配、自定義主題、自定義 CSS 及所有設置，且無法復原！</p>
      </div>
    </div>
  </div>

  <teleport to="body">
    <div v-if="showImporter" class="modal-overlay" @click="showImporter = false">
      <Importer @close="showImporter = false" @click.stop />
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, reactive, nextTick, onUnmounted } from 'vue';
import { useGameStore, presetThemes } from '../store/index.js';
import { icons } from '../icons.js';
import Importer from './Importer.vue';
import DressingCore from '../core/index.js';
import { ensureAccessToken, uploadJsonFile, downloadLatestJson, signOut, hasPreviousAuth, pruneOldBackups, tryRestoreSession, interactiveSignIn, isTokenValid, listBackupFiles, deleteFile as deleteGDriveFile } from '../core/googleDrive.js';
import iro from '@jaames/iro';

defineEmits(['close']);
const gameStore = useGameStore();
const showImporter = ref(false);
const selectedPackId = ref('');
const isExportingAll = ref(false);
const isExportingPacks = ref(false);
const isGoogleReady = ref(false);
const isCloudBusy = ref(false);
const isLoadingDemo = ref(false);
const isLoadingFilters = ref(false);
const autoBackupEnabled = ref(false);
const nextAutoBackupText = ref('');
let autoBackupTimer = null;
let autoBackupCountdownTimer = null;
let autoBackupNextTime = 0;
const GOOGLE_CLIENT_ID = '1072091993433-7j096q60fvp6o68micf5hupocvtat2g6.apps.googleusercontent.com';
const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 分鐘

const showColorEditor = ref(false);
const showCustomCSS = ref(false);
const showFontSettings = ref(false);
const newThemeName = ref('');
const colorFileInput = ref(null);
const cssFileInput = ref(null);
const allDataFileInput = ref(null);
const customCSS = ref('');
const activeColorKey = ref(null);

const presetThemesList = presetThemes;

const editingFontSize = ref(16);
const editingFontFamily = ref('');
const fontOptions = [
  { label: '微軟正黑體', value: '"Microsoft JhengHei", sans-serif' },
  { label: '思源宋體', value: '"Noto Serif TC", serif' },
  { label: '仙人掌古典明朝 (Cactus Classical Serif)', value: '"Cactus Classical Serif", serif' },
  { label: '巧克力古典黑 (Chocolate Classical Sans)', value: '"Chocolate Classical Sans", sans-serif' },
  { label: '霞鶩文楷 TC', value: '"LXGW WenKai TC", cursive' },
  { label: '昭源宋體', value: '"Chiron Sung HK", serif' },
  { label: '霞鶩文楷等寬 TC', value: '"LXGW WenKai Mono TC", monospace' },
  { label: '昭源圓體 TC', value: '"Chiron GoRound TC", sans-serif' },
  { label: '昭源黑體', value: '"Chiron Hei HK", sans-serif' },
];

// 從 CSS 變數動態讀取預設顏色，確保與 index.html 同步
const getCSSVariable = (name) => {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
};

const colorKeys = [
  'color-primary',
  'color-bg-main',
  'color-bg-panel',
  'color-bg-card',
  'color-bg-canvas',
  'color-text-primary',
  'color-text-secondary',
  'color-border',
  'color-success',
  'color-error',
  'color-warning',
  'color-info',
];

const getDefaultColors = () => {
  const colors = {};
  colorKeys.forEach(key => {
    colors[key] = getCSSVariable(key) || '#000000';
  });
  return colors;
};

const defaultColors = getDefaultColors();

const colorLabels = {
  'color-primary': '主題色',
  'color-bg-main': '主背景色',
  'color-bg-panel': '面板背景色',
  'color-bg-card': '主卡片顏色',
  'color-bg-canvas': '畫布顏色',
  'color-text-primary': '主要文字色',
  'color-text-secondary': '次要文字色',
  'color-border': '邊框色',
  'color-success': '成功色',
  'color-error': '錯誤色',
  'color-warning': '警告色',
  'color-info': '資訊色',
};

const editingColors = reactive({ ...defaultColors });

const iroPickerContainer = ref(null);
let iroColorPicker = null;

const openColorPicker = async (key) => {
  activeColorKey.value = key;
  await nextTick();
  initIroColorPicker();
};

const closeColorPicker = () => {
  if (iroColorPicker) {
    iroColorPicker.off('color:change', handleIroColorChange);
    iroColorPicker = null;
  }
  activeColorKey.value = null;
};

const initIroColorPicker = () => {
  if (!iroPickerContainer.value || !activeColorKey.value) return;
  
  iroPickerContainer.value.innerHTML = '';
  
  iroColorPicker = new iro.ColorPicker(iroPickerContainer.value, {
    width: 200,
    color: editingColors[activeColorKey.value],
    borderWidth: 1,
    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#ddd',
    layout: [
      {
        component: iro.ui.Box,
      },
      {
        component: iro.ui.Slider,
        options: { sliderType: 'hue' }
      }
    ]
  });
  
  iroColorPicker.on('color:change', handleIroColorChange);
};

const handleIroColorChange = (color) => {
  if (activeColorKey.value) {
    editingColors[activeColorKey.value] = color.hexString;
  }
};

const getCurrentRgbValues = () => {
  if (!activeColorKey.value) return { r: 0, g: 0, b: 0 };
  const hex = editingColors[activeColorKey.value] || '#000000';
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
};

const handleHexInput = (event) => {
  let value = event.target.value;
  if (!value.startsWith('#')) {
    value = '#' + value;
  }
  value = value.replace(/[^#0-9A-Fa-f]/g, '').slice(0, 7);
  
  if (activeColorKey.value && value.length === 7) {
    editingColors[activeColorKey.value] = value;
    if (iroColorPicker) {
      iroColorPicker.color.hexString = value;
    }
  }
};

const validateHexInput = (event) => {
  let value = event.target.value;
  if (!value.startsWith('#')) {
    value = '#' + value;
  }
  if (value.length < 7) {
    value = value.padEnd(7, '0');
  }
  if (activeColorKey.value) {
    editingColors[activeColorKey.value] = value.slice(0, 7);
    if (iroColorPicker) {
      iroColorPicker.color.hexString = value.slice(0, 7);
    }
  }
};

const handleRgbInput = (channel, event) => {
  if (!activeColorKey.value) return;
  
  let value = parseInt(event.target.value) || 0;
  value = Math.max(0, Math.min(255, value));
  
  const { r, g, b } = getCurrentRgbValues();
  let newR = r, newG = g, newB = b;
  
  if (channel === 'r') newR = value;
  if (channel === 'g') newG = value;
  if (channel === 'b') newB = value;
  
  const hex = '#' + 
    newR.toString(16).padStart(2, '0') +
    newG.toString(16).padStart(2, '0') +
    newB.toString(16).padStart(2, '0');
  
  editingColors[activeColorKey.value] = hex;
  
  if (iroColorPicker) {
    iroColorPicker.color.hexString = hex;
  }
};

onMounted(() => {
  customCSS.value = gameStore.theme.customCSS || '';
  editingFontSize.value = gameStore.theme.fontSize || 16;
  editingFontFamily.value = gameStore.theme.fontFamily || '';
  
  // 載入當前主題的顏色或預覽顏色
  if (gameStore.theme.previewColors) {
    Object.assign(editingColors, gameStore.theme.previewColors);
  } else if (gameStore.theme.currentTheme !== 'default') {
    const preset = presetThemes.find(t => t.id === gameStore.theme.currentTheme);
    const currentTheme = preset || gameStore.theme.customThemes.find(
      t => t.id === gameStore.theme.currentTheme
    );
    if (currentTheme && currentTheme.colors) {
      Object.assign(editingColors, currentTheme.colors);
    }
  }

  // 嘗試從 localStorage 恢復登入狀態（不觸發 popup）
  restoreSession();
});

onUnmounted(() => {
  if (iroColorPicker) {
    iroColorPicker.off('color:change', handleIroColorChange);
    iroColorPicker = null;
  }
  
  if (gameStore.theme.previewColors) {
    gameStore.clearPreviewColors();
    gameStore.applyTheme(gameStore.theme.currentTheme);
  }
  
  // 自動備份 timer 不在此清除，因為它應在整個 session 中持續運作
  // 只清除倒數顯示 timer
  if (autoBackupCountdownTimer) {
    clearInterval(autoBackupCountdownTimer);
    autoBackupCountdownTimer = null;
  }
});

const handleThemeClick = (themeId) => {
  if (themeId === gameStore.theme.currentTheme) {
    showColorEditor.value = !showColorEditor.value;
    return;
  }
  applyTheme(themeId);
};

const applyTheme = async (themeId) => {
  await gameStore.setCurrentTheme(themeId);
  
  if (themeId === 'default') {
    Object.assign(editingColors, defaultColors);
  } else {
    const preset = presetThemes.find(t => t.id === themeId);
    const theme = preset || gameStore.theme.customThemes.find(t => t.id === themeId);
    if (theme && theme.colors) {
      Object.assign(editingColors, theme.colors);
    }
  }
  
  gameStore.showNotification('已套用主題', 'success');
};

const deleteTheme = async (themeId) => {
  if (confirm('確定要刪除此主題嗎？')) {
    await gameStore.deleteCustomTheme(themeId);
    gameStore.showNotification('已刪除主題', 'success');
  }
};

const getThemePreviewStyle = (theme) => {
  const primary = theme.colors?.['color-primary'] || getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  const panel = theme.colors?.['color-bg-panel'] || getComputedStyle(document.documentElement).getPropertyValue('--color-bg-panel').trim();
  return {
    background: `linear-gradient(135deg, ${primary} 0%, ${panel} 100%)`,
  };
};

const getDefaultThemePreviewStyle = () => {
  return {
    background: `linear-gradient(135deg, #a595d1 0%, #c6d3ac 100%)`,
  };
};

const previewColors = async () => {
  const root = document.documentElement;
  Object.entries(editingColors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  await gameStore.savePreviewColors({ ...editingColors });
  gameStore.showNotification('預覽中（已臨時保存）', 'info');
};

const resetColors = () => {
  Object.assign(editingColors, defaultColors);
  gameStore.applyTheme('default');
  gameStore.clearPreviewColors();
  gameStore.showNotification('已重置為預設色', 'info');
};

const saveCurrentTheme = async () => {
  const trimmedName = newThemeName.value.trim();

  if (!trimmedName) {
    // 沒有輸入名稱→覆蓋當前選擇的主題
    const currentId = gameStore.theme.currentTheme;
    if (currentId === 'default') {
      gameStore.showNotification('無法覆蓋預設主題，請輸入新名稱', 'error');
      return;
    }
    const currentTheme = gameStore.theme.customThemes.find(t => t.id === currentId);
    if (!currentTheme) {
      gameStore.showNotification('請輸入主題名稱', 'error');
      return;
    }
    if (!confirm(`是否確認覆蓋「${currentTheme.name}」主題設定？將無法恢復`)) return;
    await gameStore.updateCustomTheme(currentId, { colors: { ...editingColors } });
    gameStore.showNotification('已覆蓋並套用主題', 'success');
    return;
  }

  const theme = await gameStore.addCustomTheme({
    name: trimmedName,
    colors: { ...editingColors },
  });

  await gameStore.setCurrentTheme(theme.id);
  newThemeName.value = '';
  gameStore.showNotification('已儲存並套用主題', 'success');
};

const exportColors = () => {
  const config = {
    type: 'colors-only',
    colors: { ...editingColors },
    exportedAt: new Date().toISOString(),
  };
  downloadJson(config, `colors-${Date.now()}.json`);
  gameStore.showNotification('已匯出顏色設定', 'success');
};

const triggerColorImport = () => {
  colorFileInput.value?.click();
};

const handleColorImport = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const config = JSON.parse(text);
    if (config.colors) {
      Object.assign(editingColors, config.colors);
      // 即時套用到 UI
      const root = document.documentElement;
      Object.entries(editingColors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
      
      const themeName = config.name || `匯入主題 ${new Date().toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      const theme = await gameStore.addCustomTheme({
        name: themeName,
        colors: { ...editingColors },
      });
      await gameStore.setCurrentTheme(theme.id);
      await gameStore.clearPreviewColors();
      gameStore.showNotification(`已匯入並儲存為主題「${themeName}」`, 'success');
    }
  } catch (error) {
    console.error(error);
    gameStore.showNotification('匯入失敗，請檢查檔案格式', 'error');
  }

  event.target.value = '';
};

const exportCSS = () => {
  const config = {
    type: 'css-only',
    customCSS: customCSS.value,
    exportedAt: new Date().toISOString(),
  };
  downloadJson(config, `custom-css-${Date.now()}.json`);
  gameStore.showNotification('已匯出 CSS 設定', 'success');
};

const triggerCSSImport = () => {
  cssFileInput.value?.click();
};

const handleCSSImport = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    // 支援 JSON 或純 CSS 檔案
    if (file.name.endsWith('.json')) {
      const config = JSON.parse(text);
      if (config.customCSS !== undefined) {
        customCSS.value = config.customCSS;
      }
    } else {
      customCSS.value = text;
    }
    gameStore.showNotification('已匯入 CSS 設定', 'success');
  } catch (error) {
    console.error(error);
    gameStore.showNotification('匯入失敗，請檢查檔案格式', 'error');
  }

  event.target.value = '';
};

const applyCustomCSS = async () => {
  await gameStore.setCustomCSS(customCSS.value);
  gameStore.showNotification('已套用自定義 CSS', 'success');
};

const previewCustomCSS = () => {
  gameStore.applyCustomCSS(customCSS.value);
  gameStore.showNotification('預覽中（尚未儲存）', 'info');
};

const clearCustomCSS = async () => {
  customCSS.value = '';
  await gameStore.setCustomCSS('');
  gameStore.showNotification('已清除自定義 CSS', 'success');
};

const increaseFontSize = () => {
  if (editingFontSize.value < 24) {
    editingFontSize.value++;
    applyFontSettings();
  }
};

const decreaseFontSize = () => {
  if (editingFontSize.value > 12) {
    editingFontSize.value--;
    applyFontSettings();
  }
};

const applyFontSettings = async () => {
  await gameStore.setFontSettings(editingFontFamily.value, editingFontSize.value);
};

const deleteSelectedPack = async () => {
  const pack = gameStore.availablePacks.find(p => p.id === selectedPackId.value);
  if (!pack) return;
  if (confirm(`確定要刪除圖包「${pack.displayName || pack.name}」及其所有物件嗎？`)) {
    await gameStore.deletePack(selectedPackId.value);
    selectedPackId.value = '';
  }
};

const exportSelectedPack = () => {
  const pack = gameStore.availablePacks.find(p => p.id === selectedPackId.value);
  if (!pack) return;
  const items = gameStore.wardrobeItems.filter(item => item.packId === pack.id);
  const payload = {
    type: 'pack',
    pack,
    items,
    exportedAt: new Date().toISOString(),
  };
  downloadJson(payload, `pack-${pack.id}.json`);
  gameStore.showNotification(`已匯出圖包：${pack.displayName || pack.name}`, 'success');
};

const exportAllPacks = async () => {
  isExportingPacks.value = true;
  try {
    const allItems = await DressingCore.getAllData('items');
    const payload = {
      type: 'packs-backup',
      exportedAt: new Date().toISOString(),
      packs: gameStore.availablePacks,
      items: allItems,
      schemaVersion: 2,
    };
    downloadJson(payload, `doll-packs-${Date.now()}.json`);
    gameStore.showNotification('所有圖包已匯出', 'success');
  } catch {
    gameStore.showNotification('匯出失敗', 'error');
  } finally {
    isExportingPacks.value = false;
  }
};

const exportAllData = async () => {
  isExportingAll.value = true;
  try {
    const { items, outfits } = await gameStore.getFullExportData();
    const appState = await gameStore.getAppStateForBackup();
    const payload = {
      type: 'full-backup',
      exportedAt: new Date().toISOString(),
      packs: gameStore.availablePacks,
      items,
      outfits,
      theme: {
        currentTheme: gameStore.theme.currentTheme,
        customThemes: gameStore.theme.customThemes,
        customCSS: gameStore.theme.customCSS,
        fontFamily: gameStore.theme.fontFamily,
        fontSize: gameStore.theme.fontSize,
        previewColors: gameStore.theme.previewColors,
      },
      appState,
      hiddenItems: gameStore.hiddenItems,
      dismissedBundledPacks: gameStore.dismissedBundledPacks,
      schemaVersion: 2,
    };
    downloadJson(payload, `doll-backup-${Date.now()}.json`);
    gameStore.showNotification('全部資料已匯出', 'success');
  } catch {
    gameStore.showNotification('匯出失敗', 'error');
  } finally {
    isExportingAll.value = false;
  }
};

const triggerImportAllData = () => {
  allDataFileInput.value?.click();
};

const handleImportAllData = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.type !== 'full-backup') {
      gameStore.showNotification('檔案格式不正確，請選擇完整備份檔', 'error');
      return;
    }
    if (!confirm('匯入所有資料將覆蓋本機所有資料，確定要繼續嗎？')) return;
    await gameStore.clearAllData();
    for (const pack of data.packs || []) await gameStore.addPack(pack);
    for (const item of data.items || []) await gameStore.addNewItem(item);
    for (const outfit of data.outfits || []) await gameStore.importOutfit(outfit);
    if (data.theme) await gameStore.restoreThemeFromBackup(data.theme);
    if (Array.isArray(data.hiddenItems)) {
      gameStore.hiddenItems = data.hiddenItems;
      await gameStore.saveHiddenItems();
    }
    if (Array.isArray(data.dismissedBundledPacks)) {
      gameStore.dismissedBundledPacks = data.dismissedBundledPacks;
      await gameStore.saveDismissedBundledPacks();
    }
    if (data.appState) {
      await gameStore.restoreAppStateFromBackup(data.appState);
    }
    gameStore.showNotification('所有資料已匯入', 'success');
  } catch {
    gameStore.showNotification('匯入失敗，請檢查檔案格式', 'error');
  }
  event.target.value = '';
};

const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const BACKUP_FILENAME = 'doll-backup.json';

const connectGoogle = async () => {
  isCloudBusy.value = true;
  try {
    // 使用互動式登入，確保彈出 Google 帳號選擇 / 授權畫面
    await interactiveSignIn(GOOGLE_CLIENT_ID);
    isGoogleReady.value = true;
    gameStore.showNotification('已登入 Google', 'success');
  } catch (err) {
    console.error(err);
    gameStore.showNotification('Google 登入失敗，請稍後再試', 'error');
  } finally {
    isCloudBusy.value = false;
  }
};

const disconnectGoogle = () => {
  signOut();
  isGoogleReady.value = false;
  stopAutoBackup();
  gameStore.showNotification('已登出 Google', 'info');
};

/**
 * 從 localStorage 恢復登入狀態（不觸發任何 OAuth 彈窗）。
 * 只有當儲存的 token 仍然有效時才會成功。
 */
const restoreSession = async () => {
  if (isGoogleReady.value) return;
  if (!hasPreviousAuth()) return;
  isCloudBusy.value = true;
  try {
    const ok = await tryRestoreSession(GOOGLE_CLIENT_ID);
    if (ok) {
      isGoogleReady.value = true;
      // 恢復自動備份設定
      try {
        const saved = localStorage.getItem('auto-backup-enabled');
        if (saved === 'true') {
          startAutoBackup(true);
        }
      } catch {}
    }
  } catch { /* 恢復失敗不提示 */ }
  finally { isCloudBusy.value = false; }
};

/** 生成帶時間編碼的備份檔名，如 doll-backup-0730AM */
const getTimestampedBackupName = () => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = String(hours).padStart(2, '0') + minutes + ampm;
  return `doll-backup-${timeStr}`;
};

const toggleAutoBackup = (event) => {
  if (event.target.checked) {
    const confirmed = confirm(
      '⚠️ 注意：啟用自動備份後，系統將每 5 分鐘自動上傳備份至雲端。\n\n' +
      '新的備份可能會覆蓋較舊的備份檔案（僅保留最新 5 筆）。\n' +
      '請確認您了解此機制，再決定是否啟用。'
    );
    if (confirmed) {
      startAutoBackup(false);
    } else {
      event.target.checked = false;
    }
  } else {
    stopAutoBackup();
  }
};

const startAutoBackup = (silent = false) => {
  autoBackupEnabled.value = true;
  try { localStorage.setItem('auto-backup-enabled', 'true'); } catch {}
  
  autoBackupNextTime = Date.now() + AUTO_BACKUP_INTERVAL;
  updateCountdownText();
  
  autoBackupCountdownTimer = setInterval(updateCountdownText, 30000);
  
  autoBackupTimer = setInterval(async () => {
    if (!isGoogleReady.value || isCloudBusy.value) return;
    try {
      await performAutoBackup();
      autoBackupNextTime = Date.now() + AUTO_BACKUP_INTERVAL;
    } catch (err) {
      console.warn('自動備份失敗:', err);
    }
  }, AUTO_BACKUP_INTERVAL);
  
  if (!silent) {
    gameStore.showNotification('已啟用自動備份（每 5 分鐘）', 'success');
  }
};

const stopAutoBackup = () => {
  autoBackupEnabled.value = false;
  try { localStorage.setItem('auto-backup-enabled', 'false'); } catch {}
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
  if (autoBackupCountdownTimer) { clearInterval(autoBackupCountdownTimer); autoBackupCountdownTimer = null; }
  nextAutoBackupText.value = '';
};

const updateCountdownText = () => {
  const remaining = Math.max(0, autoBackupNextTime - Date.now());
  const mins = Math.ceil(remaining / 60000);
  nextAutoBackupText.value = mins > 0 ? `（下次備份約 ${mins} 分鐘後）` : '（即將備份...）';
};

const performAutoBackup = async () => {
  isCloudBusy.value = true;
  try {
    await ensureAccessToken();
    const { items, outfits } = await gameStore.getFullExportData();
    const appState = await gameStore.getAppStateForBackup();
    const payload = {
      type: 'full-backup',
      exportedAt: new Date().toISOString(),
      packs: gameStore.availablePacks,
      items,
      outfits,
      theme: {
        currentTheme: gameStore.theme.currentTheme,
        customThemes: gameStore.theme.customThemes,
        customCSS: gameStore.theme.customCSS,
        fontFamily: gameStore.theme.fontFamily,
        fontSize: gameStore.theme.fontSize,
        previewColors: gameStore.theme.previewColors,
      },
      appState,
      hiddenItems: gameStore.hiddenItems,
      dismissedBundledPacks: gameStore.dismissedBundledPacks,
      schemaVersion: 2,
    };
    const backupName = getTimestampedBackupName();
    await uploadJsonFile({ name: `${backupName}.json`, json: payload });
    await pruneOldBackups({ name: BACKUP_FILENAME, keep: 5 });
    // 也清理時間編碼的備份
    await pruneTimedBackups();
    gameStore.showNotification('自動備份完成', 'success');
  } catch (err) {
    console.error('自動備份失敗:', err);
    if (!isTokenValid()) {
      isGoogleReady.value = false;
      stopAutoBackup();
    }
  } finally {
    isCloudBusy.value = false;
  }
};

const pruneTimedBackups = async () => {
  try {
    const files = await listBackupFiles({ name: 'doll-backup' });
    if (files.length > 5) {
      const toDelete = files.slice(5);
      for (const f of toDelete) {
        try { await deleteGDriveFile(f.id); } catch {}
      }
    }
  } catch {}
};

const uploadToDrive = async () => {
  isCloudBusy.value = true;
  try {
    await ensureAccessToken();
    const { items, outfits } = await gameStore.getFullExportData();
    const appState = await gameStore.getAppStateForBackup();
    const payload = {
      type: 'full-backup',
      exportedAt: new Date().toISOString(),
      packs: gameStore.availablePacks,
      items,
      outfits,
      theme: {
        currentTheme: gameStore.theme.currentTheme,
        customThemes: gameStore.theme.customThemes,
        customCSS: gameStore.theme.customCSS,
        fontFamily: gameStore.theme.fontFamily,
        fontSize: gameStore.theme.fontSize,
        previewColors: gameStore.theme.previewColors,
      },
      appState,
      hiddenItems: gameStore.hiddenItems,
      dismissedBundledPacks: gameStore.dismissedBundledPacks,
      schemaVersion: 2,
    };
    const backupName = getTimestampedBackupName();
    await uploadJsonFile({ name: `${backupName}.json`, json: payload });

    // 僅保留最新 5 筆備份（含舊格式與時間編碼格式）
    const deleted = await pruneOldBackups({ name: BACKUP_FILENAME, keep: 5 });
    await pruneTimedBackups();
    const extra = deleted > 0 ? `（已清理 ${deleted} 筆舊備份）` : '';
    gameStore.showNotification(`已上傳備份 ${backupName} 到 Google Drive${extra}`, 'success');
  } catch (err) {
    console.error('雲端上傳失敗:', err);
    if (!isTokenValid()) isGoogleReady.value = false;
    const detail = err?.message || '';
    const status = detail.match(/\((\d+)\)/)?.[1];
    if (status === '401' || status === '403') {
      gameStore.showNotification('上傳失敗：權限過期，請重新登入 Google', 'error');
      isGoogleReady.value = false;
    } else {
      gameStore.showNotification(`上傳失敗：${detail.slice(0, 80) || '請檢查網路'}`, 'error');
    }
  } finally {
    isCloudBusy.value = false;
  }
};

const syncFromDrive = async () => {
  isCloudBusy.value = true;
  try {
    await ensureAccessToken();
    const data = await downloadLatestJson({ name: BACKUP_FILENAME });
    if (!data) {
      gameStore.showNotification('雲端沒有備份檔', 'info');
      return;
    }
    if (!confirm('從雲端還原將覆蓋本機所有資料，確定要繼續嗎？')) return;
    await gameStore.clearAllData();
    for (const pack of data.packs || []) await gameStore.addPack(pack);
    for (const item of data.items || []) await gameStore.addNewItem(item);
    for (const outfit of data.outfits || []) await gameStore.importOutfit(outfit);

    // 還原主題設定（schemaVersion >= 2）
    if (data.theme) {
      await gameStore.restoreThemeFromBackup(data.theme);
    }
    // 還原隱藏物件清單
    if (Array.isArray(data.hiddenItems)) {
      gameStore.hiddenItems = data.hiddenItems;
      await gameStore.saveHiddenItems();
    }
    // 還原已關閉的附贈圖包
    if (Array.isArray(data.dismissedBundledPacks)) {
      gameStore.dismissedBundledPacks = data.dismissedBundledPacks;
      await gameStore.saveDismissedBundledPacks();
    }
    // 還原畫布暫存狀態
    if (data.appState) {
      await gameStore.restoreAppStateFromBackup(data.appState);
    }

    gameStore.showNotification('已從雲端同步完成', 'success');
  } catch (err) {
    console.error('雲端同步失敗:', err);
    if (!isTokenValid()) isGoogleReady.value = false;
    const detail = err?.message || '';
    const status = detail.match(/\((\d+)\)/)?.[1];
    if (status === '401' || status === '403') {
      gameStore.showNotification('同步失敗：權限過期，請重新登入 Google', 'error');
      isGoogleReady.value = false;
    } else {
      gameStore.showNotification(`同步失敗：${detail.slice(0, 80) || '請檢查網路'}`, 'error');
    }
  } finally {
    isCloudBusy.value = false;
  }
};

const clearAllData = async () => {
  if (!confirm('確定要清空所有本地數據嗎？\n將刪除所有匯入物件、儲存搭配、主題與自定義設置，且無法復原！')) return;
  await gameStore.clearAllData();
  // 重置本地 UI 狀態
  Object.assign(editingColors, getDefaultColors());
  customCSS.value = '';
  newThemeName.value = '';
  editingFontSize.value = 16;
  editingFontFamily.value = '';
};

const DEMO_PACK_ID = 'demo-sample-pack';

const loadDemoPack = async () => {
  if (gameStore.availablePacks.some(p => p.id === DEMO_PACK_ID)) {
    gameStore.showNotification('示範圖包已存在，請先刪除後再重新載入', 'info');
    return;
  }
  
  isLoadingDemo.value = true;
  try {
    const basePath = import.meta.env.BASE_URL;
    const manifestUrl = `${basePath}demo-pack/manifest.json`;
    const manifestResp = await fetch(manifestUrl);
    if (!manifestResp.ok) throw new Error('找不到示範圖包（尚未放入 public/demo-pack/）');
    
    const manifest = await manifestResp.json();
    
    // 載入每個圖片為 base64
    const items = [];
    for (const item of manifest.items) {
      const imgResp = await fetch(`${basePath}demo-pack/${item.image}`);
      if (!imgResp.ok) continue;
      const blob = await imgResp.blob();
      const imageData = await blobToDataURL(blob);
      
      items.push({
        id: `${DEMO_PACK_ID}-${item.id}`,
        name: item.name,
        displayName: item.displayName || item.name,
        category: item.category,
        packId: DEMO_PACK_ID,
        imageData,
        width: item.width || manifest.defaultWidth || 2000,
        height: item.height || manifest.defaultHeight || 3800,
        variants: item.variants || null,
        variantImages: item.variantImages || null,
        tags: item.tags || [],
      });
    }
    
    // 儲存圖包資訊
    const packInfo = {
      id: DEMO_PACK_ID,
      name: manifest.name || 'demo-sample-pack',
      displayName: manifest.displayName || '示範圖包',
      description: manifest.description || '內建示範用紙娃娃圖包',
      itemCount: items.length,
      isDemo: true,
    };
    
    for (const item of items) {
      await gameStore.addNewItem(item);
    }
    await gameStore.addPack(packInfo);
    
    gameStore.showNotification(`已載入示範圖包，包含 ${items.length} 個物件`, 'success');
  } catch (err) {
    console.error('載入示範圖包失敗:', err);
    gameStore.showNotification(`載入示範圖包失敗: ${err.message}`, 'error');
  } finally {
    isLoadingDemo.value = false;
  }
};

const blobToDataURL = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const DEFAULT_FILTERS_PACK_ID = 'default-filters-pack';

const loadDefaultFilters = async () => {
  if (gameStore.availablePacks.some(p => p.id === DEFAULT_FILTERS_PACK_ID)) {
    gameStore.showNotification('默認濾鏡已存在，請先刪除後再重新載入', 'info');
    return;
  }
  
  isLoadingFilters.value = true;
  try {
    const basePath = import.meta.env.BASE_URL;
    const manifestUrl = `${basePath}default-filters/manifest.json`;
    const manifestResp = await fetch(manifestUrl);
    if (!manifestResp.ok) throw new Error('找不到默認濾鏡資料');
    
    const manifest = await manifestResp.json();
    
    const items = [];
    for (const item of manifest.items) {
      // 載入預覽圖
      let imageData = '';
      try {
        const imgResp = await fetch(`${basePath}default-filters/${item.image}`);
        if (imgResp.ok) {
          const blob = await imgResp.blob();
          imageData = await blobToDataURL(blob);
        }
      } catch {
        // 預覽圖載入失敗時使用空白佔位
        imageData = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ccc" rx="8"/></svg>');
      }
      
      items.push({
        id: `${DEFAULT_FILTERS_PACK_ID}-${item.id}`,
        name: item.name,
        displayName: item.displayName || item.name,
        category: item.category,
        packId: DEFAULT_FILTERS_PACK_ID,
        imageData,
        width: item.width || manifest.defaultWidth || 2000,
        height: item.height || manifest.defaultHeight || 3800,
        filterEffect: item.filterEffect || null,
        tags: item.tags || [],
      });
    }
    
    const packInfo = {
      id: DEFAULT_FILTERS_PACK_ID,
      name: manifest.name || 'default-filters',
      displayName: manifest.displayName || '默認濾鏡',
      description: manifest.description || '內建 CSS 特效濾鏡',
      itemCount: items.length,
      isDefaultFilters: true,
    };
    
    for (const item of items) {
      await gameStore.addNewItem(item);
    }
    await gameStore.addPack(packInfo);
    
    gameStore.showNotification(`已載入默認濾鏡，包含 ${items.length} 種效果`, 'success');
  } catch (err) {
    console.error('載入默認濾鏡失敗:', err);
    gameStore.showNotification('載入失敗：' + (err.message || '未知錯誤'), 'error');
  } finally {
    isLoadingFilters.value = false;
  }
};
</script>

<style scoped>
.settings-modal {
  width: 600px;
  max-width: 90vw;
  max-height: 90vh;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: var(--color-bg-panel);
}

.settings-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 1.25rem;
}

.settings-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.settings-content::-webkit-scrollbar {
  width: 4px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary);
}

.settings-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.settings-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.settings-section h4 {
  margin: 0 0 1rem 0;
  color: var(--color-text-primary);
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theme-selector {
  margin-bottom: 1rem;
}

.theme-selector label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  cursor: pointer;
  transition: var(--transition-fast);
  position: relative;
}

.theme-option:hover {
  border-color: var(--color-bg-panel);
  transform: translateY(-2px);
}

.theme-option.active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.theme-preview {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.theme-option span {
  font-size: 0.75rem;
  color: var(--color-text-primary);
  text-align: center;
  line-height: 1.2;
}

.delete-theme-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  background: var(--color-error);
  color: var(--color-bg-main);
  border-radius: var(--radius-full);
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: var(--transition-fast);
}

.theme-option:hover .delete-theme-btn {
  opacity: 1;
}

.subsection {
  margin-top: 0.5rem;
}

.subsection + .subsection {
  margin-top: 0.25rem;
}

.subsection-toggle {
  background: none;
  border: none;
  padding: 0.35rem 0;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: var(--transition-fast);
}

.subsection-toggle:hover {
  color: var(--color-primary);
}

.toggle-icon {
  font-size: 0.75rem;
  display: inline-block;
  width: 1rem;
}

.subsection-content {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--color-bg-panel);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  overflow: hidden;
  box-sizing: border-box;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.color-swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.color-swatch-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.color-swatch {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px color-mix(in srgb, var(--color-text-primary) 10%, transparent);
}

.color-swatch:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px color-mix(in srgb, var(--color-text-primary) 20%, transparent);
}

.color-swatch.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary);
}

.swatch-label {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.2;
  max-width: 60px;
  word-break: keep-all;
}

.color-picker-popup {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  margin-bottom: 1rem;
  box-shadow: var(--shadow-md);
}

.color-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.color-picker-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0.25rem;
  line-height: 1;
}

.color-picker-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.iro-picker-container {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.color-input-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.color-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-input-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  min-width: 35px;
}

.color-input {
  font-family: monospace;
  font-size: 0.8rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-main);
  color: var(--color-text-primary);
  transition: border-color 0.2s;
}

.color-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.hex-input {
  flex: 1;
  text-transform: uppercase;
}

.rgb-row {
  flex-wrap: wrap;
}

.rgb-inputs {
  display: flex;
  gap: 0.35rem;
  flex: 1;
}

.rgb-input {
  width: 55px;
  text-align: center;
  -moz-appearance: textfield;
}

.rgb-input::-webkit-outer-spin-button,
.rgb-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.color-info-display {
  width: 100%;
  background: var(--color-bg-panel);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
}

.color-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  padding: 0.25rem 0;
}

.color-info-label {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.color-info-value {
  font-family: monospace;
  color: var(--color-text-primary);
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.color-item label {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.color-control {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.color-control input[type="color"] {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 1px;
  flex-shrink: 0;
}

.color-hex {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: monospace;
  color: var(--color-text-primary);
  background: var(--color-bg-main);
  transition: border-color 0.2s;
}

.color-hex:focus {
  outline: none;
  border-color: var(--color-primary);
}

.subsection-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: stretch;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.subsection-actions .theme-name-input {
  flex: 1;
  min-width: 120px;
}

.subsection-actions button {
  white-space: nowrap;
}

.theme-name-input {
  flex: 1;
  min-width: 120px;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-main);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  color: var(--color-text-primary);
  transition: border-color 0.2s;
}

.theme-name-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.subsection-footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.icon-btn-action {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-primary);
  transition: var(--transition-fast);
}

.icon-btn-action:hover {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.icon-btn-action svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.css-editor {
  width: 100%;
  min-height: 150px;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  resize: vertical;
  background: var(--color-bg-main);
  color: var(--color-text-primary);
  box-sizing: border-box;
  max-width: 100%;
  transition: border-color 0.2s;
}

.css-editor:focus {
  outline: none;
  border-color: var(--color-primary);
}

.font-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.font-setting-row + .font-setting-row {
  border-top: 1px solid var(--color-border);
}

.font-setting-row label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.font-size-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.font-size-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
  line-height: 1;
}

.font-size-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.font-size-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.font-size-value {
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
  color: var(--color-text-primary);
}

.font-family-select {
  flex: 1;
  max-width: 200px;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-main);
  color: var(--color-text-primary);
  font-size: 0.85rem;
  transition: border-color 0.2s;
}

.font-family-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.primary-btn {
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border: none;
  padding: 0.6rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  transition: var(--transition-fast);
}

.primary-btn.small {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
}

.primary-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary) 85%, transparent);
}

.secondary-btn {
  background-color: color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  transition: var(--transition-fast);
}

.secondary-btn.small {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
}

.secondary-btn:hover {
  background-color: color-mix(in srgb, var(--color-text-primary) 35%, transparent);
}

.secondary-btn:disabled,
.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-btn {
  background-color: var(--color-error);
  color: var(--color-bg-main);
  border: none;
  padding: 0.6rem 0.9rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  transition: var(--transition-fast);
}

.delete-btn:hover {
  background-color: color-mix(in srgb, var(--color-error) 85%, transparent);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.danger-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--color-error);
  color: var(--color-bg-main);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.95rem;
  transition: var(--transition-fast);
}

.danger-btn.small-danger {
  width: auto;
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  background-color: transparent;
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

.danger-btn.small-danger:hover {
  background-color: var(--color-error);
  color: var(--color-bg-main);
}

.danger-btn:hover {
  background-color: color-mix(in srgb, var(--color-error) 85%, transparent);
}

.pack-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.dual-actions {
  display: flex;
  gap: 0.5rem;
}

.dual-actions button {
  flex: 1;
  width: auto;
}

.pack-delete {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pack-delete label {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.delete-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.cloud-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-main);
  border: 1px solid var(--color-border);
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.cloud-status .status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  flex-shrink: 0;
}

.cloud-status.connected .status-dot {
  background: var(--color-success);
  box-shadow: 0 0 6px var(--color-success);
}

.cloud-status .status-text {
  color: var(--color-text-secondary);
}

.cloud-status.connected .status-text {
  color: var(--color-success);
  font-weight: 600;
}

.cloud-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.auto-backup-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-primary);
  width: 100%;
  padding: 0.4rem 0;
}

.auto-backup-toggle input[type="checkbox"] {
  display: none;
}

.auto-backup-toggle .auto-backup-check {
  border-color: var(--color-warning);
}

.auto-backup-toggle input[type="checkbox"]:checked + .auto-backup-check {
  background-color: var(--color-warning);
  border-color: var(--color-warning);
}

.auto-backup-status {
  margin-top: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.danger-btn.small {
  padding: 0.4rem 0.8rem;
  font-size: 0.78rem;
}

select {
  flex: 1;
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-main);
  color: var(--color-text-primary);
  font-size: 0.8rem;
  transition: border-color 0.2s;
}

select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.hint {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: 0.5rem;
  line-height: 1.4;
}

.empty-list {
  color: var(--color-text-secondary);
  text-align: center;
  padding: 1rem;
  font-size: 0.9rem;
}

@media (max-width: 767px) {
  .settings-modal {
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

  .settings-header {
    padding: 0.75rem 1rem;
    /* iOS 安全區域支援 */
    padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
  }

  .settings-header h3 {
    font-size: 1rem;
  }

  .settings-content {
    padding: 1rem;
    /* iOS 安全區域支援 */
    padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  }

  .settings-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
  }

  .settings-section h4 {
    font-size: 1rem;
    gap: 0.35rem;
  }

  .theme-options {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 0.4rem;
  }

  .theme-option {
    padding: 0.4rem;
  }

  .theme-preview {
    width: 42px;
    height: 42px;
  }

  .theme-option span {
    font-size: 0.7rem;
  }

  .delete-theme-btn {
    width: 16px;
    height: 16px;
    font-size: 0.7rem;
    opacity: 1;
  }

  .subsection-toggle {
    font-size: 0.85rem;
  }

  .color-grid {
    grid-template-columns: 1fr;
    gap: 0.4rem;
  }

  .color-item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .color-item label {
    font-size: 0.72rem;
    min-width: 80px;
  }

  .color-control {
    flex: 1;
    justify-content: flex-end;
  }

  .color-control input[type="color"] {
    width: 32px;
    height: 32px;
  }

  .color-hex {
    width: 80px;
    flex: none;
    font-size: 0.8rem;
    padding: 0.35rem 0.4rem;
  }

  .subsection-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }


  .theme-name-input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin-bottom: 0.5rem;
    padding: 0.5rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-bg-main);
    color: var(--color-text-primary);
    display: block;
    font-size: 0.7rem;
  }

  .subsection-actions button {
    width: 100%;
    justify-content: center;
  }

  .subsection-footer {
    flex-direction: column;
    gap: 0.5rem;
  }

  .css-editor {
    min-height: 120px;
    font-size: 0.8rem;
  }

  .css-editor:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .primary-btn,
  .secondary-btn,
  .delete-btn {
    padding: 0.5rem 0.8rem;
    font-size: 0.85rem;
  }

  .primary-btn.small,
  .secondary-btn.small {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
  }

  .pack-actions {
    flex-direction: column;
  }

  .pack-actions button {
    width: 100%;
  }

  .cloud-actions {
    flex-direction: column;
  }

  .cloud-actions button {
    width: 100%;
  }

  .delete-row {
    flex-wrap: wrap;
  }

  .delete-row select {
    width: 100%;
    flex: none;
  }

  .delete-row button {
    flex: 1;
  }

  .danger-btn {
    padding: 0.6rem;
    font-size: 0.9rem;
  }

  .hint {
    font-size: 0.8rem;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .settings-modal {
    width: 90vw;
    max-width: 600px;
    max-height: 85vh;
  }

  .settings-content {
    padding: 1.25rem;
  }

  .color-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .theme-options {
    grid-template-columns: repeat(auto-fill, minmax(75px, 1fr));
  }

  .pack-actions {
    flex-wrap: nowrap;
  }
}
</style>

