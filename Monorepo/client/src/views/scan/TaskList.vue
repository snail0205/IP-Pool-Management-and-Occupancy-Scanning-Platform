<template>
  <div class="app-container">
    <el-alert
      v-if="recentFailed.length"
      type="error"
      :closable="false"
      show-icon
      class="failed-alert"
    >
      <template #title>
        近期开启失败任务：{{ recentFailed.map(x => `#${x.taskId}`).join(', ') }}
      </template>
    </el-alert>

    <div class="filter-container">
      <el-input v-model="query.poolId" placeholder="池 ID" clearable style="width: 100px; margin-right: 8px;" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 120px; margin-right: 8px;">
        <el-option label="全部" value="" />
        <el-option label="待执行" value="pending" />
        <el-option label="执行中" value="running" />
        <el-option label="成功" value="success" />
        <el-option label="失败" value="failed" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-button type="primary" @click="fetchData">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border style="width: 100%; margin-top: 16px;">
      <el-table-column label="任务 ID" prop="taskId" align="center" width="90" />
      <el-table-column label="池 ID" prop="poolId" align="center" width="80" />
      <el-table-column label="状态" align="center" width="100">
        <template #default="{ row }">
          <el-tag :type="taskStatusType(row.status)">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" align="center" width="100">
        <template #default="{ row }">{{ row.progress ?? 0 }}%</template>
      </el-table-column>
      <el-table-column label="已处理/总数" align="center" width="120">
        <template #default="{ row }">{{ row.processedCount ?? 0 }} / {{ row.totalCount ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="在线/冲突" align="center" width="100">
        <template #default="{ row }">{{ row.onlineCount ?? 0 }} / {{ row.conflictCount ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="开始时间" align="center" width="160">
        <template #default="{ row }">{{ formatTime(row.startedAt) }}</template>
      </el-table-column>
      <el-table-column label="结束时间" align="center" width="160">
        <template #default="{ row }">{{ formatTime(row.endedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleViewProgress(row)">进度</el-button>
          <el-button size="small" link @click="handleViewLogs(row)">日志</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      style="margin-top: 16px; justify-content: flex-end;"
      @size-change="fetchData"
      @current-change="fetchData"
    />

    <el-dialog v-model="progressVisible" title="任务进度" width="400px">
      <template v-if="currentTask">
        <p>状态: {{ currentTask.status }}</p>
        <el-progress :percentage="currentTask.progress ?? 0" />
        <p>已处理 {{ currentTask.processedCount ?? 0 }} / {{ currentTask.totalCount ?? 0 }}</p>
        <p>在线 {{ currentTask.onlineCount ?? 0 }}，冲突 {{ currentTask.conflictCount ?? 0 }}</p>
      </template>
    </el-dialog>

    <el-dialog v-model="logsVisible" :title="`任务 #${currentLogTaskId} 日志`" width="980px">
      <div class="log-toolbar">
        <el-select v-model="logQuery.level" clearable placeholder="级别" style="width: 120px;">
          <el-option label="INFO" value="info" />
          <el-option label="WARN" value="warn" />
          <el-option label="ERROR" value="error" />
        </el-select>
        <el-input v-model="logQuery.eventType" clearable placeholder="事件类型" style="width: 160px;" />
        <el-input v-model="logQuery.keyword" clearable placeholder="关键字(message/payload)" style="width: 260px;" />
        <el-button type="primary" @click="fetchLogs">筛选</el-button>
        <el-button @click="handleExportLogs">导出 CSV</el-button>
      </div>

      <el-table v-loading="logsLoading" :data="logList" border style="width: 100%; margin-top: 12px;" max-height="420">
        <el-table-column label="ID" prop="id" width="80" />
        <el-table-column label="级别" prop="level" width="100" />
        <el-table-column label="事件" prop="eventType" width="170" show-overflow-tooltip />
        <el-table-column label="消息" prop="message" min-width="220" show-overflow-tooltip />
        <el-table-column label="Payload" min-width="260">
          <template #default="{ row }">
            <span class="mono">{{ formatPayload(row.payloadJson) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="logPage"
        v-model:page-size="logPageSize"
        :total="logTotal"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 12px; justify-content: flex-end;"
        @size-change="fetchLogs"
        @current-change="fetchLogs"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { listScanTasks, getScanTask, listTaskLogs, exportTaskLogs, listRecentFailedTasks } from '@/api/scan'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const query = reactive({ poolId: '', status: '' })

const progressVisible = ref(false)
const currentTask = ref(null)
const recentFailed = ref([])

const logsVisible = ref(false)
const currentLogTaskId = ref(null)
const logsLoading = ref(false)
const logList = ref([])
const logTotal = ref(0)
const logPage = ref(1)
const logPageSize = ref(20)
const logQuery = reactive({
  level: '',
  eventType: '',
  keyword: ''
})

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

function taskStatusType(s) {
  const map = { pending: 'info', running: 'primary', success: 'success', failed: 'danger', cancelled: 'info', paused: 'warning' }
  return map[s] ?? 'info'
}

async function fetchData() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (query.poolId) params.poolId = query.poolId
    if (query.status) params.status = query.status
    const data = await listScanTasks(params)
    list.value = data.list || []
    total.value = data.total ?? 0
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function fetchRecentFailed() {
  try {
    recentFailed.value = await listRecentFailedTasks({ limit: 5 })
  } catch (err) {
    console.error(err)
  }
}

async function handleViewProgress(row) {
  try {
    currentTask.value = await getScanTask(row.taskId)
    progressVisible.value = true
  } catch (err) {
    ElMessage.error('获取进度失败')
  }
}

function handleViewLogs(row) {
  currentLogTaskId.value = row.taskId
  logPage.value = 1
  logsVisible.value = true
  fetchLogs()
}

function formatPayload(payload) {
  if (!payload) return '-'
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload)
  } catch {
    return '-'
  }
}

async function fetchLogs() {
  if (!currentLogTaskId.value) return
  logsLoading.value = true
  try {
    const data = await listTaskLogs(currentLogTaskId.value, {
      page: logPage.value,
      pageSize: logPageSize.value,
      level: logQuery.level || undefined,
      eventType: logQuery.eventType || undefined,
      keyword: logQuery.keyword || undefined
    })
    logList.value = data.list || []
    logTotal.value = data.total || 0
  } catch (err) {
    console.error(err)
    ElMessage.error('获取日志失败')
  } finally {
    logsLoading.value = false
  }
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  window.URL.revokeObjectURL(url)
}

async function handleExportLogs() {
  if (!currentLogTaskId.value) return
  try {
    const blob = await exportTaskLogs(currentLogTaskId.value)
    downloadBlob(blob, `task-${currentLogTaskId.value}-logs.csv`)
    ElMessage.success('日志已导出')
  } catch (err) {
    console.error(err)
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  fetchData()
  fetchRecentFailed()
})
</script>

<style scoped>
.app-container {
  padding: 20px;
}
.failed-alert {
  margin-bottom: 12px;
}
.filter-container {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.log-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.mono {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}
</style>