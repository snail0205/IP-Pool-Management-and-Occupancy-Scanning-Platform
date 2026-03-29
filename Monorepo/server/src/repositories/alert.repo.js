const db = require("../config/db");

async function upsertOpenAlert(payload) {
  const [existingRows] = await db.execute(
    `
      SELECT id AS alertId
      FROM sys_alert
      WHERE dedup_key = ? AND status = 'open'
      ORDER BY id DESC
      LIMIT 1
    `,
    [payload.dedupKey]
  );
  const existing = existingRows[0];
  if (existing) {
    await db.execute(
      `
        UPDATE sys_alert
        SET
          level = ?,
          title = ?,
          content = ?,
          channels = ?,
          notify_result_json = ?,
          last_notified_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `,
      [
        payload.level,
        payload.title,
        payload.content || null,
        payload.channels || null,
        payload.notifyResultJson || null,
        existing.alertId
      ]
    );
    return existing.alertId;
  }

  const [result] = await db.execute(
    `
      INSERT INTO sys_alert
        (alert_type, level, title, content, pool_id, ip, task_id, status, channels, notify_result_json, last_notified_at, dedup_key, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, NOW(), ?, NOW(), NOW())
    `,
    [
      payload.alertType,
      payload.level,
      payload.title,
      payload.content || null,
      payload.poolId || null,
      payload.ip || null,
      payload.taskId || null,
      payload.channels || null,
      payload.notifyResultJson || null,
      payload.dedupKey
    ]
  );
  return result.insertId;
}

async function listAlerts(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereSql = "WHERE 1=1";

  if (query.status) {
    whereSql += " AND status = ?";
    params.push(String(query.status));
  }
  if (query.alertType) {
    whereSql += " AND alert_type = ?";
    params.push(String(query.alertType));
  }
  if (query.level) {
    whereSql += " AND level = ?";
    params.push(String(query.level));
  }
  if (query.poolId) {
    whereSql += " AND pool_id = ?";
    params.push(Number(query.poolId));
  }

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM sys_alert ${whereSql}`,
    params
  );
  const [rows] = await db.execute(
    `
      SELECT
        id AS alertId,
        alert_type AS alertType,
        level,
        title,
        content,
        pool_id AS poolId,
        ip,
        task_id AS taskId,
        status,
        channels,
        notify_result_json AS notifyResultJson,
        last_notified_at AS lastNotifiedAt,
        resolved_at AS resolvedAt,
        resolved_by AS resolvedBy,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM sys_alert
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

async function resolveAlert(alertId, userId) {
  await db.execute(
    `
      UPDATE sys_alert
      SET status = 'resolved', resolved_at = NOW(), resolved_by = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [userId || null, alertId]
  );
}

async function reopenAlert(alertId) {
  await db.execute(
    `
      UPDATE sys_alert
      SET status = 'open', resolved_at = NULL, resolved_by = NULL, updated_at = NOW()
      WHERE id = ?
    `,
    [alertId]
  );
}

module.exports = {
  upsertOpenAlert,
  listAlerts,
  resolveAlert,
  reopenAlert
};
