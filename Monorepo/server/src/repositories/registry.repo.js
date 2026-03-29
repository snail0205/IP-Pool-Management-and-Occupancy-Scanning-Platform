const db = require("../config/db");
const occupancyRepo = require("./occupancy.repo");

async function getRegistryByPoolAndIp(poolId, ip) {
  try {
    const [rows] = await db.execute(
      "SELECT id, expected_mac AS expectedMac FROM ip_registry WHERE pool_id = ? AND ip = ? AND is_bound = 1 LIMIT 1",
      [poolId, ip]
    );
    return rows[0] || null;
  } catch (error) {
    // 兼容历史库：若 is_bound 列尚未迁移，降级为不带该条件的查询
    if (error?.code === "ER_BAD_FIELD_ERROR" && String(error?.message || "").includes("is_bound")) {
      const [rows] = await db.execute(
        "SELECT id, expected_mac AS expectedMac FROM ip_registry WHERE pool_id = ? AND ip = ? LIMIT 1",
        [poolId, ip]
      );
      return rows[0] || null;
    }
    throw error;
  }
}

async function createBinding(poolId, payload) {
  const [result] = await db.execute(
    `
      INSERT INTO ip_registry
        (pool_id, ip, expected_mac, device_name, department, owner, purpose, is_bound, bound_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
    `,
    [
      poolId,
      payload.ip,
      payload.expectedMac || null,
      payload.deviceName || null,
      payload.department || null,
      payload.owner || null,
      payload.purpose || null
    ]
  );
  await occupancyRepo.insertHistoryEvent({
    poolId,
    ip: payload.ip,
    eventType: "device_change",
    newMac: payload.expectedMac || null,
    newDeviceName: payload.deviceName || null,
    newOwner: payload.owner || null,
    newDepartment: payload.department || null,
    remark: "binding created"
  });
  return result.insertId;
}

async function updateBinding(poolId, bindingId, payload) {
  const previous = await getBindingById(poolId, bindingId);
  await db.execute(
    `
      UPDATE ip_registry
      SET ip = ?, expected_mac = ?, device_name = ?, department = ?, owner = ?, purpose = ?
      WHERE id = ? AND pool_id = ?
    `,
    [
      payload.ip,
      payload.expectedMac || null,
      payload.deviceName || null,
      payload.department || null,
      payload.owner || null,
      payload.purpose || null,
      bindingId,
      poolId
    ]
  );

  if (!previous) return;

  if ((previous.deviceName || "") !== (payload.deviceName || "")) {
    await occupancyRepo.insertHistoryEvent({
      poolId,
      ip: payload.ip,
      eventType: "device_change",
      oldDeviceName: previous.deviceName,
      newDeviceName: payload.deviceName,
      remark: "device changed by binding update"
    });
  }

  if ((previous.owner || "") !== (payload.owner || "")) {
    await occupancyRepo.insertHistoryEvent({
      poolId,
      ip: payload.ip,
      eventType: "owner_change",
      oldOwner: previous.owner,
      newOwner: payload.owner,
      oldDepartment: previous.department,
      newDepartment: payload.department,
      remark: "owner/department changed by binding update"
    });
  }
}

async function unbind(poolId, bindingId) {
  const previous = await getBindingById(poolId, bindingId);
  await db.execute(
    "UPDATE ip_registry SET is_bound = 0, unbound_at = NOW() WHERE id = ? AND pool_id = ?",
    [bindingId, poolId]
  );
  if (previous) {
    await occupancyRepo.insertHistoryEvent({
      poolId,
      ip: previous.ip,
      eventType: "release",
      oldDeviceName: previous.deviceName,
      oldOwner: previous.owner,
      oldDepartment: previous.department,
      oldMac: previous.expectedMac,
      remark: "binding unbound"
    });
  }
}

async function getBindingById(poolId, bindingId) {
  const [rows] = await db.execute(
    `
      SELECT
        id, pool_id AS poolId, ip, expected_mac AS expectedMac, device_name AS deviceName,
        department, owner, purpose, is_bound AS isBound, bound_at AS boundAt, unbound_at AS unboundAt
      FROM ip_registry
      WHERE id = ? AND pool_id = ?
      LIMIT 1
    `,
    [bindingId, poolId]
  );
  return rows[0] || null;
}

async function listBindings(poolId, query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 200);
  const offset = (page - 1) * pageSize;
  const keyword = (query.keyword || "").trim();
  const onlyBound = query.onlyBound !== "false";

  let whereSql = "WHERE b.pool_id = ?";
  const params = [poolId];

  if (onlyBound) {
    whereSql += " AND b.is_bound = 1";
  }
  if (keyword) {
    whereSql += " AND (b.ip LIKE ? OR IFNULL(b.device_name, '') LIKE ? OR IFNULL(b.expected_mac, '') LIKE ? OR IFNULL(b.department, '') LIKE ? OR IFNULL(b.owner, '') LIKE ?)";
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw, kw);
  }

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total FROM ip_registry b ${whereSql}`,
    params
  );

  const [rows] = await db.execute(
    `
      SELECT
        b.id, b.pool_id AS poolId, b.ip, b.expected_mac AS expectedMac,
        b.device_name AS deviceName, b.department, b.owner, b.purpose,
        b.is_bound AS isBound, b.bound_at AS boundAt, b.unbound_at AS unboundAt,
        r.is_alive AS isAlive, r.mac AS currentMac
      FROM ip_registry b
      LEFT JOIN ip_scan_result r ON r.pool_id = b.pool_id AND r.ip = b.ip
      ${whereSql}
      ORDER BY b.id DESC
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

async function findActiveBindingByIp(poolId, ip, excludeBindingId) {
  const params = [poolId, ip];
  let sql = `
    SELECT id
    FROM ip_registry
    WHERE pool_id = ? AND ip = ? AND is_bound = 1
  `;

  if (excludeBindingId) {
    sql += " AND id <> ?";
    params.push(excludeBindingId);
  }

  sql += " LIMIT 1";
  const [rows] = await db.execute(sql, params);
  return rows[0] || null;
}

async function getScanSnapshotByIp(poolId, ip) {
  const [rows] = await db.execute(
    "SELECT is_alive AS isAlive, mac FROM ip_scan_result WHERE pool_id = ? AND ip = ? LIMIT 1",
    [poolId, ip]
  );
  return rows[0] || null;
}

module.exports = {
  getRegistryByPoolAndIp,
  createBinding,
  updateBinding,
  unbind,
  getBindingById,
  listBindings,
  findActiveBindingByIp,
  getScanSnapshotByIp
};
