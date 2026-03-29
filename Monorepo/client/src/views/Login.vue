<template>
  <div class="login-wrapper">
    <div class="left-panel">
      <div class="orbit-container">
        <OrbitingCircles
          v-for="(icon, index) in innerIcons"
          :key="'inner-' + index"
          :radius="80"
          :duration="20"
          :delay="(20 / innerIcons.length) * index"
          :icon-size="40"
          :path="index === 0" 
        >
          <DemoIcons :name="icon" class="icon-svg" />
        </OrbitingCircles>

        <OrbitingCircles
          v-for="(icon, index) in outerIcons"
          :key="'outer-' + index"
          :radius="160"
          :duration="30"
          :delay="(30 / outerIcons.length) * index"
          :reverse="true"
          :icon-size="50"
          :path="index === 0"
        >
          <DemoIcons :name="icon" class="icon-svg" />
        </OrbitingCircles>

        <div class="center-circle"></div>
      </div>
    </div>
    
    <div class="right-panel">
      <el-card class="login-card">
        <template #header>
          <div class="card-header">
            <span>Login</span>
          </div>
        </template>
        <el-form :model="form" label-width="80px">
          <el-form-item label="Username">
            <el-input v-model="form.username" />
          </el-form-item>
          <el-form-item label="Password">
            <el-input v-model="form.password" type="password" show-password />
          </el-form-item>
          <el-form-item label="Role">
            <el-select v-model="form.role" placeholder="Select role" style="width: 100%">
              <el-option v-for="role in roleOptions" :key="role.value" :label="role.label" :value="role.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="Captcha">
            <div class="captcha-row">
              <el-input v-model="form.captcha" maxlength="4" />
              <div class="captcha-box" @click="refreshCaptcha">
                <canvas ref="captchaCanvas" width="100" height="40"></canvas>
              </div>
              <el-button text @click="refreshCaptcha">换一张</el-button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSubmit" :loading="loading">Login</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import OrbitingCircles from '@/components/OrbitingCircles.vue'
import DemoIcons from '@/components/icons/DemoIcons.vue'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const router = useRouter()
const loading = ref(false)
const captchaCanvas = ref(null)
const captchaText = ref('')

const innerIcons = ['whatsapp', 'notion', 'openai', 'googleDrive', 'whatsapp']
const outerIcons = ['googleDrive', 'whatsapp', 'notion', 'openai', 'googleDrive']
const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '运维', value: 'operator' },
  { label: '只读', value: 'viewer' }
]

const form = reactive({
  username: '',
  password: '',
  role: 'admin',
  captcha: ''
})

const generateCaptcha = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let text = ''
  for (let i = 0; i < 4; i += 1) {
    text += chars[Math.floor(Math.random() * chars.length)]
  }
  return text
}

const drawCaptcha = () => {
  const canvas = captchaCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#f5f7fa'
  ctx.fillRect(0, 0, w, h)
  ctx.font = 'bold 24px Arial'
  ctx.textBaseline = 'middle'
  const text = captchaText.value
  for (let i = 0; i < text.length; i += 1) {
    const x = 10 + i * 20 + Math.random() * 4
    const y = h / 2 + (Math.random() * 4 - 2)
    ctx.fillStyle = `rgb(${80 + Math.random() * 120}, ${80 + Math.random() * 120}, ${80 + Math.random() * 120})`
    ctx.fillText(text[i], x, y)
  }
}

const refreshCaptcha = () => {
  captchaText.value = generateCaptcha()
  drawCaptcha()
}

const onSubmit = async () => {
  const input = String(form.captcha || '').trim().toUpperCase()
  if (!input || input !== String(captchaText.value).toUpperCase()) {
    ElMessage.error('验证码不正确')
    refreshCaptcha()
    return
  }
  loading.value = true
  try {
    const success = await userStore.login(form)
    if (success) {
      router.push('/')
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<style scoped>
.login-wrapper {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #ffffff;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(to bottom right, #ffffff, #f0f2f5);
  overflow: hidden;
  border-right: 1px solid #e0e0e0;
}

.right-panel {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #0fdf8f;
}

.orbit-container {
  position: relative;
  width: 500px;
  height: 500px;
}

.center-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100px;
  height: 100px;
  background: radial-gradient(circle, rgba(64,158,255,0.1) 0%, rgba(64,158,255,0) 70%);
  transform: translate(-50%, -50%);
  border-radius: 50%;
}

.login-card {
  width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  text-align: center;
  font-size: 20px;
  font-weight: bold;
}

.icon-svg {
  width: 100%;
  height: 100%;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.captcha-box {
  width: 100px;
  height: 40px;
  flex: 0 0 auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.captcha-box canvas {
  display: block;
}

.captcha-row :deep(.el-input) {
  flex: 1;
}

.captcha-row :deep(.el-input__wrapper) {
  width: 100%;
}
</style>
