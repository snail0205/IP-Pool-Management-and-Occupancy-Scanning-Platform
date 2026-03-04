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

async function tableExists() {
  const dbName = env.db.database;
  const [rows] = await db.execute(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = 'ip_pool' LIMIT 1",
    [dbName]
  );
  return rows.length > 0;
}

async function getExistingColumns() {
  const dbName = env.db.database;
  const [rows] = await db.execute(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'ip_pool'",
    [dbName]
  );
  // MySQL 可能返回 column_name 或 COLUMN_NAME，兼容并避免 undefined.toLowerCase
  const nameKey = rows.length && rows[0] ? (Object.keys(rows[0]).find((k) => /column_name/i.test(k)) || "column_name") : "column_name";
  return new Set(rows.map((r) => String(r[nameKey] ?? "").toLowerCase()));
}

async function ensureIpPoolSchema() {
  const exists = await tableExists();
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
    return;
  }
  const existing = await getExistingColumns();
  for (const col of POOL_COLUMNS) {
    if (existing.has(col.name.toLowerCase())) continue;
    try {
      await db.execute(`ALTER TABLE ip_pool ADD COLUMN \`${col.name}\` ${col.def}`);
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }
  }
}

module.exports = { ensureIpPoolSchema };
