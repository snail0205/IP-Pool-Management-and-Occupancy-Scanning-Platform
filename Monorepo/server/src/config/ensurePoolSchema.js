/**
 * 启动时确保 ip_pool 表存在且包含所需列，避免 "Unknown column 'start_ip'" 等错误。
 * 若表不存在则创建；若存在则补全缺失列。
 */
const db = require("./db");
const env = require("./env");

const POOL_COLUMNS = [
  { name: "cidr", def: "VARCHAR(64) NULL COMMENT 'CIDR'" },
  { name: "region", def: "VARCHAR(50) NULL COMMENT '网络区域'" },
  { name: "network_type", def: "VARCHAR(10) NOT NULL DEFAULT 'IPv4' COMMENT 'IPv4/IPv6'" },
  { name: "start_ip", def: "VARCHAR(64) NULL COMMENT '起始IP'" },
  { name: "end_ip", def: "VARCHAR(64) NULL COMMENT '结束IP'" },
  { name: "subnet_mask", def: "VARCHAR(64) NULL COMMENT '子网掩码/前缀'" },
  { name: "gateway", def: "VARCHAR(64) NULL COMMENT '网关'" },
  { name: "dns", def: "VARCHAR(255) NULL COMMENT 'DNS列表'" },
  { name: "lease_hours", def: "INT NULL COMMENT '租期(小时)'" },
  { name: "enabled", def: "TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用'" },
  { name: "include_network_broadcast", def: "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '含网络/广播地址'" },
  { name: "created_at", def: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP" },
  { name: "updated_at", def: "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" }
];

const REGISTRY_COLUMNS = [
  { name: "device_name", def: "VARCHAR(100) NULL COMMENT '设备名称'" },
  { name: "department", def: "VARCHAR(100) NULL COMMENT '部门'" },
  { name: "owner", def: "VARCHAR(100) NULL COMMENT '负责人'" },
  { name: "purpose", def: "VARCHAR(255) NULL COMMENT '用途'" },
  { name: "is_bound", def: "TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否绑定'" },
  { name: "bound_at", def: "DATETIME NULL COMMENT '绑定时间'" },
  { name: "unbound_at", def: "DATETIME NULL COMMENT '解绑时间'" }
];

const SCAN_RESULT_COLUMNS = [
  { name: "status_reason", def: "VARCHAR(64) NULL COMMENT '状态原因'" },
  { name: "open_ports", def: "JSON NULL COMMENT '开放端口'" },
  { name: "task_id", def: "BIGINT NULL COMMENT '关联任务ID'" },
  { name: "host_name", def: "VARCHAR(255) NULL COMMENT '主机名'" },
  { name: "os_name", def: "VARCHAR(255) NULL COMMENT '操作系统'" }
];

async function tableExists(tableName) {
  const dbName = env.db.database;
  const [rows] = await db.execute(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1",
    [dbName, tableName]
  );
  return rows.length > 0;
}

async function getExistingColumns(tableName) {
  const dbName = env.db.database;
  const [rows] = await db.execute(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?",
    [dbName, tableName]
  );
  // MySQL 可能返回 column_name 或 COLUMN_NAME，兼容并避免 undefined.toLowerCase
  const nameKey = rows.length && rows[0] ? (Object.keys(rows[0]).find((k) => /column_name/i.test(k)) || "column_name") : "column_name";
  return new Set(rows.map((r) => String(r[nameKey] ?? "").toLowerCase()));
}

async function getColumnNullable(tableName, columnName) {
  const dbName = env.db.database;
  const [rows] = await db.execute(
    `
      SELECT is_nullable AS isNullable
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ? AND column_name = ?
      LIMIT 1
    `,
    [dbName, tableName, columnName]
  );
  if (!rows.length) return null;
  const nullableKey = Object.keys(rows[0]).find((k) => /is_nullable/i.test(k)) || "isNullable";
  return String(rows[0][nullableKey] || "").toUpperCase();
}

async function ensureIpRegistrySchema() {
  const exists = await tableExists('ip_registry');
  if (!exists) {
    await db.execute(`
      CREATE TABLE ip_registry (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        pool_id BIGINT NOT NULL,
        ip VARCHAR(64) NOT NULL,
        expected_mac VARCHAR(64) NULL,
        device_name VARCHAR(100) NULL,
        department VARCHAR(100) NULL,
        owner VARCHAR(100) NULL,
        purpose VARCHAR(255) NULL,
        is_bound TINYINT(1) NOT NULL DEFAULT 1,
        bound_at DATETIME NULL,
        unbound_at DATETIME NULL,
        remark VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_pool_ip (pool_id, ip)
      )
    `);
    return;
  }
  const existing = await getExistingColumns('ip_registry');
  for (const col of REGISTRY_COLUMNS) {
    if (existing.has(col.name.toLowerCase())) continue;
    try {
      await db.execute(`ALTER TABLE ip_registry ADD COLUMN \`${col.name}\` ${col.def}`);
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }
  }
}

async function ensureIpScanResultSchema() {
  const exists = await tableExists("ip_scan_result");
  if (!exists) return;
  const existing = await getExistingColumns("ip_scan_result");
  for (const col of SCAN_RESULT_COLUMNS) {
    if (existing.has(col.name.toLowerCase())) continue;
    try {
      await db.execute(`ALTER TABLE ip_scan_result ADD COLUMN \`${col.name}\` ${col.def}`);
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }
  }
}

async function ensureOccupancyHistorySchema() {
  const exists = await tableExists("ip_occupancy_history");
  if (exists) return;

  // 兼容历史库：不要在启动时强制创建外键，避免 pool_id 与 ip_pool.id 类型差异导致启动失败。
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ip_occupancy_history (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      pool_id BIGINT NOT NULL,
      ip VARCHAR(64) NOT NULL,
      event_type VARCHAR(32) NOT NULL,
      old_status_code TINYINT NULL,
      new_status_code TINYINT NULL,
      old_mac VARCHAR(64) NULL,
      new_mac VARCHAR(64) NULL,
      old_device_name VARCHAR(255) NULL,
      new_device_name VARCHAR(255) NULL,
      old_owner VARCHAR(100) NULL,
      new_owner VARCHAR(100) NULL,
      old_department VARCHAR(100) NULL,
      new_department VARCHAR(100) NULL,
      source_task_id BIGINT NULL,
      remark VARCHAR(255) NULL,
      event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_occ_history_pool_ip_time (pool_id, ip, event_time),
      INDEX idx_occ_history_pool_event_time (pool_id, event_type, event_time)
    )
  `);
}

async function ensureIpPoolSchema() {
  const exists = await tableExists('ip_pool');
  if (!exists) {
    await db.execute(`
      CREATE TABLE ip_pool (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(128) NOT NULL,
        region VARCHAR(50) NULL,
        network_type VARCHAR(10) NOT NULL DEFAULT 'IPv4',
        start_ip VARCHAR(64) NULL,
        end_ip VARCHAR(64) NULL,
        subnet_mask VARCHAR(64) NULL,
        gateway VARCHAR(64) NULL,
        dns VARCHAR(255) NULL,
        lease_hours INT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        cidr VARCHAR(64) NULL,
        include_network_broadcast TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } else {
    const existing = await getExistingColumns('ip_pool');
    for (const col of POOL_COLUMNS) {
      if (existing.has(col.name.toLowerCase())) continue;
      try {
        await db.execute(`ALTER TABLE ip_pool ADD COLUMN \`${col.name}\` ${col.def}`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") throw e;
      }
    }
    // 兼容历史库：旧版本可能将 cidr 设为 NOT NULL，范围模式创建会写入 null 而报错。
    const cidrNullable = await getColumnNullable("ip_pool", "cidr");
    if (cidrNullable === "NO") {
      await db.execute("ALTER TABLE ip_pool MODIFY COLUMN `cidr` VARCHAR(64) NULL COMMENT 'CIDR'");
    }
  }
  
  // Ensure dependent module schemas as well
  await ensureIpRegistrySchema();
  await ensureIpScanResultSchema();
  await ensureOccupancyHistorySchema();
}

module.exports = { ensureIpPoolSchema };
