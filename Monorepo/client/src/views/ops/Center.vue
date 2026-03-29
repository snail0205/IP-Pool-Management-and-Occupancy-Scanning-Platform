<template>
  <div class="ops-page">
    <el-card class="ops-card">
      <template #header>运维增强中心（告警 / 策略 / 台账 / 审计）</template>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="告警中心" name="alerts">
          <div class="toolbar">
            <el-select v-model="alertQuery.status" placeholder="状态" clearable style="width: 140px">
              <el-option label="open" value="open" />
              <el-option label="resolved" value="resolved" />
            </el-select>
            <el-button type="primary" @click="loadAlerts">查询</el-button>
          </div>
          <el-table :data="alertList" border size="small">
            <el-table-column prop="alertId" label="ID" width="80" />
            <el-table-column prop="alertType" label="类型" width="150" />
            <el-table-column prop="level" label="等级" width="100" />
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column prop="poolId" label="池ID" width="90" />
            <el-table-column prop="ip" label="IP" width="150" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="createdAt" label="创建时间" width="170" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'open'" type="success" link @click="onResolveAlert(row.alertId)">解决</el-button>
                <el-button v-else type="warning" link @click="onReopenAlert(row.alertId)">重开</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="自动化扫描策略" name="policies">
          <div class="toolbar">
            <el-select v-model="policyForm.poolId" placeholder="选择池" style="width: 220px">
              <el-option v-for="p in poolOptions" :key="p.poolId" :label="`${p.poolId} - ${p.name}`" :value="p.poolId" />
            </el-select>
            <el-input v-model="policyForm.cronExpr" placeholder="cron 表达式" style="width: 200px" />
            <el-input v-model="policyForm.silentStart" placeholder="静默开始 HH:mm" style="width: 150px" />
            <el-input v-model="policyForm.silentEnd" placeholder="静默结束 HH:mm" style="width: 150px" />
            <el-input-number v-model="policyForm.autoRetryTimes" :min="0" :max="5" />
            <el-button type="primary" @click="onSavePolicy">保存</el-button>
            <el-button @click="loadPolicies">刷新</el-button>
          </div>
          <el-table :data="policyList" border size="small">
            <el-table-column prop="policyId" label="策略ID" width="90" />
            <el-table-column prop="poolId" label="池ID" width="80" />
            <el-table-column prop="cronExpr" label="Cron" width="160" />
            <el-table-column prop="silentStart" label="静默开始" width="100" />
            <el-table-column prop="silentEnd" label="静默结束" width="100" />
            <el-table-column prop="autoRetryTimes" label="失败重试" width="90" />
            <el-table-column prop="lastStatus" label="最近状态" width="120" />
            <el-table-column prop="lastTriggeredAt" label="最近触发" width="170" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="onTriggerPolicy(row.poolId)">立即执行</el-button>
                <el-button type="danger" link @click="onDeletePolicy(row.poolId)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="资产台账" name="assets">
          <div class="toolbar">
            <el-input v-model="assetQuery.keyword" placeholder="IP / 设备 / 负责人 / 部门" style="width: 280px" clearable />
            <el-button type="primary" @click="loadAssets">查询</el-button>
          </div>
          <el-table :data="assetList" border size="small">
            <el-table-column prop="poolName" label="网段池" min-width="130" />
            <el-table-column prop="ip" label="IP" width="150" />
            <el-table-column prop="deviceName" label="设备" min-width="140" />
            <el-table-column prop="owner" label="负责人" width="100" />
            <el-table-column prop="department" label="部门" width="120" />
            <el-table-column prop="purpose" label="用途" min-width="140" />
            <el-table-column prop="statusReason" label="状态" width="140" />
            <el-table-column label="追溯" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="onTraceAsset(row)">一键追溯</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog v-model="traceVisible" title="IP 占用追溯" width="860px">
            <el-descriptions :column="2" border v-if="traceDetail">
              <el-descriptions-item label="池">{{ traceDetail.poolName }}</el-descriptions-item>
              <el-descriptions-item label="IP">{{ traceDetail.ip }}</el-descriptions-item>
              <el-descriptions-item label="当前状态">{{ traceDetail.statusReason }}</el-descriptions-item>
              <el-descriptions-item label="扫描时间">{{ traceDetail.lastScanTime }}</el-descriptions-item>
            </el-descriptions>
            <el-table :data="traceHistory" size="small" border class="mt10">
              <el-table-column prop="eventTime" label="时间" width="170" />
              <el-table-column prop="statusReason" label="状态" width="140" />
              <el-table-column prop="occupancyType" label="类型" width="120" />
              <el-table-column prop="oldMac" label="旧MAC" min-width="150" />
              <el-table-column prop="newMac" label="新MAC" min-width="150" />
            </el-table>
          </el-dialog>
        </el-tab-pane>

        <el-tab-pane label="变更审计" name="audit">
          <div class="toolbar">
            <el-input v-model="auditQuery.keyword" placeholder="路径 / diff 关键字" style="width: 280px" clearable />
            <el-button type="primary" @click="loadAuditLogs">查询</el-button>
          </div>
          <el-table :data="auditList" border size="small">
            <el-table-column prop="auditId" label="ID" width="80" />
            <el-table-column prop="username" label="用户" width="120" />
            <el-table-column prop="entity" label="实体" width="130" />
            <el-table-column prop="action" label="动作" width="100" />
            <el-table-column prop="path" label="路径" min-width="220" />
            <el-table-column prop="rollbackStatus" label="回滚状态" width="110" />
            <el-table-column prop="createdAt" label="时间" width="170" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button type="info" link @click="showDiff(row)">查看Diff</el-button>
                <el-button type="warning" link @click="onRollback(row)" :disabled="!row.rollbackPayload">回滚</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog v-model="diffVisible" title="变更 Diff" width="760px">
            <pre class="diff-box">{{ selectedDiff }}</pre>
          </el-dialog>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAlertList, resolveAlert, reopenAlert } from '@/api/alert'
