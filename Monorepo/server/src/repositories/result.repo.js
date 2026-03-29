const db = require("../config/db");
const occupancyRepo = require("./occupancy.repo");

async function listResultsByPoolId({ poolId, page = 1, pageSize = 50, status, keyword }) {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50;
  const offset = (safePage - 1) * safePageSize;
  const params = [poolId];
  let whereSql = "WHERE r.pool_id = ?";

  if (status !== undefined && status !== null && status !== "") {
    whereSql += " AND r.status_code = ?";
    params.push(Number(status));
  }
  if (keyword) {
    whereSql += " AND (r.ip LIKE ? OR IFNULL(b.device_name, '') LIKE ? OR IFNULL(r.mac, '') LIKE ? OR IFNULL(b.department, '') LIKE ? OR IFNULL(b.owner, '') LIKE ?)";
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw, kw);
  }

  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM ip_scan_result r
      LEFT JOIN ip_registry b ON b.pool_id = r.pool_id AND b.ip = r.ip AND b.is_bound = 1
      ${whereSql}
    `,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.execute(
    `SELECT
        r.ip,
        r.status_code AS status,
        r.is_alive AS isAlive,
        r.mac,
        r.ttl,
        r.open_ports AS openPorts,
        r.last_scan_time AS lastScanTime,
        b.id AS bindingId,
        b.device_name AS deviceName,
        b.department,
        b.owner,
        b.purpose
     FROM ip_scan_result r
     LEFT JOIN ip_registry b ON b.pool_id = r.pool_id AND b.ip = r.ip AND b.is_bound = 1
     ${whereSql}
     ORDER BY ip ASC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    params
  );

  return { page: safePage, pageSize: safePageSize, total, list: rows };
}

async function upsertScanResult({
  poolId,
  ip,
  isAlive,
  ttl,
  statusCode,
  statusReason,
  taskId
}) {
  const sql = `
    INSERT INTO ip_scan_result
      (pool_id, ip, is_alive, ttl, status_code, status_reason, task_id, last_scan_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      is_alive = VALUES(is_alive),
      ttl = VALUES(ttl),
      status_code = VALUES(status_code),
      status_reason = VALUES(status_reason),
      task_id = VALUES(task_id),
      last_scan_time = VALUES(last_scan_time)
  `;

  const [beforeRows] = await db.execute(
    "SELECT status_code AS statusCode, mac, is_alive AS isAlive FROM ip_scan_result WHERE pool_id = ? AND ip = ? LIMIT 1",
    [poolId, ip]
  );
  const before = beforeRows[0] || null;

  await db.execute(sql, [poolId, ip, isAlive ? 1 : 0, ttl ?? null, statusCode, statusReason || null, taskId || null]);

  if (!before) {
    if (statusCode === 1 || statusCode === 2) {
      await occupancyRepo.insertHistoryEvent({
        poolId,
        ip,
        eventType: "occupy",
        newStatusCode: statusCode,
        newMac: null,
        sourceTaskId: taskId,
        remark: statusReason || "occupied on first scan"
      });
    } else if (statusCode === 0) {
      await occupancyRepo.insertHistoryEvent({
        poolId,
        ip,
        eventType: "release",
        newStatusCode: statusCode,
        sourceTaskId: taskId,
        remark: "released on first scan"
      });
    }
    return;
  }

  if (before.statusCode !== statusCode) {
    let eventType = "status_change";
    if ((before.statusCode === 0 || before.statusCode === -1) && (statusCode === 1 || statusCode === 2)) {
      eventType = "occupy";
    } else if ((before.statusCode === 1 || before.statusCode === 2) && statusCode === 0) {
      eventType = "release";
    }
    await occupancyRepo.insertHistoryEvent({
      poolId,
      ip,
      eventType,
      oldStatusCode: before.statusCode,
      newStatusCode: statusCode,
      oldMac: before.mac,
      newMac: null,
      sourceTaskId: taskId,
      remark: statusReason || "status changed by scan"
    });
  }
}

async function listIpsByPoolId(poolId) {
  const [rows] = await db.execute(
    "SELECT ip FROM ip_scan_result WHERE pool_id = ? ORDER BY ip ASC",
    [poolId]
  );
  return rows.map((row) => row.ip);
}

module.exports = { listResultsByPoolId, upsertScanResult, listIpsByPoolId };
