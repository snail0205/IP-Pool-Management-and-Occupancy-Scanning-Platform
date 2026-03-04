import request from '@/utils/request'

/** 启动扫描（创建任务并立即触发） */
export function startScan(poolId, data = {}) {
  return request({
    url: `/scan/${poolId}/start`,
    method: 'post',
    data
  })
}

/** 查询任务进度 */
export function getScanTask(taskId) {
  return request({
    url: `/scan/tasks/${taskId}`,
    method: 'get'
  })
}

/** 任务列表 */
export function listScanTasks(params) {
  return request({
    url: '/scan/tasks',
    method: 'get',
    params
  })
}

/** 暂停任务 */
export function pauseScanTask(taskId) {
  return request({
    url: `/scan/tasks/${taskId}/pause`,
    method: 'post'
  })
}

/** 终止任务 */
export function terminateScanTask(taskId) {
  return request({
    url: `/scan/tasks/${taskId}/terminate`,
    method: 'post'
  })
}

/** 任务日志 */
export function listTaskLogs(taskId, params) {
  return request({
    url: `/scan/tasks/${taskId}/logs`,
    method: 'get',
    params
  })
}

/** 导出任务日志 CSV（返回 blob） */
export function exportTaskLogs(taskId) {
  return request({
    url: `/scan/tasks/${taskId}/logs/export`,
    method: 'get',
    responseType: 'blob'
  })
}
