<template>
  <div class="dashboard-container">
    <div class="dashboard-head">
      <div>
        <h2>IP仪表盘</h2>
        <p>欢迎回来，{{ userStore.name }}。这里展示 IP 资源、任务活跃度和系统关键动作。</p>
      </div>
      <el-button :loading="loading" type="primary" plain @click="loadDashboardData">刷新数据</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="12" :lg="6">
        <el-card class="metric-card blue" shadow="hover">
          <div class="metric-top">
            <span>IP 总数</span>
            <el-icon><Grid /></el-icon>
          </div>
          <div class="metric-value">{{ metrics.totalIp }}</div>
          <div class="metric-sub">网段池 {{ metrics.poolCount }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="12" :lg="6">
        <el-card class="metric-card orange" shadow="hover">
          <div class="metric-top">
            <span>已占用</span>
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="metric-value">{{ metrics.occupied }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="12" :lg="6">
        <el-card class="metric-card green" shadow="hover">
          <div class="metric-top">
            <span>在线设备</span>
            <el-icon><Connection /></el-icon>
          </div>
          <div class="metric-value">{{ metrics.online }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="12" :lg="6">
        <el-card class="metric-card red" shadow="hover">
          <div class="metric-top">
            <span>异常任务</span>
            <el-icon><Warning /></el-icon>
          </div>
          <div class="metric-value">{{ metrics.abnormalTasks }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="row-gap">
      <el-col :xs="24" :lg="12">
        <el-card class="panel-card" shadow="hover">
          <template #header>IP 占用率分布柱状图</template>
          <div ref="barChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card class="panel-card" shadow="hover">
          <template #header>扫描任务活跃趋势（24h）</template>
          <div ref="lineChartRef" class="chart-box"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="row-gap">
      <el-col :xs="24" :lg="8">
        <el-card class="panel-card" shadow="hover">
          <template #header>IP 资源池水位线</template>
          <div ref="ringChartRef" class="chart-box small"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="16">
        <el-card class="panel-card" shadow="hover">
          <template #header>快速操作入口</template>
          <div class="quick-actions">
            <div class="quick-tile" @click="newPoolVisible = true">
              <el-icon><Plus /></el-icon>
              <span>新建网段</span>
            </div>
            <div class="quick-tile" @click="scanNowVisible = true">
              <el-icon><VideoPlay /></el-icon>
              <span>立即扫描</span>
            </div>
            <div class="quick-tile" @click="handleExport('excel')">
              <el-icon><Document /></el-icon>
              <span>导出报告</span>
            </div>
            <div class="quick-tile" @click="handleSystemSettings">
              <el-icon><Setting /></el-icon>
              <span>系统设置</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row class="row-gap">
      <el-col :span="24">
        <el-card class="panel-card panel-card-auto" shadow="hover">
          <template #header>最近动态 / 任务状态（Top 5）</template>
          <div v-if="recentTasks.length === 0" class="empty-wrap">
            <el-empty description="暂无任务记录" />
          </div>
          <div v-else class="task-progress-list">
            <div v-for="task in recentTasks" :key="task.taskId" class="task-item">
              <div class="task-meta">
                <span>#{{ task.taskId }} / 池 {{ task.poolId }} / {{ task.status }}</span>
                <span>{{ formatTime(task.createdAt || task.startedAt) }}</span>
              </div>
              <div class="custom-progress">
                <div 
                  class="custom-progress-bar"
                  :style="{ 
                    width: (task.progress || 0) + '%',
                    backgroundColor: task.status === 'success' ? '#22c55e' : (task.status === 'failed' ? '#ef4444' : '#3b82f6')
                  }"
                >
                  <div class="progress-shine"></div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="newPoolVisible" title="新建网段" width="520px">
      <el-form :model="newPoolForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="newPoolForm.name" placeholder="例如：办公网 A 区" />
        </el-form-item>
        <el-form-item label="区域">
          <el-input v-model="newPoolForm.region" placeholder="例如：北京海淀" />
        </el-form-item>
        <el-form-item label="CIDR">
          <el-input v-model="newPoolForm.cidr" placeholder="例如：10.0.0.0/24" />
        </el-form-item>
        <el-form-item label="网络类型">
          <el-select v-model="newPoolForm.networkType" style="width: 100%">
            <el-option value="IPv4" label="IPv4" />
            <el-option value="IPv6" label="IPv6" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newPoolVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading" @click="handleCreatePool">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="scanNowVisible" title="立即扫描" width="520px">
      <el-form :model="scanForm" label-width="100px">
        <el-form-item label="选择网段池">
          <el-select v-model="scanForm.poolId" filterable style="width: 100%" placeholder="请选择网段池">
            <el-option v-for="p in poolOptions" :key="p.id" :label="`${p.name} (#${p.id})`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="并发数">
          <el-input-number v-model="scanForm.concurrency" :min="1" :max="128" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scanNowVisible = false">取消</el-button>
        <el-button type="primary" :loading="actionLoading" @click="handleStartScan">开始扫描</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { Grid, DataLine, Connection, Warning, Plus, VideoPlay, Document, Setting } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { getPoolList, createPool } from '@/api/pool'
import { listScanTasks, startScan } from '@/api/scan'
import { getOccupancyReport, exportOccupancyExcel, exportOccupancyPdf } from '@/api/occupancy'
import { getSystemSettings } from '@/api/system'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const actionLoading = ref(false)

const metrics = reactive({
  totalIp: 0,
  occupied: 0,
  online: 0,
  abnormalTasks: 0,
  poolCount: 0
})

const recentTasks = ref([])
const allTasks = ref([])
const poolOptions = ref([])

const newPoolVisible = ref(false)
const newPoolForm = reactive({
  name: '',
  region: '',
  cidr: '',
  networkType: 'IPv4'
})

const scanNowVisible = ref(false)
const scanForm = reactive({
  poolId: null,
  concurrency: 30
})

const barChartRef = ref(null)
const lineChartRef = ref(null)
const ringChartRef = ref(null)
let barChart = null
let lineChart = null
let ringChart = null
let refreshTimer = null

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

function build24hSeries(tasks) {
  const now = new Date()
  const labels = []
  const counts = []
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000)
    const key = `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`
    labels.push(key)
    counts.push(0)
  }
  tasks.forEach((task) => {
    const raw = task.createdAt || task.startedAt || task.triggeredAt
    if (!raw) return
    const t = new Date(raw).getTime()
    if (Number.isNaN(t)) return
    const diffHours = Math.floor((Date.now() - t) / (60 * 60 * 1000))
    if (diffHours < 0 || diffHours > 23) return
    const idx = 23 - diffHours
    counts[idx] += 1
  })
  return { labels, counts }
}

function setBarChart(usage) {
  if (!barChart) return
  barChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: ['未占用', '正常占用', '异常占用'] },
    yAxis: { type: 'value' },
    series: [{
      name: '数量',
      type: 'bar',
      barWidth: 40,
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: (params) => ['#94A3B8', '#22C55E', '#EF4444'][params.dataIndex]
      },
      data: [usage.freeCount || 0, usage.normalOccupiedCount || 0, usage.abnormalOccupiedCount || 0]
    }]
  })
}

