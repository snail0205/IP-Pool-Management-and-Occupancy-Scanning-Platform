<template>
  <div class="report-page">
    <el-card>
      <template #header>报表中心（周报 / 月报）</template>
      <div class="toolbar">
        <el-select v-model="period" style="width: 140px">
          <el-option label="weekly" value="weekly" />
          <el-option label="monthly" value="monthly" />
        </el-select>
        <el-input-number v-model="offlineHours" :min="24" :max="720" />
        <el-button type="primary" :loading="loading" @click="loadSummary">生成报表</el-button>
        <el-button @click="onExportExcel">导出 Excel</el-button>
        <el-button @click="onExportPdf">导出 PDF</el-button>
        <el-button type="success" @click="onSendReport">自动发送</el-button>
      </div>

      <el-row :gutter="12">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-label">时间范围</div>
            <div class="stat-value">{{ summary.startDate }} ~ {{ summary.endDate }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-label">总任务数</div>
            <div class="stat-value">{{ summary.metrics?.totalTasks || 0 }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-label">成功率</div>
            <div class="stat-value">{{ summary.metrics?.successRate || 0 }}%</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-label">长期离线资产</div>
            <div class="stat-value">{{ summary.metrics?.longOfflineCount || 0 }}</div>
          </el-card>
        </el-col>
      </el-row>

      <el-divider content-position="left">利用率趋势（任务执行）</el-divider>
      <div ref="trendChartRef" class="trend-chart"></div>
      <el-table :data="summary.usageTrend || []" border size="small">
        <el-table-column prop="statDate" label="日期" width="140">
          <template #default="{ row }">{{ formatDate(row.statDate) }}</template>
        </el-table-column>
        <el-table-column prop="taskCount" label="任务数" width="120" />
        <el-table-column prop="successTaskCount" label="成功任务" width="120" />
        <el-table-column prop="failedTaskCount" label="失败任务" width="120" />
      </el-table>

      <el-divider content-position="left">冲突 Top10</el-divider>
      <el-table :data="summary.conflictTop10 || []" border size="small">
        <el-table-column prop="poolName" label="网段池" min-width="140" />
        <el-table-column prop="ip" label="IP" width="160" />
        <el-table-column prop="statusReason" label="状态" width="160" />
        <el-table-column prop="lastScanTime" label="最近扫描" width="170">
          <template #default="{ row }">{{ formatDateTime(row.lastScanTime) }}</template>
        </el-table-column>
      </el-table>

      <el-divider content-position="left">长期离线资产</el-divider>
      <el-table :data="summary.longOfflineAssets || []" border size="small">
        <el-table-column prop="poolName" label="网段池" min-width="140" />
        <el-table-column prop="ip" label="IP" width="160" />
        <el-table-column prop="deviceName" label="设备名" min-width="140" />
        <el-table-column prop="owner" label="负责人" width="120" />
        <el-table-column prop="offlineHours" label="离线小时" width="120" />
      </el-table>

      <el-divider content-position="left">发送记录</el-divider>
      <el-table :data="deliveries" border size="small">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="reportPeriod" label="周期" width="120" />
        <el-table-column prop="reportType" label="报表类型" width="120" />
        <el-table-column prop="channels" label="发送渠道" min-width="160" />
        <el-table-column prop="receivers" label="接收人" min-width="160" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="createdAt" label="时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { getReportSummary, getReportDeliveries, sendReport, exportReportExcel, exportReportPdf } from '@/api/report-center'

const loading = ref(false)
const period = ref('weekly')
const offlineHours = ref(72)
const trendChartRef = ref(null)
let trendChart = null
let rafId = null
const summary = reactive({
  startDate: '',
  endDate: '',
  usageTrend: [],
  conflictTop10: [],
  longOfflineAssets: [],
  metrics: {}
})
const deliveries = ref([])

function formatDate(input) {
  if (!input) return '-'
  return String(input).slice(0, 10)
}

function formatDateTime(input) {
  if (!input) return '-'
  const dt = new Date(input)
  if (Number.isNaN(dt.getTime())) return String(input)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

function renderTrendChart() {
  if (!trendChart) return
  const labels = (summary.usageTrend || []).map((x) => formatDate(x.statDate).slice(5))
  const task = (summary.usageTrend || []).map((x) => Number(x.taskCount || 0))
  const success = (summary.usageTrend || []).map((x) => Number(x.successTaskCount || 0))
  const failed = (summary.usageTrend || []).map((x) => Number(x.failedTaskCount || 0))
  const total = task.reduce((sum, x) => sum + x, 0) + success.reduce((sum, x) => sum + x, 0) + failed.reduce((sum, x) => sum + x, 0)
  const rotate = labels.length > 10 ? 35 : 0
  if (!labels.length || total === 0) {
    trendChart.clear()
    trendChart.setOption({
      title: {
        text: '暂无可展示的趋势数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#94a3b8',
          fontSize: 14,
          fontWeight: 500
        }
      }
    })
    return
  }
  trendChart.setOption({
    animationDuration: 400,
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      data: ['任务数', '成功', '失败']
    },
    grid: { left: 50, right: 24, top: 46, bottom: 46 },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: labels,
      axisLabel: {
        rotate,
        color: '#64748b'
      },
      axisLine: {
        lineStyle: {
          color: '#cbd5e1'
        }
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: {
        color: '#64748b'
      },
      splitLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      }
    },
    series: [
      {
        name: '任务数',
        type: 'bar',
        data: task,
        barMaxWidth: 28,
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: '成功',
        type: 'line',
        data: success,
        smooth: true,
        symbolSize: 8,
        itemStyle: {
          color: '#22c55e'
        },
        lineStyle: {
          width: 3
        }
      },
      {
        name: '失败',
        type: 'line',
        data: failed,
        smooth: true,
        symbolSize: 8,
        itemStyle: {
          color: '#ef4444'
        },
        lineStyle: {
          width: 2
        }
      }
    ]
  }, true)
}

