<template>
  <div class="common-layout">
    <el-container class="root-container">
      <el-aside width="220px" class="aside">
        <div class="aside-logo">
          <span class="logo-dot"></span>
          <span>IP Pool Manager</span>
        </div>
        <el-menu :default-active="activeMenu" class="el-menu-vertical-demo" router>
          <el-menu-item index="/dashboard">
            <el-icon><icon-menu /></el-icon>
            <span>Dashboard</span>
          </el-menu-item>
          <el-menu-item index="/pools">
            <el-icon><document /></el-icon>
            <span>IP Pools</span>
          </el-menu-item>
          <el-menu-item index="/scan/tasks">
            <el-icon><List /></el-icon>
            <span>扫描任务</span>
          </el-menu-item>
          <el-menu-item index="/visual/screen">
            <el-icon><DataBoard /></el-icon>
            <span>可视化大屏</span>
          </el-menu-item>
          <el-menu-item index="/ops/center">
            <el-icon><Bell /></el-icon>
            <span>运维增强中心</span>
          </el-menu-item>
          <el-menu-item index="/reports/center">
            <el-icon><DataAnalysis /></el-icon>
            <span>报表中心</span>
          </el-menu-item>
          <el-menu-item index="/system/settings">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="header">
          <div class="search-wrap">
            <el-input
              v-model="globalSearch"
              class="global-search"
              placeholder="快速搜索：IP段 / 池名称 / task:任务"
              clearable
              @keyup.enter="handleGlobalSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="handleGlobalSearch">搜索</el-button>
          </div>
          <div class="user-info">
            <el-avatar :size="32" :src="circleUrl" class="user-avatar" />
            <span class="user-name">{{ userStore.name }}</span>
            <el-button type="danger" size="small" @click="handleLogout" style="margin-left: 10px">Logout</el-button>
          </div>
        </el-header>
        <el-main class="main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Menu as IconMenu, Document, List, Search, Setting, DataBoard, Bell, DataAnalysis } from '@element-plus/icons-vue'


const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const globalSearch = ref('')
const circleUrl = ref('https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png')

const activeMenu = computed(() => {
  return route.path
})

const handleLogout = async () => {
  await userStore.logout()
  router.push('/login')
}

const handleGlobalSearch = () => {
  const kw = String(globalSearch.value || '').trim()
  if (!kw) return
  if (kw.toLowerCase().startsWith('task:') || kw.toLowerCase().includes('任务')) {
    router.push('/scan/tasks')
    ElMessage.info('已跳转到扫描任务页，可继续按状态筛选')
    return
  }
  router.push({ path: '/pools', query: { keyword: kw } })
}
</script>

<style scoped>
.common-layout {
  min-height: 100dvh;
  background: #f4f7fe;
}
.root-container {
  min-height: 100dvh;
}
.aside {
  background: #0f172a;
  border-right: none;
  min-height: 100dvh;
}
.aside-logo {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 18px;
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.3px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  margin-right: 10px;
  background: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
}
.el-menu-vertical-demo {
  height: calc(100dvh - 60px);
  border-right: none;
  background: transparent;
  overflow-y: auto;
  overflow-x: hidden;
}
:deep(.el-menu) {
  background: transparent;
}
:deep(.el-menu-item) {
  color: #cbd5e1;
}
:deep(.el-menu-item:hover) {
  color: #fff;
  background: rgba(59, 130, 246, 0.2);
}
:deep(.el-menu-item.is-active) {
  color: #fff;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.45), rgba(59, 130, 246, 0.2));
}
.header {
  background-color: #fff;
  border-bottom: 1px solid #e6ebf5;
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
}
.search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.global-search {
  width: 340px;
}
.main {
  background: #f4f7fe;
  min-width: 0;
  overflow: auto;
}
.user-info {
  display: flex;
  align-items: center;
  color: #334155;
}
.user-avatar {
  margin-right: 8px;
}
.user-name {
  font-weight: 600;
  margin-right: 4px;
}
.user-role {
  color: #64748b;
  font-size: 0.9em;
  margin-right: 10px;
}
</style>
