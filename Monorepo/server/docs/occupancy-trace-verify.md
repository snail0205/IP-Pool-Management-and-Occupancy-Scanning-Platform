# IP占用详情与追溯模块验证步骤

## 1. 执行数据库迁移

按顺序执行：

1) `sql/occupancy_trace_module_migration.sql`  
2) （若尚未执行）`sql/ip_pool_base_module_migration.sql`  
3) （若尚未执行）`sql/scan_task_module_migration.sql`

## 2. 启动服务

`npm run dev`

## 3. 多条件查询验证

- `GET /api/occupancy?poolId=1&ip=10.0.0.&deviceName=打印机&mac=AA:BB&department=运维&page=1&pageSize=20`
- 预期：返回 `list`，且支持组合筛选。

## 4. 详情信息验证

- `GET /api/occupancy/detail/1/10.0.0.12`
- 预期字段：`hostName`、`osName`、`openPorts`、`connectionStatus`、`statusCode`、`statusReason`。

## 5. 历史追溯验证

- `GET /api/occupancy/history?poolId=1&ip=10.0.0.12&startTime=2026-01-01 00:00:00&endTime=2026-12-31 23:59:59&page=1&pageSize=50`
- 预期：出现 `occupy/release/device_change/owner_change/status_change` 事件。

## 6. 统计报表验证

- `GET /api/occupancy/report?poolId=1`
- 预期：
  - `usage`（使用率）
  - `occupancyType`（占用类型分布）
  - `departmentDistribution`（部门分布）
  - `duration`（占用时长）

## 7. 导出验证

- Excel：`GET /api/occupancy/report/export/excel?poolId=1`
  - 预期下载 `.xlsx`
- PDF：`GET /api/occupancy/report/export/pdf?poolId=1`
  - 预期下载 `.pdf`