import { getScanPolicyList, saveScanPolicy, deleteScanPolicy, triggerScanPolicyNow } from '@/api/scan-policy'
import { getAssetLedger, traceAsset } from '@/api/asset'
import { getAuditLogs, rollbackAuditLog } from '@/api/audit'
import { getPoolList } from '@/api/pool'

const activeTab = ref('alerts')
const poolOptions = ref([])

const alertQuery = reactive({ status: 'open' })
const alertList = ref([])

const policyForm = reactive({
  poolId: null,
  cronExpr: '0 * * * *',
  silentStart: '00:00',
  silentEnd: '06:00',
  autoRetryTimes: 1
})
const policyList = ref([])

const assetQuery = reactive({ keyword: '' })
const assetList = ref([])
const traceVisible = ref(false)
const traceDetail = ref(null)
const traceHistory = ref([])

const auditQuery = reactive({ keyword: '' })
const auditList = ref([])
const diffVisible = ref(false)
const selectedDiff = ref('')

async function loadPools() {
  const data = await getPoolList({ page: 1, pageSize: 500 })
  poolOptions.value = (data.list || [])
    .map((item) => ({
      poolId: Number(item.poolId ?? item.id),
      name: item.name || `Pool-${item.poolId ?? item.id ?? ''}`
    }))
    .filter((item) => Number.isInteger(item.poolId) && item.poolId > 0)
  if (!policyForm.poolId && poolOptions.value.length) {
    policyForm.poolId = poolOptions.value[0].poolId
  }
}

async function loadAlerts() {
  const data = await getAlertList({ ...alertQuery, page: 1, pageSize: 200 })
  alertList.value = data.list || []
}

async function onResolveAlert(alertId) {
  await resolveAlert(alertId)
  ElMessage.success('已解决')
  loadAlerts()
}

async function onReopenAlert(alertId) {
  await reopenAlert(alertId)
  ElMessage.success('已重开')
  loadAlerts()
}

async function loadPolicies() {
  policyList.value = await getScanPolicyList()
}

async function onSavePolicy() {
  if (!policyForm.poolId) {
    ElMessage.warning('请先选择池')
    return
  }
  await saveScanPolicy(policyForm.poolId, {
    enabled: true,
    cronExpr: policyForm.cronExpr,
    silentStart: policyForm.silentStart,
    silentEnd: policyForm.silentEnd,
    autoRetryTimes: policyForm.autoRetryTimes,
    channels: ['in_app', 'email', 'wecom']
  })
  ElMessage.success('策略已保存')
  loadPolicies()
}

async function onDeletePolicy(poolId) {
  await deleteScanPolicy(poolId)
  ElMessage.success('策略已删除')
  loadPolicies()
}

async function onTriggerPolicy(poolId) {
  await triggerScanPolicyNow(poolId)
  ElMessage.success('已触发')
  loadPolicies()
}

async function loadAssets() {
  const data = await getAssetLedger({ ...assetQuery, page: 1, pageSize: 200 })
  assetList.value = data.list || []
}

async function onTraceAsset(row) {
  const data = await traceAsset(row.poolId, row.ip, { page: 1, pageSize: 100 })
  traceDetail.value = data.detail
  traceHistory.value = data.history?.list || []
  traceVisible.value = true
}

async function loadAuditLogs() {
  const data = await getAuditLogs({ ...auditQuery, page: 1, pageSize: 200 })
  auditList.value = data.list || []
}

function showDiff(row) {
  selectedDiff.value = row.diffJson || '{}'
  diffVisible.value = true
}

async function onRollback(row) {
  await rollbackAuditLog(row.auditId)
  ElMessage.success('回滚执行完成')
  loadAuditLogs()
}

onMounted(async () => {
  await loadPools()
  await Promise.all([loadAlerts(), loadPolicies(), loadAssets(), loadAuditLogs()])
})
</script>

<style scoped>
.ops-page {
  padding: 16px;
  box-sizing: border-box;
  overflow-x: auto;
}
.ops-card {
  border-radius: 10px;
  min-width: 0;
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.mt10 {
  margin-top: 10px;
}
.diff-box {
  max-height: 460px;
  overflow: auto;
  background: #0f172a;
  color: #d1d5db;
  padding: 12px;
  border-radius: 8px;
}
</style>
