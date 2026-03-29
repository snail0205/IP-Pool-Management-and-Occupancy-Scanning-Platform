const auditService = require("../services/audit.service");
const { ok } = require("../utils/response");

async function listAuditLogs(req, res, next) {
  try {
    const data = await auditService.listAuditLogs(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function rollbackAudit(req, res, next) {
  try {
    const auditId = Number(req.params.auditId);
    const data = await auditService.rollbackAudit(auditId, req.user);
    res.json(ok("rollback success", data));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAuditLogs,
  rollbackAudit
};
