const db = require("../config/db");

async function createTask({
  poolId,
  paramsJson,
  createdBy = "system",
  scopeType = "pool",
  scanMethod = "icmp_arp",
  frequencyType = "once",
  timeoutMs = 1500,
  retryCount = 1,
  idempotencyKey = null,
  scheduleCron = null
}) {
  const sql = `
    INSERT INTO scan_task
      (pool_id, status, progress, total_count, processed_count, online_count, conflict_count,
       params_json, created_by, scope_type, scan_method, frequency_type, timeout_ms, retry_count,
       idempotency_key, schedule_cron, control_flag)
    VALUES
      (?, 'pending', 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none')
  `;
  const [result] = await db.execute(sql, [
    poolId,
    JSON.stringify(paramsJson || {}),
    createdBy,
    scopeType,
    scanMethod,
    frequencyType,
    timeoutMs,
    retryCount,
    idempotencyKey,
    scheduleCron
  ]);
  return result.insertId;
}

async function getTaskById(taskId) {
  const [rows] = await db.execute(
    `SELECT
      id AS taskId,
      pool_id AS poolId,
      status,
      progress,
      total_count AS totalCount,
      processed_count AS processedCount,
      online_count AS onlineCount,
      conflict_count AS conflictCount,
      scope_type AS scopeType,
      scan_method AS scanMethod,
      frequency_type AS frequencyType,
      timeout_ms AS timeoutMs,
      retry_count AS retryCount,
      idempotency_key AS idempotencyKey,
      schedule_cron AS scheduleCron,
      control_flag AS controlFlag,
      triggered_at AS triggeredAt,
      started_at AS startedAt,
      ended_at AS endedAt,
      error_msg AS errorMsg,
      params_json AS paramsJson
    FROM scan_task
    WHERE id = ? LIMIT 1`,
    [taskId]
  );
  return rows[0] || null;
}

