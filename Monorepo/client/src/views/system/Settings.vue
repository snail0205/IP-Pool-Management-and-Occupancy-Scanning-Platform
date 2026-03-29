<template>
  <div class="app-container">
    <el-card shadow="hover">
      <template #header>
        <div class="header">
          <span>系统开发设置</span>
          <el-button type="primary" plain @click="loadSettings">刷新</el-button>
        </div>
      </template>

      <el-form :model="form" label-width="180px" class="settings-form">
        <el-form-item label="默认扫描并发数">
          <el-input-number v-model="form.scanDefaultConcurrency" :min="1" :max="128" />
        </el-form-item>
        <el-form-item label="默认扫描超时(ms)">
          <el-input-number v-model="form.scanDefaultTimeoutMs" :min="300" :max="30000" />
        </el-form-item>
        <el-form-item label="默认重试次数">
          <el-input-number v-model="form.scanDefaultRetryCount" :min="0" :max="5" />
        </el-form-item>
        <el-form-item label="仪表盘自动刷新(s)">
          <el-input-number v-model="form.dashboardAutoRefreshSec" :min="5" :max="300" />
        </el-form-item>
        <el-form-item label="任务列表自动刷新(s)">
          <el-input-number v-model="form.taskListAutoRefreshSec" :min="5" :max="120" />
        </el-form-item>
        <el-form-item label="任务失败提醒">
          <el-switch v-model="form.enableTaskFailureAlert" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getSystemSettings, updateSystemSettings } from '@/api/system'

const saving = ref(false)
const form = reactive({
  scanDefaultConcurrency: 30,
  scanDefaultTimeoutMs: 1500,
  scanDefaultRetryCount: 1,
  dashboardAutoRefreshSec: 30,
  taskListAutoRefreshSec: 15,
  enableTaskFailureAlert: true
})

async function loadSettings() {
  const data = await getSystemSettings()
  Object.assign(form, data || {})
}

async function save() {
  saving.value = true
  try {
    const data = await updateSystemSettings(form)
    Object.assign(form, data || {})
    ElMessage.success('系统设置已保存')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.app-container {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.settings-form {
  max-width: 680px;
}
</style>

