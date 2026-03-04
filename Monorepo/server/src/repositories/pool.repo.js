const db = require("../config/db");

async function createPool({
  name,
  region,
  networkType,
  startIp,
  endIp,
  subnetMask,
  gateway,
  dns,
  leaseHours,
  enabled = true,
  cidr,
  includeNetworkAndBroadcast = false
}) {
  const sql = `
    INSERT INTO ip_pool (
      name, region, network_type, start_ip, end_ip, subnet_mask, gateway, dns, lease_hours,
      enabled, cidr, include_network_broadcast
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const [ret] = await db.execute(sql, [
    name,
    region || null,
    networkType,
    startIp,
    endIp,
    subnetMask || null,
    gateway || null,
    dns || null,
    leaseHours || null,
    enabled ? 1 : 0,
    cidr || null,
    includeNetworkAndBroadcast ? 1 : 0
  ]);

  return {
    id: ret.insertId,
    name,
    region,
    networkType,
    startIp,
    endIp,
    subnetMask,
    gateway,
    dns,
    leaseHours,
    enabled: !!enabled,
    cidr,
    includeNetworkAndBroadcast: !!includeNetworkAndBroadcast
  };
}

async function listPools({ page = 1, pageSize = 10, keyword = "" }) {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10;
  const offset = (safePage - 1) * safePageSize;
  const kw = `%${keyword}%`;

  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM ip_pool
      WHERE name LIKE ?
        OR IFNULL(cidr, '') LIKE ?
        OR IFNULL(start_ip, '') LIKE ?
        OR IFNULL(end_ip, '') LIKE ?
    `,
    [kw, kw, kw, kw]
  );
  const total = countRows[0].total;

  const [rows] = await db.execute(
    `SELECT
      id, name, region, network_type AS networkType,
      start_ip AS startIp, end_ip AS endIp, subnet_mask AS subnetMask,
      gateway, dns, lease_hours AS leaseHours, enabled,
      cidr, include_network_broadcast AS includeNetworkAndBroadcast,
      created_at AS createdAt, updated_at AS updatedAt
     FROM ip_pool
     WHERE name LIKE ?
       OR IFNULL(cidr, '') LIKE ?
       OR IFNULL(start_ip, '') LIKE ?
       OR IFNULL(end_ip, '') LIKE ?
     ORDER BY id DESC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    [kw, kw, kw, kw]
  );

  return { page: safePage, pageSize: safePageSize, total, list: rows };
}

async function getPoolById(poolId) {
  const [rows] = await db.execute(
    `SELECT
      id, name, region, network_type AS networkType,
      start_ip AS startIp, end_ip AS endIp, subnet_mask AS subnetMask,
      gateway, dns, lease_hours AS leaseHours, enabled,
      cidr, include_network_broadcast AS includeNetworkAndBroadcast,
      created_at AS createdAt, updated_at AS updatedAt
     FROM ip_pool WHERE id = ? LIMIT 1`,
    [poolId]
  );
  return rows[0] || null;
}

async function updatePool(poolId, payload) {
  const sql = `
    UPDATE ip_pool
    SET
      name = ?,
      region = ?,
      network_type = ?,
      start_ip = ?,
      end_ip = ?,
      subnet_mask = ?,
      gateway = ?,
      dns = ?,
      lease_hours = ?,
      enabled = ?,
      cidr = ?,
      include_network_broadcast = ?
    WHERE id = ?
  `;

  await db.execute(sql, [
    payload.name,
    payload.region || null,
    payload.networkType,
    payload.startIp,
    payload.endIp,
    payload.subnetMask || null,
    payload.gateway || null,
    payload.dns || null,
    payload.leaseHours || null,
    payload.enabled ? 1 : 0,
    payload.cidr || null,
    payload.includeNetworkAndBroadcast ? 1 : 0,
    poolId
  ]);
}

async function deletePool(poolId) {
  await db.execute("DELETE FROM ip_pool WHERE id = ?", [poolId]);
}

async function setPoolEnabled(poolId, enabled) {
  await db.execute("UPDATE ip_pool SET enabled = ? WHERE id = ?", [enabled ? 1 : 0, poolId]);
}

async function initPoolIpRows(poolId, ips) {
  if (!Array.isArray(ips) || ips.length === 0) return 0;

  const values = ips.map((ip) => [poolId, ip, -1, 0, null]).flat();
  const placeholders = ips.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const sql = `
    INSERT INTO ip_scan_result (pool_id, ip, status_code, is_alive, last_scan_time)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE
      status_code = VALUES(status_code),
      is_alive = VALUES(is_alive),
      last_scan_time = VALUES(last_scan_time)
  `;

  const [result] = await db.execute(sql, values);
  return result.affectedRows;
}

async function getPoolStats(poolId) {
  const [rows] = await db.execute(
    `
      SELECT
        COUNT(*) AS totalCount,
        SUM(CASE WHEN status_code = 1 THEN 1 ELSE 0 END) AS occupiedCount,
        SUM(CASE WHEN status_code = 0 THEN 1 ELSE 0 END) AS freeCount,
        SUM(CASE WHEN status_code = 2 THEN 1 ELSE 0 END) AS abnormalCount
      FROM ip_scan_result
      WHERE pool_id = ?
    `,
    [poolId]
  );
  return rows[0] || {
    totalCount: 0,
    occupiedCount: 0,
    freeCount: 0,
    abnormalCount: 0
  };
}

module.exports = {
  createPool,
  listPools,
  getPoolById,
  updatePool,
  deletePool,
  setPoolEnabled,
  initPoolIpRows,
  getPoolStats
};