function setLineChart(tasks) {
  if (!lineChart) return
  const { labels, counts } = build24hSeries(tasks)
  lineChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { showMaxLabel: true } },
    yAxis: { type: 'value' },
    series: [{
      name: '任务数',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 3, color: '#3B82F6' },
      areaStyle: { color: 'rgba(59,130,246,0.18)' },
      data: counts
    }]
  })
}

function setRingChart(usageRate) {
  if (!ringChart) return
  const rate = Math.max(0, Math.min(100, Number(usageRate || 0)))
  ringChart.setOption({
    title: {
      text: `${rate}%`,
      left: 'center',
      top: '42%',
      textStyle: { fontSize: 28, fontWeight: 700, color: '#1E293B' },
      subtext: '使用率',
      subtextStyle: { fontSize: 12, color: '#64748B' }
    },
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['62%', '82%'],
      avoidLabelOverlap: true,
      label: { show: false },
      data: [
        { value: rate, name: '已使用', itemStyle: { color: '#3B82F6' } },
        { value: 100 - rate, name: '剩余', itemStyle: { color: '#E2E8F0' } }
      ]
    }]
  })
}

function initCharts() {
  if (barChartRef.value && !barChart) barChart = echarts.init(barChartRef.value)
  if (lineChartRef.value && !lineChart) lineChart = echarts.init(lineChartRef.value)
  if (ringChartRef.value && !ringChart) ringChart = echarts.init(ringChartRef.value)
}

let rafId = null

function resizeCharts() {
  if (document.hidden) return
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      if (barChartRef.value && barChartRef.value.clientWidth > 0) {
        barChart?.resize()
        lineChart?.resize()
        ringChart?.resize()
      }
    })
  }

  function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  window.URL.revokeObjectURL(url)
}

async function loadDashboardData() {
  loading.value = true
  try {
    const settings = await getSystemSettings().catch(() => ({}))
    const ts = Date.now()
    const [report, taskData, poolData] = await Promise.all([
      getOccupancyReport({ _t: ts }),
      listScanTasks({ page: 1, pageSize: 200, _t: ts }),
      getPoolList({ page: 1, pageSize: 200, _t: ts })
    ])

    poolOptions.value = poolData.list || []
    allTasks.value = taskData.list || []
    recentTasks.value = allTasks.value.slice(0, 5)

    const usage = report?.usage || {}
    const occupied = Number(usage.normalOccupiedCount || 0) + Number(usage.abnormalOccupiedCount || 0)
    const abnormalTaskCount = allTasks.value.filter((t) => ['failed', 'cancelled'].includes(t.status)).length

    metrics.totalIp = Number(usage.totalIpCount || 0)
    metrics.occupied = occupied
    metrics.online = occupied
    metrics.abnormalTasks = abnormalTaskCount
    metrics.poolCount = Number(poolData.total || 0)

    setBarChart(usage)
    setLineChart(allTasks.value)
    setRingChart(usage.usageRate)

    const nextSec = Number(settings.dashboardAutoRefreshSec || 30)
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = setInterval(() => {
      loadDashboardData()
    }, Math.max(5, nextSec) * 1000)
  } finally {
    loading.value = false
  }
}

