const express = require("express");
const reportCenterController = require("../controllers/report-center.controller");

const router = express.Router();

router.get("/summary", reportCenterController.getSummary);
router.get("/export/excel", reportCenterController.exportExcel);
router.get("/export/pdf", reportCenterController.exportPdf);
router.post("/send", reportCenterController.sendReport);
router.get("/deliveries", reportCenterController.listDeliveries);

module.exports = router;
