import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import ViewerTestPage from '@/views/ViewerTestPage.vue'
import ViewerPage from '@/views/ViewerPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'viewer-test',
    component: ViewerTestPage
  },
  {
    path: '/viewer',
    name: 'viewer-full',
    component: ViewerPage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

