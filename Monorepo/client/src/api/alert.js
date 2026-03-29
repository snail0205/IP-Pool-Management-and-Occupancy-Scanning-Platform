import request from '@/utils/request'

export function getAlertList(params) {
  return request.get('/alerts', { params })
}

export function resolveAlert(alertId) {
  return request.post(`/alerts/${alertId}/resolve`)
}

export function reopenAlert(alertId) {
  return request.post(`/alerts/${alertId}/reopen`)
}
