import request from '@/utils/request'

/** 多条件查询占用列表 */
export function searchOccupancy(params) {
  return request({
    url: '/occupancy',
    method: 'get',
    params
  })
}

/** 单 IP 占用详情 */
export function getOccupancyDetail(poolId, ip) {
  return request({
    url: `/occupancy/detail/${poolId}/${encodeURIComponent(ip)}`,
    method: 'get'
  })
}

/** 占用历史 */
export function getOccupancyHistory(params) {
  return request({
    url: '/occupancy/history',
    method: 'get',
    params
  })
}

/** 统计报表 */
export function getOccupancyReport(params) {
  return request({
    url: '/occupancy/report',
    method: 'get',
    params
  })
}

/** 导出 Excel */
export function exportOccupancyExcel(params) {
  return request({
    url: '/occupancy/report/export/excel',
    method: 'get',
    params,
    responseType: 'blob'
  })
}

/** 导出 PDF */
export function exportOccupancyPdf(params) {
  return request({
    url: '/occupancy/report/export/pdf',
    method: 'get',
    params,
    responseType: 'blob'
  })
}
