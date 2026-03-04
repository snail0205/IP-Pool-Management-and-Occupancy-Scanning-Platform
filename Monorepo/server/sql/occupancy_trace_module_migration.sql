-- IP占用详情与追溯模块迁移
-- MySQL 8.x

ALTER TABLE ip_scan_result
  ADD COLUMN IF NOT EXISTS host_name VARCHAR(255) NULL COMMENT '主机名',
  ADD COLUMN IF NOT EXISTS os_name VARCHAR(255) NULL COMMENT '操作系统';

CREATE INDEX IF NOT EXISTS idx_ip_scan_result_pool_status ON ip_scan_result(pool_id, status_code);
CREATE INDEX IF NOT EXISTS idx_ip_scan_result_pool_time ON ip_scan_result(pool_id, last_scan_time);

CREATE TABLE IF NOT EXISTS ip_occupancy_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  pool_id BIGINT NOT NULL,
  ip VARCHAR(64) NOT NULL,
  event_type VARCHAR(32) NOT NULL COMMENT 'occupy/release/device_change/owner_change/status_change',
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
  INDEX idx_occ_history_pool_event_time (pool_id, event_type, event_time),
  CONSTRAINT fk_occ_history_pool
    FOREIGN KEY (pool_id) REFERENCES ip_pool(id)
    ON DELETE CASCADE
);
