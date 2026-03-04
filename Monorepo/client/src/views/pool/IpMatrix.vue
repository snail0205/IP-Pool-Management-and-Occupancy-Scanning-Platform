<template>
  <div class="app-container">
    <div class="header-row">
      <el-page-header :title="`池: ${poolName}`" @back="goBack" />
    </div>

    <div class="toolbar">
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px; margin-right: 8px;" @change="fetchIps">
        <el-option label="全部" value="" />
        <el-option label="未知" :value="-1" />
        <el-option label="未占用" :value="0" />
        <el-option label="正常占用" :value="1" />
        <el-option label="冲突" :value="2" />
      </el-select>
      <el-input
        v-model="keyword"
        placeholder="IP / 设备名 / MAC"
        clearable
        style="width: 200px; margin-right: 8px;"
        @keyup.enter="fetchIps"
      />
      <el-button type="primary" @click="fetchIps">搜索</el-button>
      <el-button type="success" :loading="scanLoading" :disabled="!!runningTaskId" @click="handleStartScan">
        {{ runningTaskId ? '扫描中...' : '启动扫描' }}
      </el-button>
    </div>

    <div v-if="runningTaskId" class="progress-row">
      <el-progress :percentage="taskProgress" :status="taskProgress === 100 ? 'success' : undefined" />
      <span class="progress-text">
        已处理 {{ taskProcessedCount }} / {{ taskTotalCount }}，在线 {{ taskOnlineCount }}，冲突 {{ taskConflictCount }}
      </span>
      <el-button size="small" type="warning" @click="handleTerminateTask">终止</el-button>
    </div>

    <el-table
      v-loading="listLoading"
      :data="ipList"
      border
      fit
      style="width: 100%; margin-top: 16px;"
    >
      <el-table-column label="IP" prop="ip" align="center" width="140" />
      <el-table-column label="状态" align="center" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="在线" align="center" width="80">
        <template #default="{ row }">
          <el-icon v-if="row.isAlive" color="#67c23a"><CircleCheck /></el-icon>
          <el-icon v-else color="#909399"><CircleClose /></el-icon>
        </template>
      </el-table-column>
      <el-table-column label="MAC" prop="mac" align="center" min-width="140" show-overflow-tooltip />
      <el-table-column label="设备/备案" prop="deviceName" align="center" min-width="120" show-overflow-tooltip />
      <el-table-column label="部门" prop="department" align="center" width="100" show-overflow-tooltip />
      <el-table-column label="负责人" prop="owner" align="center" width="100" show-overflow-tooltip />
      <el-table-column label="最后扫描" align="center" width="160">
        <template #default="{ row }">
          {{ row.lastScanTime ? formatTime(row.lastScanTime) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="120" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleViewDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      style="margin-top: 16px; justify-content: flex-end;"
      @size-change="fetchIps"
      @current-change="fetchIps"
    />

    <el-dialog v-model="detailVisible" title="IP 占用详情" width="560px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="IP">{{ detail.ip }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(detail.statusCode)">{{ statusLabel(detail.statusCode) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="在线">{{ detail.connectionStatus || (detail.isAlive ? '是' : '否') }}</el-descriptions-item>
          <el-descriptions-item label="MAC">{{ detail.mac || '-' }}</el-descriptions-item>
          <el-descriptions-item label="TTL">{{ detail.ttl ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="开放端口">{{ formatPorts(detail.openPorts) }}</el-descriptions-item>
          <el-descriptions-item label="设备名">{{ detail.deviceName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="部门">{{ detail.department || '-' }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ detail.owner || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最后扫描">{{ detail.lastScanTime ? formatTime(detail.lastScanTime) : '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { getPoolDetail, getPoolIps } from '@/api/pool'
import { startScan, getScanTask, terminateScanTask } from '@/api/scan'
import { getOccupancyDetail } from '@/api/occupancy'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const poolId = computed(() => Number(route.params.id))

const poolName = ref('')
const ipList = ref([])
const listLoading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const statusFilter = ref('')
const keyword = ref('')

const scanLoading = ref(false)
const runningTaskId = ref(null)
const pollTimer = ref(null)
const taskProgress = ref(0)
const taskProcessedCount = ref(0)
const taskTotalCount = ref(0)
const taskOnlineCount = ref(0)
const taskConflictCount = ref(0)

const detailVisible = ref(false)
const detail = ref(null)

function statusLabel(status) {
  const map = { [-1]: '未知', 0: '未占用', 1: '正常占用', 2: '冲突' }
  return map[status] ?? '未知'
}

function statusTagType(status) {
  const map = { [-1]: 'info', 0: 'info', 1: 'success', 2: 'danger' }
  return map[status] ?? 'info'
}

function formatTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  return d.toLocaleString('zh-CN')
}

function formatPorts(ports) {
  if (!ports) return '-'
  const p = typeof ports === 'string' ? (() => { try { return JSON.parse(ports) } catch { return [] } })() : ports
  return Array.isArray(p) ? p.join(', ') || '-' : '-'
}

function goBack() {
  router.push('/pools')
}

async function loadPoolName() {
  try {
    const p = await getPoolDetail(poolId.value)
    poolName.value = p?.name || `池 #${poolId.value}`
  } catch {
    poolName.value = `池 #${poolId.value}`
  }
}

async function fetchIps() {
  listLoading.value = true
  try {
    const data = await getPoolIps(poolId.value, {
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value === '' ? undefined : statusFilter.value,
      keyword: keyword.value
    })
    ipList.value = data.list || []
    total.value = data.total ?? 0
  } catch (err) {
    console.error(err)
  } finally {
    listLoading.value = false
  }
}

async function handleStartScan() {
  scanLoading.value = true
  try {
    const data = await startScan(poolId.value, {})
    runningTaskId.value = data.taskId
    taskProgress.value = 0
    taskProcessedCount.value = 0
    taskTotalCount.value = 0
    taskOnlineCount.value = 0
    taskConflictCount.value = 0
    startPollProgress()
    ElMessage.success('扫描已启动')
  } catch (err) {
    console.error(err)
  } finally {
    scanLoading.value = false
  }
}

function startPollProgress() {
  if (pollTimer.value) clearInterval(pollTimer.value)
  pollTimer.value = setInterval(async () => {
    if (!runningTaskId.value) return
    try {
      const task = await getScanTask(runningTaskId.value)
      taskProgress.value = task.progress ?? 0
      taskProcessedCount.value = task.processedCount ?? 0
      taskTotalCount.value = task.totalCount ?? 0
      taskOnlineCount.value = task.onlineCount ?? 0
      taskConflictCount.value = task.conflictCount ?? 0
      if (task.status === 'success' || task.status === 'failed' || task.status === 'cancelled') {
        runningTaskId.value = null
        clearInterval(pollTimer.value)
        pollTimer.value = null
        fetchIps()
        ElMessage.success(task.status === 'success' ? '扫描完成' : `任务已结束: ${task.status}`)
      }
    } catch {
      // ignore
    }
  }, 1500)
}

async function handleTerminateTask() {
  if (!runningTaskId.value) return
  try {
    await ElMessageBox.confirm('确定终止当前扫描任务？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await terminateScanTask(runningTaskId.value)
    runningTaskId.value = null
    if (pollTimer.value) {
      clearInterval(pollTimer.value)
      pollTimer.value = null
    }
    fetchIps()
    ElMessage.info('已请求终止')
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

async function handleViewDetail(row) {
  try {
    detail.value = await getOccupancyDetail(poolId.value, row.ip)
    detailVisible.value = true
  } catch (err) {
    console.error(err)
    ElMessage.error('获取详情失败')
  }
}

onMounted(() => {
  loadPoolName()
  fetchIps()
})

onUnmounted(() => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
})
</script>

<style scoped>
.app-container {
  padding: 20px;
}
.header-row {
  margin-bottom: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.progress-row {
  margin-top: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.progress-row .el-progress {
  flex: 1;
  max-width: 400px;
}
.progress-text {
  font-size: 13px;
  color: #606266;
}
</style>