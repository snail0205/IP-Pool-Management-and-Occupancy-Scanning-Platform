const auditRepo = require("../repositories/audit.repo");
const db = require("../config/db");

function getAction(method) {
  const upper = String(method || "").toUpperCase();
  if (upper === "POST") return "create";
  if (upper === "PUT" || upper === "PATCH") return "update";
  if (upper === "DELETE") return "delete";
  return "read";
}

function extractEntityInfo(path) {
  const clean = String(path || "").split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  let entity = null;
  if (parts[0] === "api") {
    entity = parts[1] || null;
  }
  let entityId = null;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const num = Number(parts[i]);
    if (Number.isInteger(num) && num > 0) {
      entityId = num;
      break;
    }
  }
  return { entity, entityId };
}

function safeStringify(data) {
  if (!data) return null;
  try {
    const text = JSON.stringify(data);
    return text.length > 4000 ? text.slice(0, 4000) : text;
  } catch (error) {
    return null;
  }
}

function buildDiff(beforeState, afterState) {
  if (!beforeState && !afterState) return null;
  const allKeys = new Set([
    ...Object.keys(beforeState || {}),
    ...Object.keys(afterState || {})
  ]);
  const diff = {};
  allKeys.forEach((key) => {
    const beforeValue = beforeState ? beforeState[key] : undefined;
    const afterValue = afterState ? afterState[key] : undefined;
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return;
    diff[key] = { before: beforeValue, after: afterValue };
  });
  return Object.keys(diff).length ? diff : null;
}

async function fetchPoolSnapshot(poolId) {
  if (!poolId) return null;
  const [rows] = await db.execute(
    `
      SELECT
        id, name, cidr, region, network_type AS networkType,
        start_ip AS startIp, end_ip AS endIp, subnet_mask AS subnetMask,
        gateway, dns, lease_hours AS leaseHours, enabled
      FROM ip_pool
      WHERE id = ?
      LIMIT 1
    `,
    [poolId]
  );
  return rows[0] || null;
}

async function fetchBindingSnapshot(bindingId) {
  if (!bindingId) return null;
  const [rows] = await db.execute(
    `
      SELECT
        id, pool_id AS poolId, ip, expected_mac AS expectedMac,
        device_name AS deviceName, department, owner, purpose, is_bound AS isBound
      FROM ip_registry
      WHERE id = ?
      LIMIT 1
    `,
    [bindingId]
  );
  return rows[0] || null;
}

function parsePathInfo(path) {
  const clean = String(path || "").split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  const getNumberAt = (idx) => {
    const n = Number(parts[idx]);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  return {
    clean,
    parts,
    poolId: getNumberAt(parts.indexOf("pools") + 1),
    bindingId: getNumberAt(parts.indexOf("bindings") + 1)
  };
}

async function fetchBeforeState(entity, entityId, pathInfo) {
  if (entity === "pools") return fetchPoolSnapshot(entityId || pathInfo.poolId);
  if (entity === "occupancy") return null;
  if (entity === "scan") return null;
  if (pathInfo.clean.includes("/bindings/")) return fetchBindingSnapshot(pathInfo.bindingId || entityId);
  return null;
}

async function fetchAfterState(entity, entityId, pathInfo) {
  if (entity === "pools") return fetchPoolSnapshot(entityId || pathInfo.poolId);
  if (pathInfo.clean.includes("/bindings/")) return fetchBindingSnapshot(pathInfo.bindingId || entityId);
  return null;
}

function buildRollbackPayload(entity, entityId, beforeState) {
  if (!beforeState) return null;
  if (entity === "pools") {
    return {
      entity: "pools",
      entityId: entityId || beforeState.id,
      beforeState
    };
  }
  if (entity === "pools_bindings") {
    return {
      entity: "pools_bindings",
      entityId: entityId || beforeState.id,
      beforeState
    };
  }
  return null;
}

async function auditMiddleware(req, res, next) {
  const method = String(req.method || "").toUpperCase();
  const path = req.originalUrl || "";
  if (!req.user || ["GET", "HEAD", "OPTIONS"].includes(method) || path.startsWith("/api/auth")) {
    return next();
  }
  const pathInfo = parsePathInfo(path);
  const parsed = extractEntityInfo(path);
  const entity = pathInfo.clean.includes("/bindings/") ? "pools_bindings" : parsed.entity;
  const entityId = pathInfo.clean.includes("/bindings/") ? (pathInfo.bindingId || parsed.entityId) : parsed.entityId;
  const payload = safeStringify(req.body);
  const queryParams = safeStringify(req.query);
  const ip = req.ip;
  const userAgent = req.headers["user-agent"] || "";
  const beforeState = await fetchBeforeState(entity, entityId, pathInfo).catch(() => null);

  res.on("finish", async () => {
    const afterState = await fetchAfterState(entity, entityId, pathInfo).catch(() => null);
    const diff = buildDiff(beforeState, afterState);
    const rollbackPayload = buildRollbackPayload(entity, entityId, beforeState);
    const record = {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: getAction(method),
      method,
      path,
      entity,
      entityId,
      requestBody: payload,
      queryParams,
      ip,
      userAgent,
      statusCode: res.statusCode,
      beforeJson: safeStringify(beforeState),
      afterJson: safeStringify(afterState),
      diffJson: safeStringify(diff),
      rollbackPayload: safeStringify(rollbackPayload),
      rollbackStatus: rollbackPayload ? "none" : null
    };
    setImmediate(() => {
      auditRepo.insertAuditLog(record).catch(() => {});
    });
  });
  next();
}

module.exports = auditMiddleware;
