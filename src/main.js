// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './components/App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

console.log('🎮 換裝紙娃娃遊戲啟動中...')