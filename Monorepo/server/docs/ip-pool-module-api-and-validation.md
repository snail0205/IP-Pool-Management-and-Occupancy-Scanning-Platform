# IP池基础信息管理模块：接口设计与校验规则

## 1. 接口设计

### 1.1 IP池管理

- `POST /api/pools`
  - 新增IP池（支持IPv4/IPv6）
- `GET /api/pools`
  - 分页查询IP池列表
- `GET /api/pools/:id`
  - 获取IP池详情
- `PUT /api/pools/:id`
  - 编辑IP池信息
- `DELETE /api/pools/:id`
  - 删除IP池
- `PATCH /api/pools/:id/status`
  - 启用/禁用IP池
- `GET /api/pools/:id/stats`
  - 获取统计（总数、已占用、空闲、异常）
- `GET /api/pools/:id/ips`
  - 获取池内IP列表（支持状态/关键字筛选）

### 1.2 静态绑定管理

- `POST /api/pools/:id/bindings`
  - 新增静态绑定（设备名、MAC、部门、负责人、用途）
- `GET /api/pools/:id/bindings`
  - 查询静态绑定（IP、设备名、MAC、部门关键词）
- `PUT /api/pools/:id/bindings/:bindingId`
  - 修改静态绑定
- `POST /api/pools/:id/bindings/:bindingId/unbind`
  - 解绑静态绑定（标记状态，不物理删除）

## 2. 数据校验规则

### 2.1 IP范围合法性

1. `startIp`、`endIp` 必填，且必须是合法IP。
2. `networkType` 必须与IP版本一致：
   - IPv4: `startIp`/`endIp` 必须为IPv4
   - IPv6: `startIp`/`endIp` 必须为IPv6
3. 起止顺序必须合法：`startIp <= endIp`。
4. 池初始化最多预生成4096个IP（防止超大范围导致性能问题）。

### 2.2 网关与DNS格式

1. `gateway` 可空，非空时必须是合法IP。
2. `gateway` IP版本必须与IP池类型一致。
3. `dns` 支持数组或逗号分隔字符串，解析后每个DNS都必须是合法IP。
4. 每个DNS的IP版本必须与IP池类型一致（避免IPv4池混入IPv6 DNS）。

### 2.3 IPv4/IPv6兼容规则

1. `networkType` 仅允许 `IPv4` 或 `IPv6`。
2. IPv4子网掩码支持：
   - 前缀长度（0~32）
   - 点分十进制掩码（如255.255.255.0），并校验连续1规则。
3. IPv6子网掩码支持前缀长度（0~128，可带或不带`/`）。
4. 若传入 `cidr`，当前仅支持IPv4 CIDR校验（IPv6 CIDR可在后续增强）。

## 3. 冲突校验规则（静态绑定）

1. 同一IP池内，IP只能存在一个“已绑定”记录。
2. 新增/修改绑定时，若同池同IP已被其他记录绑定，返回冲突错误。
3. 若IP当前扫描为在线状态，且扫描到的MAC与绑定MAC不一致，标记 `conflict=true`（不阻断保存，提示异常）。
