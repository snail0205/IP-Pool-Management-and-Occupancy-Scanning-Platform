<template>
  <div class="app-container">
    <div class="filter-container">
      <el-input
        v-model="keyword"
        placeholder="搜索名称 / CIDR"
        clearable
        style="width: 220px; margin-right: 12px;"
        @keyup.enter="fetchData"
      />
      <el-button type="primary" @click="fetchData">搜索</el-button>
      <el-button type="primary" @click="handleCreate" style="margin-left: 12px;">添加 IP 池</el-button>
    </div>

    <el-table
      v-loading="listLoading"
      :data="list"
      border
      fit
      highlight-current-row
      style="width: 100%; margin-top: 20px;"
    >
      <el-table-column label="ID" prop="id" align="center" width="80" />
      <el-table-column label="名称" prop="name" align="center" min-width="120" />
      <el-table-column label="区域" prop="region" align="center" width="100" />
      <el-table-column label="CIDR" prop="cidr" align="center" width="140" />
      <el-table-column label="起始 IP" prop="startIp" align="center" width="120" />
      <el-table-column label="结束 IP" prop="endIp" align="center" width="120" />
      <el-table-column label="状态" align="center" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">
            {{ row.enabled ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleViewIps(row)">查看 IP</el-button>
          <el-button size="small" link @click="handleEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" link @click="handleDelete(row)">删除</el-button>
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
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getPoolList, deletePool } from '@/api/pool'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const route = useRoute()
const list = ref([])
const listLoading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')

const fetchData = async () => {
  listLoading.value = true
  try {
    const data = await getPoolList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value
    })
    list.value = data.list || []
    total.value = data.total ?? 0
  } catch (err) {
    console.error(err)
  } finally {
    listLoading.value = false
  }
}

const handleCreate = () => {
  router.push('/pools/create')
}

const handleEdit = (row) => {
  router.push(`/pools/${row.id}/edit`)
}

const handleViewIps = (row) => {
  router.push(`/pools/${row.id}/ips`)
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除该 IP 池吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deletePool(row.id)
      ElMessage.success('删除成功')
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }).catch(() => {})
}

onMounted(() => {
  if (route.query.keyword) {
    keyword.value = String(route.query.keyword)
  }
  fetchData()
})

watch(
  () => route.query.keyword,
  (val) => {
    keyword.value = val ? String(val) : ''
    page.value = 1
    fetchData()
  }
)
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