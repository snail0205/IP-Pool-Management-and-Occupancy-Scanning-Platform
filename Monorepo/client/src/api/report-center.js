import request from '@/utils/request'

export function getReportSummary(params) {
  return request.get('/reports/summary', { params })
}

export function getReportDeliveries(params) {
  return request.get('/reports/deliveries', { params })
}

export function exportReportExcel(params) {
  return request.get('/reports/export/excel', { params, responseType: 'blob' })
}

export function exportReportPdf(params) {
  return request.get('/reports/export/pdf', { params, responseType: 'blob' })
}

export function sendReport(payload) {
  return request.post('/reports/send', payload)
}
