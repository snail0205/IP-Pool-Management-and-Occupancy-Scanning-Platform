const db = require("../config/db");

async function insertAuditLog(payload) {
  await db.execute(
    `
      INSERT INTO sys_audit_log
        (user_id, username, role, action, method, path, entity, entity_id, request_body, query_params, ip, user_agent, status_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.userId ?? null,
      payload.username ?? null,
      payload.role ?? null,
      payload.action ?? null,
      payload.method ?? null,
      payload.path ?? null,
      payload.entity ?? null,
      payload.entityId ?? null,
      payload.requestBody ?? null,
      payload.queryParams ?? null,
      payload.ip ?? null,
      payload.userAgent ?? null,
      payload.statusCode ?? null
    ]
  );
}

module.exports = { insertAuditLog };
