const db = require("../config/db");

async function listAssetLedger(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);
  const offset = (page - 1) * pageSize;
  const params = [];
  let whereSql = "WHERE 1=1";

  if (query.poolId) {
    whereSql += " AND r.pool_id = ?";
    params.push(Number(query.poolId));
  }
  if (query.keyword) {
    whereSql += " AND (r.ip LIKE ? OR IFNULL(r.device_name, '') LIKE ? OR IFNULL(r.owner, '') LIKE ? OR IFNULL(r.department, '') LIKE ?)";
    const kw = `%${String(query.keyword)}%`;
    params.push(kw, kw, kw, kw);
  }

  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) AS total
      FROM ip_registry r
      ${whereSql}
    `,
    params
  );

  const [rows] = await db.execute(
    `
      SELECT
        r.id AS ledgerId,
        r.pool_id AS poolId,
        p.name AS poolName,
        r.ip,
        r.expected_mac AS expectedMac,
        r.device_name AS deviceName,
        r.department,
        r.owner,
        r.purpose,
        r.is_bound AS isBound,
        s.status_code AS statusCode,
        s.status_reason AS statusReason,
        s.mac AS currentMac,
        s.last_scan_time AS lastScanTime,
        r.bound_at AS boundAt,
        r.unbound_at AS unboundAt,
        r.updated_at AS updatedAt
      FROM ip_registry r
      LEFT JOIN ip_pool p ON p.id = r.pool_id
      LEFT JOIN ip_scan_result s ON s.pool_id = r.pool_id AND s.ip = r.ip
      ${whereSql}
      ORDER BY r.updated_at DESC, r.id DESC
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

module.exports = {
  listAssetLedger
};
