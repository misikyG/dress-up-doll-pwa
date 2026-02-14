import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../components/MainApp.vue'),
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('../components/PrivacyPolicy.vue'),
      meta: { title: '隱私權政策 - 紙娃娃換裝系統' }
    }
  ]
})

// 路由切換時更新頁面標題
router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title
  } else {
    document.title = '紙娃娃換裝系統'
  }
})

export default router
