import request from '@/utils/request'

export function getSystemSettings() {
  return request({
    url: '/system/settings',
    method: 'get'
  })
}

export function updateSystemSettings(data) {
  return request({
    url: '/system/settings',
    method: 'put',
    data
  })
}

