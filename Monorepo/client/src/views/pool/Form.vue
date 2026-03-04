<template>
  <div class="app-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑 IP 池' : '添加 IP 池' }}</span>
        </div>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：办公网 A 区" />
        </el-form-item>

        <el-form-item label="网络类型" prop="networkType">
          <el-select v-model="form.networkType" placeholder="请选择" style="width: 100%">
            <el-option label="IPv4" value="IPv4" />
            <el-option label="IPv6" value="IPv6" />
          </el-select>
        </el-form-item>

        <el-form-item label="CIDR" prop="cidr">
          <el-input v-model="form.cidr" placeholder="如：192.168.1.0/24" />
          <span class="help-block">可选；若填写 CIDR，系统会自动计算起止 IP</span>
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="起始 IP" prop="startIp">
              <el-input v-model="form.startIp" placeholder="如：192.168.1.1" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束 IP" prop="endIp">
              <el-input v-model="form.endIp" placeholder="如：192.168.1.254" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="子网掩码" prop="subnetMask">
          <el-input v-model="form.subnetMask" placeholder="如：255.255.255.0" />
        </el-form-item>

        <el-form-item label="网关" prop="gateway">
          <el-input v-model="form.gateway" placeholder="如：192.168.1.1" />
        </el-form-item>

        <el-form-item label="DNS" prop="dns">
          <el-input v-model="form.dns" placeholder="如：8.8.8.8, 8.8.4.4" />
        </el-form-item>

        <el-form-item label="启用" prop="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onSubmit">提交</el-button>
          <el-button @click="onCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createPool, updatePool, getPoolDetail } from '@/api/pool'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

const isEdit = computed(() => !!route.params.id)
const poolId = computed(() => Number(route.params.id))

const form = reactive({
  name: '',
  networkType: 'IPv4',
  cidr: '',
  startIp: '',
  endIp: '',
  subnetMask: '',
  gateway: '',
  dns: '',
  enabled: true
})

const rules = {
  name: [{ required: true, message: '请输入池名称', trigger: 'blur' }],
  networkType: [{ required: true, message: '请选择网络类型', trigger: 'change' }]
}

async function loadPool() {
  if (!isEdit.value) return
  try {
    const p = await getPoolDetail(poolId.value)
    if (p) {
      form.name = p.name ?? ''
      form.networkType = p.networkType ?? 'IPv4'
      form.cidr = p.cidr ?? ''
      form.startIp = p.startIp ?? ''
      form.endIp = p.endIp ?? ''
      form.subnetMask = p.subnetMask ?? ''
      form.gateway = p.gateway ?? ''
      form.dns = p.dns ?? ''
      form.enabled = p.enabled !== false
    }
  } catch (err) {
    console.error(err)
  }
}

const onSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      if (isEdit.value) {
        await updatePool(poolId.value, form)
        ElMessage.success('更新成功')
      } else {
        await createPool(form)
        ElMessage.success('创建成功')
      }
      router.push('/pools')
    } catch (err) {
      console.error(err)
    } finally {
      loading.value = false
    }
  })
}

const onCancel = () => {
  router.push('/pools')
}

onMounted(() => {
  loadPool()
})
</script>

<style scoped>
.app-container {
  padding: 20px;
}
.card-header {
  font-weight: bold;
}
.help-block {
  font-size: 12px;
  color: #909399;
  margin-left: 10px;
}
</style>