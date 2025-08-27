import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({ // **新增 PWA 配置**
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'] // 快取所有需要的檔案類型
      },
      manifest: {
        name: '換裝紙娃娃遊戲',
        short_name: '紙娃娃',
        description: '一個可自訂圖包的換裝紙娃娃 PWA 遊戲',
        theme_color: '#6a6cff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // 為了讓圖示在所有裝置上更好看
          }
        ]
      }
    })
  ],

  server: {
    host: true,
    port: 3000,
    open: true
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'), // 遊戲主入口
        packer: resolve(__dirname, 'packer.html') // 打包器入口
      }
    }
  }
})