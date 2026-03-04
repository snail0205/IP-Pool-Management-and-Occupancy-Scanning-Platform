<template>
  <div class="app-container">
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { listScanTasks, getScanTask } from '@/api/scan'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const query = reactive({ poolId: '', status: '' })

const progressVisible = ref(false)
const currentTask = ref(null)

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

async function handleViewProgress(row) {
  try {
    currentTask.value = await getScanTask(row.taskId)
    progressVisible.value = true
  } catch (err) {
    ElMessage.error('获取进度失败')
  }
}

function handleViewLogs(row) {
  ElMessage.info('日志功能可接 listTaskLogs 或新页面')
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.app-container {
  padding: 20px;
}
.filter-container {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
</style>