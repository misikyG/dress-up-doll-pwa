import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  base: '/dress-up-doll-pwa/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // 確保新版本的 SW 立即接管，不會用舊快取
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: '紙娃娃 PWA',
        short_name: '紙娃娃',
        description: '紙娃娃換裝應用程式',
        theme_color: '#ffffff',
        background_color: '#f8f5ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dress-up-doll-pwa/',
        scope: '/dress-up-doll-pwa/',
        lang: 'zh-TW',
        categories: ['games', 'entertainment'],
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
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
    // Emit the production site into docs/ so GitHub Pages can serve it directly
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
})