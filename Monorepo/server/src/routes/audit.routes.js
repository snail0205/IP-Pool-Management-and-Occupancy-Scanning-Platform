const express = require("express");
const auditController = require("../controllers/audit.controller");

const router = express.Router();

router.get("/logs", auditController.listAuditLogs);
router.post("/logs/:auditId/rollback", auditController.rollbackAudit);

module.exports = router;
