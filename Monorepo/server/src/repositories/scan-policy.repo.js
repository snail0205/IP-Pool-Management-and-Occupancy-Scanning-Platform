const db = require("../config/db");

async function upsertPolicy(payload) {
  await db.execute(
    `
      INSERT INTO scan_policy
        (pool_id, enabled, cron_expr, scan_method, timeout_ms, retry_count, concurrency, auto_retry_times, silent_start, silent_end, channels, created_by, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled),
        cron_expr = VALUES(cron_expr),
        scan_method = VALUES(scan_method),
        timeout_ms = VALUES(timeout_ms),
        retry_count = VALUES(retry_count),
        concurrency = VALUES(concurrency),
        auto_retry_times = VALUES(auto_retry_times),
        silent_start = VALUES(silent_start),
        silent_end = VALUES(silent_end),
        channels = VALUES(channels),
        updated_at = NOW()
    `,
    [
      payload.poolId,
      payload.enabled ? 1 : 0,
      payload.cronExpr,
      payload.scanMethod,
      payload.timeoutMs,
      payload.retryCount,
      payload.concurrency,
      payload.autoRetryTimes,
      payload.silentStart || null,
      payload.silentEnd || null,
      payload.channels || "in_app",
      payload.createdBy || "system"
    ]
  );
}

async function listPolicies() {
  const [rows] = await db.execute(
    `
      SELECT
        id AS policyId,
        pool_id AS poolId,
        enabled,
        cron_expr AS cronExpr,
        scan_method AS scanMethod,
        timeout_ms AS timeoutMs,
        retry_count AS retryCount,
        concurrency,
        auto_retry_times AS autoRetryTimes,
        silent_start AS silentStart,
        silent_end AS silentEnd,
        channels,
        last_task_id AS lastTaskId,
        last_status AS lastStatus,
        last_triggered_at AS lastTriggeredAt,
        created_by AS createdBy,
        updated_at AS updatedAt
      FROM scan_policy
      ORDER BY id DESC
    `
  );
  return rows;
}

async function getPolicyByPoolId(poolId) {
  const [rows] = await db.execute(
    `
      SELECT
        id AS policyId,
        pool_id AS poolId,
        enabled,
        cron_expr AS cronExpr,
        scan_method AS scanMethod,
        timeout_ms AS timeoutMs,
        retry_count AS retryCount,
        concurrency,
        auto_retry_times AS autoRetryTimes,
        silent_start AS silentStart,
        silent_end AS silentEnd,
        channels
      FROM scan_policy
      WHERE pool_id = ?
      LIMIT 1
    `,
    [poolId]
  );
  return rows[0] || null;
}

async function listEnabledPolicies() {
  const [rows] = await db.execute(
    `
      SELECT
        id AS policyId,
        pool_id AS poolId,
        enabled,
        cron_expr AS cronExpr,
        scan_method AS scanMethod,
        timeout_ms AS timeoutMs,
        retry_count AS retryCount,
        concurrency,
        auto_retry_times AS autoRetryTimes,
        silent_start AS silentStart,
        silent_end AS silentEnd,
        channels
      FROM scan_policy
      WHERE enabled = 1
      ORDER BY id ASC
    `
  );
  return rows;
}

async function deletePolicyByPoolId(poolId) {
  await db.execute("DELETE FROM scan_policy WHERE pool_id = ?", [poolId]);
}

async function markPolicyTriggerResult(policyId, payload) {
  await db.execute(
    `
      UPDATE scan_policy
      SET
        last_task_id = ?,
        last_status = ?,
        last_triggered_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `,
    [payload.lastTaskId || null, payload.lastStatus || null, policyId]
  );
}

module.exports = {
  upsertPolicy,
  listPolicies,
  getPolicyByPoolId,
  listEnabledPolicies,
  deletePolicyByPoolId,
  markPolicyTriggerResult
};