async function handleCreatePool() {
  if (!newPoolForm.name || !newPoolForm.cidr) {
    ElMessage.warning('请填写名称和 CIDR')
    return
  }
  actionLoading.value = true
  try {
    await createPool({
      name: newPoolForm.name,
      region: newPoolForm.region,
      cidr: newPoolForm.cidr,
      networkType: newPoolForm.networkType,
      enabled: true
    })
    ElMessage.success('网段创建成功')
    newPoolVisible.value = false
    newPoolForm.name = ''
    newPoolForm.region = ''
    newPoolForm.cidr = ''
    await loadDashboardData()
    router.push('/pools')
  } catch (error) {
    console.error('Create pool failed:', error)
    const msg = error.response?.data?.message || error.message || '创建失败'
    ElMessage.error(msg)
  } finally {
    actionLoading.value = false
  }
}

async function handleStartScan() {
  if (!scanForm.poolId) {
    ElMessage.warning('请先选择网段池')
    return
  }
  actionLoading.value = true
  try {
    const data = await startScan(scanForm.poolId, { concurrency: scanForm.concurrency })
    scanNowVisible.value = false
    ElMessage.success(`扫描已启动（任务 #${data.taskId}）`)
    router.push('/scan/tasks')
  } finally {
    actionLoading.value = false
  }
}

async function handleExport(type) {
  actionLoading.value = true
  try {
    if (type === 'excel') {
      const blob = await exportOccupancyExcel({})
      downloadBlob(blob, `occupancy-report-${Date.now()}.xlsx`)
      ElMessage.success('Excel 报告已导出')
      return
    }
    const blob = await exportOccupancyPdf({})
    downloadBlob(blob, `occupancy-report-${Date.now()}.pdf`)
    ElMessage.success('PDF 报告已导出')
  } finally {
    actionLoading.value = false
  }
}

function handleSystemSettings() {
  router.push('/system/settings')
}

onMounted(async () => {
  await nextTick()
  initCharts()
  await loadDashboardData()
  window.addEventListener('resize', resizeCharts)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  window.removeEventListener('resize', resizeCharts)
  barChart?.dispose()
  lineChart?.dispose()
  ringChart?.dispose()
  barChart = null
  lineChart = null
  ringChart = null
})
</script>

<style scoped>
.dashboard-container {
  padding: 18px;
  background: #f4f7fe;
  min-height: calc(100dvh - 60px);
  box-sizing: border-box;
  overflow-x: auto;
}
.dashboard-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.dashboard-head h2 {
  margin: 0;
  color: #1e293b;
}
.dashboard-head p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}
.row-gap {
  margin-top: 16px;
}
.metric-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
}
.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #475569;
  font-size: 13px;
}
.metric-value {
  font-size: 30px;
  line-height: 1;
  margin-top: 14px;
  font-weight: 700;
}
.metric-sub {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}
.blue .metric-value { color: #2563eb; }
.orange .metric-value { color: #f59e0b; }
.green .metric-value { color: #16a34a; }
.red .metric-value { color: #ef4444; }
.panel-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
  height: 360px;
}
.panel-card-auto {
  height: auto;
}
.panel-card :deep(.el-card__body) {
  height: calc(100% - 48px);
  display: flex;
  flex-direction: column;
}
.chart-box {
  flex: 1;
  min-height: 260px;
}
.chart-box.small {
  min-height: 240px;
  flex: 1;
}
.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 12px;
  flex: 1;
}
.quick-tile {
  height: 96px;
  border-radius: 10px;
  background: #f8fbff;
  border: 1px solid #e5edf9;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  color: #2563eb;
  transition: all 0.2s ease;
}
.quick-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.15);
}
.quick-tile .el-icon {
  font-size: 22px;
  margin-bottom: 8px;
}
.task-progress-list {
  display: grid;
  gap: 12px;
}
.task-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}
.task-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.custom-progress {
  height: 16px;
  background-color: #ebeef5;
  border-radius: 100px;
  overflow: hidden;
  position: relative;
}
.custom-progress-bar {
  height: 100%;
  border-radius: 100px;
  transition: width 0.3s ease, background-color 0.3s ease;
  position: relative;
  overflow: hidden;
}
.progress-shine {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 2s infinite;
}
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
.empty-wrap {
  padding: 8px 0;
}
</style>
