CREATE TABLE IF NOT EXISTS sys_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sys_token (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  INDEX idx_sys_token_user (user_id),
  INDEX idx_sys_token_expires (expires_at),
  CONSTRAINT fk_sys_token_user
    FOREIGN KEY (user_id) REFERENCES sys_user(id)
    ON DELETE CASCADE
);

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
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user_time (user_id, created_at),
  INDEX idx_audit_entity_time (entity, entity_id, created_at)
);
