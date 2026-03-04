const db = require("../config/db");

async function searchOccupancy(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);
  const offset = (page - 1) * pageSize;

  let whereSql = "WHERE 1=1";
  const params = [];

  if (query.poolId) {
    whereSql += " AND r.pool_id = ?";
    params.push(Number(query.poolId));
  }
  if (query.ip) {
    whereSql += " AND r.ip LIKE ?";
    params.push(`%${query.ip}%`);
  }
  if (query.deviceName) {
    whereSql += " AND IFNULL(b.device_name, '') LIKE ?";
    params.push(`%${query.deviceName}%`);
  }
  if (query.mac) {
    whereSql += " AND (IFNULL(r.mac, '') LIKE ? OR IFNULL(b.expected_mac, '') LIKE ?)";
    params.push(`%${query.mac}%`, `%${query.mac}%`);
  }
  if (query.department) {
    whereSql += " AND IFNULL(b.department, '') LIKE ?";
    params.push(`%${query.department}%`);
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

  const [rows] = await db.execute(
    `
      SELECT
        r.pool_id AS poolId,
        r.ip,
        r.status_code AS statusCode,
        r.status_reason AS statusReason,
        r.is_alive AS isAlive,
        r.mac AS currentMac,
        b.expected_mac AS expectedMac,
        b.device_name AS deviceName,
        b.department,
        b.owner,
        r.last_scan_time AS lastScanTime
      FROM ip_scan_result r
      LEFT JOIN ip_registry b ON b.pool_id = r.pool_id AND b.ip = r.ip AND b.is_bound = 1
      ${whereSql}
      ORDER BY r.pool_id ASC, r.ip ASC
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

async function getOccupancyDetail(poolId, ip) {
  const [rows] = await db.execute(
    `
      SELECT
        r.pool_id AS poolId,
        r.ip,
        r.host_name AS hostName,
        r.os_name AS osName,
        r.open_ports AS openPorts,
        CASE WHEN r.is_alive = 1 THEN 'connected' ELSE 'disconnected' END AS connectionStatus,
        r.status_code AS statusCode,
        r.status_reason AS statusReason,
        r.mac AS currentMac,
        r.last_scan_time AS lastScanTime,
        b.expected_mac AS expectedMac,
        b.device_name AS deviceName,
        b.department,
        b.owner,
        b.purpose
      FROM ip_scan_result r
      LEFT JOIN ip_registry b ON b.pool_id = r.pool_id AND b.ip = r.ip AND b.is_bound = 1
      WHERE r.pool_id = ? AND r.ip = ?
      LIMIT 1
    `,
    [poolId, ip]
  );
  return rows[0] || null;
}

async function listHistory(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 500);
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereSql = "WHERE 1=1";

  if (query.poolId) {
    whereSql += " AND h.pool_id = ?";
    params.push(Number(query.poolId));
  }
  if (query.ip) {
    whereSql += " AND h.ip LIKE ?";
    params.push(`%${query.ip}%`);
  }
  if (query.startTime) {
    whereSql += " AND h.event_time >= ?";
    params.push(query.startTime);
  }
  if (query.endTime) {
    whereSql += " AND h.event_time <= ?";
    params.push(query.endTime);
  }
  if (query.eventType) {
    whereSql += " AND h.event_type = ?";
    params.push(query.eventType);
  }

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM ip_occupancy_history h ${whereSql}`,
    params
  );

  const [rows] = await db.execute(
    `
      SELECT
        h.id,
        h.pool_id AS poolId,
        h.ip,
        h.event_type AS eventType,
        h.old_status_code AS oldStatusCode,
        h.new_status_code AS newStatusCode,
        h.old_mac AS oldMac,
        h.new_mac AS newMac,
        h.old_device_name AS oldDeviceName,
        h.new_device_name AS newDeviceName,
        h.old_owner AS oldOwner,
        h.new_owner AS newOwner,
        h.old_department AS oldDepartment,
        h.new_department AS newDepartment,
        h.source_task_id AS sourceTaskId,
        h.remark,
        h.event_time AS eventTime
      FROM ip_occupancy_history h
      ${whereSql}
      ORDER BY h.event_time DESC, h.id DESC
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

async function getUsageStats(query = {}) {
  const params = [];
  let whereSql = "WHERE 1=1";
  if (query.poolId) {
    whereSql += " AND r.pool_id = ?";
    params.push(Number(query.poolId));
  }

  const [rows] = await db.execute(
    `
      SELECT
        COUNT(*) AS totalIpCount,
        SUM(CASE WHEN r.status_code = 1 THEN 1 ELSE 0 END) AS normalOccupiedCount,
        SUM(CASE WHEN r.status_code = 2 THEN 1 ELSE 0 END) AS abnormalOccupiedCount,
        SUM(CASE WHEN r.status_code = 0 THEN 1 ELSE 0 END) AS freeCount
      FROM ip_scan_result r
      ${whereSql}
    `,
    params
  );
  const x = rows[0] || { totalIpCount: 0, normalOccupiedCount: 0, abnormalOccupiedCount: 0, freeCount: 0 };
  const total = Number(x.totalIpCount || 0);
  const occupied = Number(x.normalOccupiedCount || 0) + Number(x.abnormalOccupiedCount || 0);
  return {
    totalIpCount: total,
    normalOccupiedCount: Number(x.normalOccupiedCount || 0),
    abnormalOccupiedCount: Number(x.abnormalOccupiedCount || 0),
    freeCount: Number(x.freeCount || 0),
    usageRate: total === 0 ? 0 : Number(((occupied / total) * 100).toFixed(2))
  };
}

async function getOccupancyTypeDistribution(query = {}) {
  const params = [];
  let whereSql = "WHERE 1=1";
  if (query.poolId) {
    whereSql += " AND pool_id = ?";
    params.push(Number(query.poolId));
  }
  const [rows] = await db.execute(
    `
      SELECT
        status_reason AS occupancyType,
        COUNT(*) AS count
      FROM ip_scan_result
      ${whereSql}
      GROUP BY status_reason
      ORDER BY count DESC
    `,
    params
  );
  return rows;
}

async function getDepartmentDistribution(query = {}) {
  const params = [];
  let whereSql = "WHERE b.is_bound = 1";
  if (query.poolId) {
    whereSql += " AND b.pool_id = ?";
    params.push(Number(query.poolId));
  }
  const [rows] = await db.execute(
    `
      SELECT
        IFNULL(b.department, '未分配部门') AS department,
        COUNT(*) AS count
      FROM ip_registry b
      ${whereSql}
      GROUP BY IFNULL(b.department, '未分配部门')
      ORDER BY count DESC
    `,
    params
  );
  return rows;
}

async function getOccupancyDurationStats(query = {}) {
  const params = [];
  let whereSql = "WHERE h.event_type IN ('occupy', 'release')";
  if (query.poolId) {
    whereSql += " AND h.pool_id = ?";
    params.push(Number(query.poolId));
  }
  if (query.startTime) {
    whereSql += " AND h.event_time >= ?";
    params.push(query.startTime);
  }
  if (query.endTime) {
    whereSql += " AND h.event_time <= ?";
    params.push(query.endTime);
  }

  const [rows] = await db.execute(
    `
      WITH ordered_events AS (
        SELECT
          h.pool_id,
          h.ip,
          h.event_type,
          h.event_time,
          LEAD(h.event_type) OVER (PARTITION BY h.pool_id, h.ip ORDER BY h.event_time) AS next_event_type,
          LEAD(h.event_time) OVER (PARTITION BY h.pool_id, h.ip ORDER BY h.event_time) AS next_event_time
        FROM ip_occupancy_history h
        ${whereSql}
      )
      SELECT
        SUM(
          CASE
            WHEN event_type = 'occupy' AND next_event_type = 'release'
              THEN TIMESTAMPDIFF(SECOND, event_time, next_event_time)
            WHEN event_type = 'occupy' AND next_event_type IS NULL
              THEN TIMESTAMPDIFF(SECOND, event_time, NOW())
            ELSE 0
          END
        ) AS occupiedDurationSeconds
      FROM ordered_events
    `,
    params
  );

  const seconds = Number(rows[0]?.occupiedDurationSeconds || 0);
  return {
    occupiedDurationSeconds: seconds,
    occupiedDurationHours: Number((seconds / 3600).toFixed(2))
  };
}

async function insertHistoryEvent(event) {
  await db.execute(
    `
      INSERT INTO ip_occupancy_history (
        pool_id, ip, event_type,
        old_status_code, new_status_code,
        old_mac, new_mac,
        old_device_name, new_device_name,
        old_owner, new_owner,
        old_department, new_department,
        source_task_id, remark, event_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      event.poolId,
      event.ip,
      event.eventType,
      event.oldStatusCode ?? null,
      event.newStatusCode ?? null,
      event.oldMac ?? null,
      event.newMac ?? null,
      event.oldDeviceName ?? null,
      event.newDeviceName ?? null,
      event.oldOwner ?? null,
      event.newOwner ?? null,
      event.oldDepartment ?? null,
      event.newDepartment ?? null,
      event.sourceTaskId ?? null,
      event.remark ?? null
    ]
  );
}

module.exports = {
  searchOccupancy,
  getOccupancyDetail,
  listHistory,
  getUsageStats,
  getOccupancyTypeDistribution,
  getDepartmentDistribution,
  getOccupancyDurationStats,
  insertHistoryEvent
};
