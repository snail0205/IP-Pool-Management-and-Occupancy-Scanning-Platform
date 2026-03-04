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

  if (to.meta.requiresAuth) {
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
    if (token && to.path === '/login') {
      next('/')
    } else {
      next()
    }
  }
})

export default router
