const auditRepo = require("../repositories/audit.repo");
const db = require("../config/db");

function parseJson(text) {
  if (!text) return null;
  try {
    return typeof text === "string" ? JSON.parse(text) : text;
  } catch (error) {
    return null;
  }
}

async function listAuditLogs(query) {
  return auditRepo.listAuditLogs(query);
}

async function rollbackAudit(auditId, user) {
  const audit = await auditRepo.getAuditById(auditId);
  if (!audit) {
    const error = new Error("audit log not found");
    error.status = 404;
    throw error;
  }
  const rollbackPayload = parseJson(audit.rollbackPayload);
  if (!rollbackPayload) {
    const error = new Error("rollback payload not available");
    error.status = 400;
    throw error;
  }

  try {
    if (rollbackPayload.entity === "pools") {
      const x = rollbackPayload.beforeState || {};
      await db.execute(
        `
          UPDATE ip_pool
          SET
            name = ?, cidr = ?, region = ?, network_type = ?, start_ip = ?, end_ip = ?,
            subnet_mask = ?, gateway = ?, dns = ?, lease_hours = ?, enabled = ?
          WHERE id = ?
        `,
        [
          x.name || null,
          x.cidr || null,
          x.region || null,
          x.networkType || "IPv4",
          x.startIp || null,
          x.endIp || null,
          x.subnetMask || null,
          x.gateway || null,
          x.dns || null,
          x.leaseHours || null,
          x.enabled ? 1 : 0,
          rollbackPayload.entityId
        ]
      );
    } else if (rollbackPayload.entity === "pools_bindings") {
      const x = rollbackPayload.beforeState || {};
      await db.execute(
        `
          UPDATE ip_registry
          SET
            ip = ?, expected_mac = ?, device_name = ?, department = ?, owner = ?, purpose = ?, is_bound = ?
          WHERE id = ?
        `,
        [
          x.ip || null,
          x.expectedMac || null,
          x.deviceName || null,
          x.department || null,
          x.owner || null,
          x.purpose || null,
          x.isBound ? 1 : 0,
          rollbackPayload.entityId
        ]
      );
    } else {
      const error = new Error("entity rollback unsupported");
      error.status = 400;
      throw error;
    }

    await auditRepo.markRollbackResult(auditId, user?.id, true);
    return { auditId, rollbackStatus: "success" };
  } catch (error) {
    await auditRepo.markRollbackResult(auditId, user?.id, false);
    throw error;
  }
}

module.exports = {
  listAuditLogs,
  rollbackAudit
};
