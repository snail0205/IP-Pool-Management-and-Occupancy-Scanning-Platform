import request from '@/utils/request'

export function getAuditLogs(params) {
  return request.get('/audit/logs', { params })
}

export function rollbackAuditLog(auditId) {
  return request.post(`/audit/logs/${auditId}/rollback`)
}
