import { createRouter, createWebHistory } from 'vue-router'
import { adminCheck } from './lib/admin'

const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/play', component: () => import('./views/Game.vue') },
  { path: '/leaderboard', component: () => import('./views/Leaderboard.vue') },
  { path: '/admin/login', component: () => import('./views/admin/Login.vue') },
  { path: '/admin', component: () => import('./views/admin/Weeks.vue'), meta: { admin: true } },
  { path: '/admin/results', component: () => import('./views/admin/Results.vue'), meta: { admin: true } },
  { path: '/admin/weeks/:id', component: () => import('./views/admin/WeekEdit.vue'), meta: { admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  if (!to.meta.admin) return true
  return (await adminCheck()) ? true : '/admin/login'
})

export default router
