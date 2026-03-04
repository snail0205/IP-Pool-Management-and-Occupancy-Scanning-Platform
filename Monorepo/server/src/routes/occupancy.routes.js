const express = require("express");
const occupancyController = require("../controllers/occupancy.controller");

const router = express.Router();

router.get("/", occupancyController.searchOccupancy);
router.get("/detail/:poolId/:ip", occupancyController.getOccupancyDetail);
router.get("/history", occupancyController.getHistory);
router.get("/report", occupancyController.getReport);
router.get("/report/export/excel", occupancyController.exportExcel);
router.get("/report/export/pdf", occupancyController.exportPdf);

module.exports = router;
