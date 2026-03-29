const db = require("../config/db");

async function getUsageTrend({ startDate, endDate }) {
  const [rows] = await db.execute(
    `
      SELECT
        DATE(created_at) AS statDate,
        COUNT(*) AS taskCount,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedTaskCount,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successTaskCount
      FROM scan_task
      WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY DATE(created_at)
      ORDER BY statDate ASC
    `,
    [startDate, endDate]
  );
  return rows;
}

async function getConflictTop10() {
  const [rows] = await db.execute(
    `
      SELECT
        r.pool_id AS poolId,
        p.name AS poolName,
        r.ip,
        r.status_reason AS statusReason,
        r.last_scan_time AS lastScanTime
      FROM ip_scan_result r
      LEFT JOIN ip_pool p ON p.id = r.pool_id
      WHERE r.status_code = 2
      ORDER BY r.last_scan_time DESC
      LIMIT 10
    `
  );
  return rows;
}

async function getLongOfflineAssets(hours = 72) {
  const safeHours = Math.max(Number(hours || 72), 1);
  const [rows] = await db.execute(
    `
      SELECT
        r.pool_id AS poolId,
        p.name AS poolName,
        r.ip,
        b.device_name AS deviceName,
        b.owner,
        r.last_scan_time AS lastScanTime,
        TIMESTAMPDIFF(HOUR, IFNULL(r.last_scan_time, DATE_SUB(NOW(), INTERVAL 365 DAY)), NOW()) AS offlineHours
      FROM ip_scan_result r
      LEFT JOIN ip_pool p ON p.id = r.pool_id
      LEFT JOIN ip_registry b ON b.pool_id = r.pool_id AND b.ip = r.ip AND b.is_bound = 1
      WHERE r.status_code = 0
        AND (r.last_scan_time IS NULL OR TIMESTAMPDIFF(HOUR, r.last_scan_time, NOW()) >= ?)
      ORDER BY offlineHours DESC
      LIMIT 200
    `,
    [safeHours]
  );
  return rows;
}

async function insertReportDeliveryLog(payload) {
  await db.execute(
    `
      INSERT INTO report_delivery_log
        (report_period, report_type, channels, receivers, status, detail, created_by, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      payload.reportPeriod,
      payload.reportType,
      payload.channels,
      payload.receivers || null,
      payload.status || "sent",
      payload.detail || null,
      payload.createdBy || null
    ]
  );
}

async function listReportDeliveries(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);
  const offset = (page - 1) * pageSize;
  const [countRows] = await db.execute("SELECT COUNT(*) AS total FROM report_delivery_log");
  const [rows] = await db.execute(
    `
      SELECT
        id,
        report_period AS reportPeriod,
        report_type AS reportType,
        channels,
        receivers,
        status,
        detail,
        created_by AS createdBy,
        created_at AS createdAt
      FROM report_delivery_log
      ORDER BY id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  );
  return {
    page,
    pageSize,
    total: countRows[0].total,
    list: rows
  };
}

module.exports = {
  getUsageTrend,
  getConflictTop10,
  getLongOfflineAssets,
  insertReportDeliveryLog,
  listReportDeliveries
};
