import request from '@/utils/request'

//获取 IP 池列表
export function getPoolList(params) {
  return request({
    url: '/pools',
    method: 'get',
    params
  })
}

//获取池详情（编辑时用）
export function getPoolDetail(id) {
  return request({
    url: `/pools/${id}`,
    method: 'get'
  })
}

//创建 IP 池 
export function createPool(data) {
  return request({
    url: '/pools',
    method: 'post',
    data
  })
}

//更新 IP 池 
export function updatePool(id, data) {
  return request({
    url: `/pools/${id}`,
    method: 'put',
    data
  })
}

// 删除 IP 池 
export function deletePool(id) {
  return request({
    url: `/pools/${id}`,
    method: 'delete'
  })
}

// 启用/禁用池（后端为 PATCH /pools/:id/status）
export function setPoolStatus(id, enabled) {
  return request({
    url: `/pools/${id}/status`,
    method: 'patch',
    data: { enabled }
  })
}

//获取池统计
export function getPoolStats(poolId) {
  return request({
    url: `/pools/${poolId}/stats`,
    method: 'get'
  })
}

// 获取池内 IP 列表（状态、关键字、分页
export function getPoolIps(poolId, params) {
  return request({
    url: `/pools/${poolId}/ips`,
    method: 'get',
    params
  })
}

//新增静态绑定（备案）
export function createBinding(poolId, data) {
  return request({
    url: `/pools/${poolId}/bindings`,
    method: 'post',
    data
  })
}

//获取池内绑定列表 
export function listBindings(poolId, params) {
  return request({
    url: `/pools/${poolId}/bindings`,
    method: 'get',
    params
  })
}

//更新绑定 
export function updateBinding(poolId, bindingId, data) {
  return request({
    url: `/pools/${poolId}/bindings/${bindingId}`,
    method: 'put',
    data
  })
}

//解绑 
export function unbindBinding(poolId, bindingId) {
  return request({
    url: `/pools/${poolId}/bindings/${bindingId}/unbind`,
    method: 'post'
  })
}