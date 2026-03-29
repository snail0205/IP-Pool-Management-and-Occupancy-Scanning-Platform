import request from '@/utils/request'

export function getScanPolicyList() {
  return request.get('/scan/policies')
}

export function saveScanPolicy(poolId, data) {
  return request.put(`/scan/policies/${poolId}`, data)
}

export function deleteScanPolicy(poolId) {
  return request.delete(`/scan/policies/${poolId}`)
}

export function triggerScanPolicyNow(poolId) {
  return request.post(`/scan/policies/${poolId}/trigger`)
}
