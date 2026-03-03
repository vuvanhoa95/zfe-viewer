import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import ViewerPage from '@/views/ViewerPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/viewer'
  },
  {
    path: '/viewer',
    name: 'viewer',
    component: ViewerPage
  },
  {
    // Catch-all: mọi route lạ đều về viewer
    path: '/:pathMatch(.*)*',
    redirect: '/viewer'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
