# IP占用扫描任务管理模块设计

## 1) 任务状态机

状态集合：
- `pending`（待执行）
- `running`（执行中）
- `paused`（已暂停）
- `success`（已完成）
- `failed`（失败）
- `cancelled`（终止）

状态流转：
1. 创建任务：`pending`
2. 手动触发：`pending -> running`
3. 请求暂停：`running --pause_requested--> paused`
4. 请求终止：
   - `running -> cancelled`
   - `paused -> cancelled`
   - `pending -> cancelled`
5. 任务执行结束：
   - 正常完成：`running -> success`
   - 异常中断：`running -> failed`

控制标记（`control_flag`）：
- `none`
- `pause_requested`
- `stop_requested`

> 扫描循环在批次边界读取 `control_flag`，实现“可暂停/可终止”。

## 2) 重复执行与并发冲突方案

1. **幂等键**
   - 创建任务支持 `idempotencyKey`；
   - 同池+同幂等键+状态在 `pending/running/paused` 时返回已有任务，不重复创建。

2. **池级锁**
   - 进程内 `poolExecutionLocks` 实现同池串行执行。
   - 触发前同时检查DB中同池是否存在 `running` 任务。

3. **队列机制**
   - `taskQueue` 统一排队，`processQueue()` 负责调度；
   - 锁冲突任务会回队等待，避免并发覆盖。

## 3) 冲突/非法占用/不一致识别规则

- 离线：`status_code=0`，`status_reason=offline`
- 在线但无绑定记录：`status_code=2`，`status_reason=illegal_occupancy`
- 在线且有绑定，且MAC不一致：`status_code=2`，`status_reason=inconsistent_mac`
- 在线且绑定一致：`status_code=1`，`status_reason=registry_matched`

> 当前MVP以ICMP为主，MAC来源受网络环境限制；若无扫描MAC，仅进行“非法占用”判断。

## 4) 关键流程图（文字版）

1. 创建任务（pending）  
`API -> task_service.create -> scan_task.insert -> scan_task_log(task_created)`

2. 手动触发（running）  
`API -> task_service.trigger -> pool级并发检查 -> mark running -> 入队`

3. 队列调度执行  
`queue_worker -> 获取池锁 -> executeScanTask -> 分批扫描 -> 更新progress`

4. 扫描中断控制  
`每批检查control_flag`  
- `pause_requested` => `status=paused`  
- `stop_requested` => `status=cancelled`

5. 结束落库  
- 正常：`status=success`  
- 异常：`status=failed`  
- 全程写 `scan_task_log` 供查询/导出