async function listTasks(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereSql = "WHERE 1=1";

  if (query.poolId) {
    whereSql += " AND pool_id = ?";
    params.push(Number(query.poolId));
  }
  if (query.status) {
    whereSql += " AND status = ?";
    params.push(String(query.status));
  }
  if (query.frequencyType) {
    whereSql += " AND frequency_type = ?";
    params.push(String(query.frequencyType));
  }

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM scan_task ${whereSql}`,
    params
  );

  const [rows] = await db.execute(
    `
      SELECT
        id AS taskId,
        pool_id AS poolId,
        status,
        progress,
        total_count AS totalCount,
        processed_count AS processedCount,
        online_count AS onlineCount,
        conflict_count AS conflictCount,
        scope_type AS scopeType,
        scan_method AS scanMethod,
        frequency_type AS frequencyType,
        timeout_ms AS timeoutMs,
        retry_count AS retryCount,
        idempotency_key AS idempotencyKey,
        schedule_cron AS scheduleCron,
        control_flag AS controlFlag,
        started_at AS startedAt,
        ended_at AS endedAt,
        error_msg AS errorMsg,
        created_at AS createdAt
      FROM scan_task
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

async function listScheduledTasks() {
  const [rows] = await db.execute(
    `
      SELECT
        id AS taskId,
        pool_id AS poolId,
        status,
        scope_type AS scopeType,
        scan_method AS scanMethod,
        frequency_type AS frequencyType,
        timeout_ms AS timeoutMs,
        retry_count AS retryCount,
        schedule_cron AS scheduleCron,
        params_json AS paramsJson
      FROM scan_task
      WHERE (frequency_type <> 'once' OR schedule_cron IS NOT NULL)
        AND status <> 'cancelled'
    `
  );
  return rows;
}

async function getRunningTaskByPoolId(poolId) {
  const [rows] = await db.execute(
    "SELECT id AS taskId FROM scan_task WHERE pool_id = ? AND status = 'running' LIMIT 1",
    [poolId]
  );
  return rows[0] || null;
}

async function getTaskByIdempotency(poolId, idempotencyKey) {
  if (!idempotencyKey) return null;
  const [rows] = await db.execute(
    `
      SELECT id AS taskId, status
      FROM scan_task
      WHERE pool_id = ? AND idempotency_key = ? AND status IN ('pending', 'running', 'paused')
      ORDER BY id DESC
      LIMIT 1
    `,
    [poolId, idempotencyKey]
  );
  return rows[0] || null;
}

async function markTaskRunning(taskId) {
  await db.execute(
    "UPDATE scan_task SET status = 'running', control_flag = 'none', triggered_at = NOW(), started_at = IFNULL(started_at, NOW()) WHERE id = ?",
    [taskId]
  );
}

async function markTaskPaused(taskId) {
  await db.execute(
    "UPDATE scan_task SET status = 'paused', control_flag = 'none' WHERE id = ?",
    [taskId]
  );
}

async function markPauseRequested(taskId) {
  await db.execute(
    "UPDATE scan_task SET control_flag = 'pause_requested' WHERE id = ? AND status = 'running'",
    [taskId]
  );
}

async function markStopRequested(taskId) {
  await db.execute(
    "UPDATE scan_task SET control_flag = 'stop_requested' WHERE id = ? AND status IN ('running','paused','pending')",
    [taskId]
  );
}

async function getTaskControlFlag(taskId) {
  const [rows] = await db.execute(
    "SELECT control_flag AS controlFlag, status FROM scan_task WHERE id = ? LIMIT 1",
    [taskId]
  );
  return rows[0] || { controlFlag: "none", status: "unknown" };
}

async function updateTaskProgress(taskId, payload) {
  const sql = `
    UPDATE scan_task
    SET
      progress = ?,
      total_count = ?,
      processed_count = ?,
      online_count = ?,
      conflict_count = ?
    WHERE id = ?
  `;
  await db.execute(sql, [
    payload.progress,
    payload.totalCount,
    payload.processedCount,
    payload.onlineCount,
    payload.conflictCount,
    taskId
  ]);
}

async function finishTaskSuccess(taskId) {
  await db.execute(
    "UPDATE scan_task SET status = 'success', control_flag = 'none', progress = 100, ended_at = NOW() WHERE id = ?",
    [taskId]
  );
}

async function finishTaskFailed(taskId, errorMsg) {
  await db.execute(
    "UPDATE scan_task SET status = 'failed', control_flag = 'none', ended_at = NOW(), error_msg = ? WHERE id = ?",
    [errorMsg || "scan task failed", taskId]
  );
}

async function finishTaskCancelled(taskId, errorMsg) {
  await db.execute(
    "UPDATE scan_task SET status = 'cancelled', control_flag = 'none', ended_at = NOW(), error_msg = ? WHERE id = ?",
    [errorMsg || "task cancelled", taskId]
  );
}

async function addTaskLog(taskId, level, eventType, message, payload) {
  await db.execute(
    `
      INSERT INTO scan_task_log
        (task_id, level, event_type, message, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `,
    [taskId, level, eventType, message, payload ? JSON.stringify(payload) : null]
  );
}

async function listTaskLogs(taskId, query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 200);
  const offset = (page - 1) * pageSize;
  const params = [taskId];
  let whereSql = "WHERE task_id = ?";

  if (query.level) {
    whereSql += " AND level = ?";
    params.push(String(query.level));
  }
  if (query.eventType) {
    whereSql += " AND event_type = ?";
    params.push(String(query.eventType));
  }
  if (query.keyword) {
    whereSql += " AND (message LIKE ? OR IFNULL(payload_json, '') LIKE ?)";
    const kw = `%${String(query.keyword)}%`;
    params.push(kw, kw);
  }

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM scan_task_log ${whereSql}`,
    params
  );
  const [rows] = await db.execute(
    `
      SELECT
        id,
        task_id AS taskId,
        level,
        event_type AS eventType,
        message,
        payload_json AS payloadJson,
        created_at AS createdAt
      FROM scan_task_log
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

async function listRecentFailedTasks(limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit || 10), 1), 100);
  const [rows] = await db.execute(
    `
      SELECT
        t.id AS taskId,
        t.pool_id AS poolId,
        t.status,
        t.error_msg AS errorMsg,
        t.started_at AS startedAt,
        t.ended_at AS endedAt,
        t.created_at AS createdAt,
        p.name AS poolName
      FROM scan_task t
      LEFT JOIN ip_pool p ON p.id = t.pool_id
      WHERE t.status = 'failed'
      ORDER BY t.id DESC
      LIMIT ${safeLimit}
    `
  );
  return rows;
}

module.exports = {
  createTask,
  getTaskById,
  listTasks,
  listScheduledTasks,
  getRunningTaskByPoolId,
  getTaskByIdempotency,
  markTaskRunning,
  markTaskPaused,
  markPauseRequested,
  markStopRequested,
  getTaskControlFlag,
  updateTaskProgress,
  finishTaskSuccess,
  finishTaskFailed,
  finishTaskCancelled,
  addTaskLog,
  listTaskLogs,
  listRecentFailedTasks
};
