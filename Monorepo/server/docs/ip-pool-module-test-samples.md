# IP池基础信息管理模块 - 接口测试样例

## 1) 新增IP池

`POST /api/pools`

```json
{
  "name": "办公区-IPv4-01",
  "region": "办公区",
  "networkType": "IPv4",
  "startIp": "10.10.10.1",
  "endIp": "10.10.10.30",
  "subnetMask": "255.255.255.0",
  "gateway": "10.10.10.254",
  "dns": "114.114.114.114,8.8.8.8",
  "leaseHours": 24,
  "enabled": true
}
```

## 2) 查询池列表

`GET /api/pools?page=1&pageSize=10&keyword=办公区`

## 3) 查询池详情

`GET /api/pools/{poolId}`

## 4) 更新池信息

`PUT /api/pools/{poolId}`

```json
{
  "name": "办公区-IPv4-01-调整",
  "region": "办公区",
  "networkType": "IPv4",
  "startIp": "10.10.10.1",
  "endIp": "10.10.10.40",
  "subnetMask": "24",
  "gateway": "10.10.10.254",
  "dns": "114.114.114.114",
  "leaseHours": 12,
  "enabled": true
}
```

## 5) 启用/禁用池

`PATCH /api/pools/{poolId}/status`

```json
{
  "enabled": false
}
```

## 6) 查询池内IP列表（按状态筛选）

`GET /api/pools/{poolId}/ips?status=2&page=1&pageSize=20`

## 7) 查询池统计

`GET /api/pools/{poolId}/stats`

## 8) 新增静态绑定

`POST /api/pools/{poolId}/bindings`

```json
{
  "ip": "10.10.10.8",
  "expectedMac": "AA:BB:CC:DD:EE:FF",
  "deviceName": "设计部打印机",
  "department": "设计部",
  "owner": "张三",
  "purpose": "固定办公设备"
}
```

## 9) 查询静态绑定

`GET /api/pools/{poolId}/bindings?keyword=设计部&page=1&pageSize=20`

## 10) 修改静态绑定

`PUT /api/pools/{poolId}/bindings/{bindingId}`

```json
{
  "expectedMac": "AA:BB:CC:DD:EE:00",
  "owner": "李四"
}
```

## 11) 解绑静态绑定

`POST /api/pools/{poolId}/bindings/{bindingId}/unbind`
