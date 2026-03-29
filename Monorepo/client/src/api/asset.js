import request from '@/utils/request'

export function getAssetLedger(params) {
  return request.get('/assets/ledger', { params })
}

export function traceAsset(poolId, ip, params) {
  return request.get(`/assets/trace/${poolId}/${encodeURIComponent(ip)}`, { params })
}
