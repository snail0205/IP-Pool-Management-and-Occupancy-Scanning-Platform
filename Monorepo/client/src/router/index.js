import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layout/Layout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: 'Dashboard' }
      },
      {
        path: 'pools',
        name: 'PoolList',
        component: () => import('@/views/pool/List.vue'),
        meta: { title: 'IP Pools' }
      },
      {
        path: 'pools/create',
        name: 'PoolCreate',
        component: () => import('@/views/pool/Form.vue'),
        meta: { title: 'Create Pool' }
      },
      {
        path: 'pools/:id/edit',
        name: 'PoolEdit',
        component: () => import('@/views/pool/Form.vue'),
        meta: { title: 'Edit Pool' }
      },
      {
        path: 'pools/:id/ips',
        name: 'PoolIps',
        component: () => import('@/views/pool/IpMatrix.vue'),
        meta: { title: 'Pool IPs' }
      },
      {
        path: 'scan/tasks',
        name: 'ScanTasks',
        component: () => import('@/views/scan/TaskList.vue'),
        meta: { title: 'Scan Tasks' }
      },
      {
        path: 'visual/screen',
        name: 'VisualScreen',
        component: () => import('@/views/visual/Screen.vue'),
        meta: { title: 'Visual Screen' }
      },
      {
        path: 'ops/center',
        name: 'OpsCenter',
        component: () => import('@/views/ops/Center.vue'),
        meta: { title: 'Ops Center' }
      },
      {
        path: 'reports/center',
        name: 'ReportsCenter',
        component: () => import('@/views/reports/Center.vue'),
        meta: { title: 'Reports Center' }
      },
      {
        path: 'system/settings',
        name: 'SystemSettings',
        component: () => import('@/views/system/Settings.vue'),
        meta: { title: 'System Settings' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const token = userStore.token
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth) {
    if (!token) {
      next('/login')
    } else {
      if (!userStore.name) {
        try {
          await userStore.getInfo()
          next()
        } catch (error) {
          userStore.resetToken()
          next('/login')
        }
      } else {
        next()
      }
    }
  } else {
    next()
  }
})

export default router
