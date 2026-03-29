const express = require("express");
const alertController = require("../controllers/alert.controller");

const router = express.Router();

router.get("/", alertController.listAlerts);
router.post("/:alertId/resolve", alertController.resolveAlert);
router.post("/:alertId/reopen", alertController.reopenAlert);

module.exports = router;
