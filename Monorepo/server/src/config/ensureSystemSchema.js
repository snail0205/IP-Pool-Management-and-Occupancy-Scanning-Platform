const db = require("./db");

async function ensureAuditColumns() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sys_audit_log (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NULL,
      username VARCHAR(64) NULL,
      role VARCHAR(16) NULL,
      action VARCHAR(16) NULL,
      method VARCHAR(16) NULL,
      path VARCHAR(255) NULL,
      entity VARCHAR(64) NULL,
      entity_id BIGINT NULL,
      request_body TEXT NULL,
      query_params TEXT NULL,
      ip VARCHAR(64) NULL,
      user_agent VARCHAR(255) NULL,
      status_code INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const columns = [
    ["before_json", "LONGTEXT NULL COMMENT '变更前快照'"],
    ["after_json", "LONGTEXT NULL COMMENT '变更后快照'"],
    ["diff_json", "LONGTEXT NULL COMMENT '差异摘要'"],
    ["rollback_payload", "LONGTEXT NULL COMMENT '回滚载荷'"],
    ["rollback_status", "VARCHAR(32) NULL COMMENT 'none/success/failed'"],
    ["rolled_back_at", "DATETIME NULL COMMENT '回滚时间'"],
    ["rolled_back_by", "BIGINT NULL COMMENT '回滚操作人'"]
  ];
  for (const [name, def] of columns) {
    try {
      await db.execute(`ALTER TABLE sys_audit_log ADD COLUMN \`${name}\` ${def}`);
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
}

async function ensureSystemSettingSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sys_setting (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      setting_key VARCHAR(128) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      description VARCHAR(255) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sys_alert (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      alert_type VARCHAR(64) NOT NULL,
      level VARCHAR(16) NOT NULL DEFAULT 'warning',
      title VARCHAR(255) NOT NULL,
      content TEXT NULL,
      pool_id BIGINT NULL,
      ip VARCHAR(64) NULL,
      task_id BIGINT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      channels VARCHAR(255) NULL,
      notify_result_json TEXT NULL,
      last_notified_at DATETIME NULL,
      resolved_at DATETIME NULL,
      resolved_by BIGINT NULL,
      dedup_key VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_alert_status_time (status, created_at),
      INDEX idx_alert_pool_ip (pool_id, ip),
      INDEX idx_alert_dedup (dedup_key)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS scan_policy (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      pool_id BIGINT NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      cron_expr VARCHAR(64) NOT NULL,
      scan_method VARCHAR(32) NOT NULL DEFAULT 'icmp_arp',
      timeout_ms INT NOT NULL DEFAULT 1500,
      retry_count INT NOT NULL DEFAULT 1,
      concurrency INT NOT NULL DEFAULT 20,
      auto_retry_times INT NOT NULL DEFAULT 0,
      silent_start VARCHAR(8) NULL,
      silent_end VARCHAR(8) NULL,
      channels VARCHAR(128) NULL,
      last_task_id BIGINT NULL,
      last_status VARCHAR(32) NULL,
      last_triggered_at DATETIME NULL,
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_scan_policy_pool (pool_id),
      INDEX idx_scan_policy_enabled (enabled)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_delivery_log (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      report_period VARCHAR(16) NOT NULL,
      report_type VARCHAR(16) NOT NULL,
      channels VARCHAR(128) NOT NULL,
      receivers VARCHAR(255) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'sent',
      detail TEXT NULL,
      created_by BIGINT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_report_delivery_time (created_at)
    )
  `);

  await ensureAuditColumns();
}

module.exports = { ensureSystemSettingSchema };

