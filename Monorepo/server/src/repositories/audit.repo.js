const db = require("../config/db");

async function insertAuditLog(payload) {
  await db.execute(
    `
      INSERT INTO sys_audit_log
        (user_id, username, role, action, method, path, entity, entity_id, request_body, query_params, ip, user_agent, status_code, before_json, after_json, diff_json, rollback_payload, rollback_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
      payload.statusCode ?? null,
      payload.beforeJson ?? null,
      payload.afterJson ?? null,
      payload.diffJson ?? null,
      payload.rollbackPayload ?? null,
      payload.rollbackStatus ?? "none"
    ]
  );
}

async function listAuditLogs(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereSql = "WHERE 1=1";

  if (query.entity) {
    whereSql += " AND entity = ?";
    params.push(String(query.entity));
  }
  if (query.action) {
    whereSql += " AND action = ?";
    params.push(String(query.action));
  }
  if (query.username) {
    whereSql += " AND username = ?";
    params.push(String(query.username));
  }
  if (query.keyword) {
    whereSql += " AND (path LIKE ? OR IFNULL(diff_json, '') LIKE ? OR IFNULL(request_body, '') LIKE ?)";
    const kw = `%${String(query.keyword)}%`;
    params.push(kw, kw, kw);
  }

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM sys_audit_log ${whereSql}`,
    params
  );
  const [rows] = await db.execute(
    `
      SELECT
        id AS auditId,
        user_id AS userId,
        username,
        role,
        action,
        method,
        path,
        entity,
        entity_id AS entityId,
        request_body AS requestBody,
        query_params AS queryParams,
        status_code AS statusCode,
        before_json AS beforeJson,
        after_json AS afterJson,
        diff_json AS diffJson,
        rollback_payload AS rollbackPayload,
        rollback_status AS rollbackStatus,
        rolled_back_at AS rolledBackAt,
        rolled_back_by AS rolledBackBy,
        created_at AS createdAt
      FROM sys_audit_log
      ${whereSql}
      ORDER BY id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    params
  );
  return {
    page,
    pageSize,
    total: countRows[0].total,
    list: rows
  };
}

async function getAuditById(auditId) {
  const [rows] = await db.execute(
    `
      SELECT
        id AS auditId,
        entity,
        entity_id AS entityId,
        rollback_payload AS rollbackPayload
      FROM sys_audit_log
      WHERE id = ?
      LIMIT 1
    `,
    [auditId]
  );
  return rows[0] || null;
}

async function markRollbackResult(auditId, userId, success) {
  await db.execute(
    `
      UPDATE sys_audit_log
      SET
        rollback_status = ?,
        rolled_back_at = NOW(),
        rolled_back_by = ?
      WHERE id = ?
    `,
    [success ? "success" : "failed", userId || null, auditId]
  );
}

module.exports = {
  insertAuditLog,
  listAuditLogs,
  getAuditById,
  markRollbackResult
};
