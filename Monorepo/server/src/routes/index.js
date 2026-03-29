const express = require("express");
const poolRoutes = require("./pool.routes");
const taskRoutes = require("./task.routes");
const scanPolicyRoutes = require("./scan-policy.routes");
const occupancyRoutes = require("./occupancy.routes");
const systemSettingRoutes = require("./system-setting.routes");
const alertRoutes = require("./alert.routes");
const assetRoutes = require("./asset.routes");
const auditRoutes = require("./audit.routes");
const reportCenterRoutes = require("./report-center.routes");
const mapsRoutes = require("./maps.routes");

const router = express.Router();

router.use("/pools", poolRoutes);
router.use("/scan", taskRoutes);
router.use("/scan/policies", scanPolicyRoutes);
router.use("/occupancy", occupancyRoutes);
router.use("/system", systemSettingRoutes);
router.use("/alerts", alertRoutes);
router.use("/assets", assetRoutes);
router.use("/audit", auditRoutes);
router.use("/reports", reportCenterRoutes);
router.use("/maps", mapsRoutes);



module.exports = router;