function handleResize() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => trendChart?.resize())
}

async function loadSummary() {
  loading.value = true
  try {
    const data = await getReportSummary({ period: period.value, offlineHours: offlineHours.value })
    summary.startDate = data.startDate
    summary.endDate = data.endDate
    summary.usageTrend = data.usageTrend || []
    summary.conflictTop10 = data.conflictTop10 || []
    summary.longOfflineAssets = data.longOfflineAssets || []
    summary.metrics = data.metrics || {}
    await nextTick()
    renderTrendChart()
  } finally {
    loading.value = false
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

async function onExportExcel() {
  const blob = await exportReportExcel({ period: period.value, offlineHours: offlineHours.value })
  downloadBlob(blob, `report-${period.value}.xlsx`)
}

async function onExportPdf() {
  const blob = await exportReportPdf({ period: period.value, offlineHours: offlineHours.value })
  downloadBlob(blob, `report-${period.value}.pdf`)
}

async function onSendReport() {
  await sendReport({
    period: period.value,
    reportType: period.value,
    channels: ['in_app', 'email', 'wecom'],
    receivers: 'ops@example.com,wecom-group'
  })
  ElMessage.success('已发送')
  loadDeliveries()
}

async function loadDeliveries() {
  const data = await getReportDeliveries({ page: 1, pageSize: 50 })
  deliveries.value = data.list || []
}

onMounted(async () => {
  await nextTick()
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value)
    window.addEventListener('resize', handleResize)
  }
  await Promise.all([loadSummary(), loadDeliveries()])
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (rafId) cancelAnimationFrame(rafId)
  trendChart?.dispose()
  trendChart = null
})
</script>

<style scoped>
.report-page {
  padding: 16px;
}
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.trend-chart {
  height: 260px;
  width: 100%;
  margin-bottom: 10px;
}
.stat-card {
  margin-bottom: 10px;
}
.stat-label {
  color: #64748b;
  font-size: 12px;
}
.stat-value {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 700;
}
</style>
