import { defineStore } from 'pinia'
import { login, logout, getInfo } from '@/api/user'
import { ElMessage } from 'element-plus'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: sessionStorage.getItem('token') || '',
    name: '',
    role: ''
  }),
  actions: {
    async login(userInfo) {
      try {
        const res = await login(userInfo)
        const token = res.token
        this.token = token
        sessionStorage.setItem('token', token)
        ElMessage.success('Login success')
        return true
      } catch (error) {
        console.error(error)
        return false
      }
    },
    async getInfo() {
      try {
        const res = await getInfo()
        this.name = res.username
        this.role = res.role
        return res
      } catch (error) {
        this.resetToken()
        throw error
      }
    },
    async logout() {
      try {
        await logout()
      } finally {
        this.resetToken()
      }
    },
    resetToken() {
      this.token = ''
      this.name = ''
      this.role = ''
      sessionStorage.removeItem('token')
    }
  }
})
