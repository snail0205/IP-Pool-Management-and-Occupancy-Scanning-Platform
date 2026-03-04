-- IP占用扫描任务管理模块迁移
-- MySQL 8.x

ALTER TABLE scan_task
  MODIFY COLUMN status ENUM('pending','running','paused','success','failed','cancelled') NOT NULL DEFAULT 'pending';

ALTER TABLE scan_task
  ADD COLUMN IF NOT EXISTS scope_type VARCHAR(32) NOT NULL DEFAULT 'pool' COMMENT 'pool/custom_range/custom_list',
  ADD COLUMN IF NOT EXISTS scan_method VARCHAR(32) NOT NULL DEFAULT 'icmp_arp' COMMENT 'icmp_arp/tcp/udp',
  ADD COLUMN IF NOT EXISTS frequency_type VARCHAR(32) NOT NULL DEFAULT 'once' COMMENT 'once/hourly/daily/weekly',
  ADD COLUMN IF NOT EXISTS timeout_ms INT NOT NULL DEFAULT 1500 COMMENT '单次探测超时',
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 1 COMMENT '重试次数',
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) NULL COMMENT '幂等键',
  ADD COLUMN IF NOT EXISTS schedule_cron VARCHAR(128) NULL COMMENT '定时表达式',
  ADD COLUMN IF NOT EXISTS control_flag VARCHAR(32) NOT NULL DEFAULT 'none' COMMENT 'none/pause_requested/stop_requested',
  ADD COLUMN IF NOT EXISTS triggered_at DATETIME NULL COMMENT '最近触发时间';

CREATE INDEX IF NOT EXISTS idx_scan_task_pool_status ON scan_task(pool_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_task_idempotency ON scan_task(pool_id, idempotency_key);

CREATE TABLE IF NOT EXISTS scan_task_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NOT NULL,
  level VARCHAR(16) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  message VARCHAR(255) NOT NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scan_task_log_task (task_id),
  INDEX idx_scan_task_log_created (created_at),
  CONSTRAINT fk_scan_task_log_task
    FOREIGN KEY (task_id) REFERENCES scan_task(id)
    ON DELETE CASCADE
);
