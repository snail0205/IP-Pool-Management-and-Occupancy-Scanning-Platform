const express = require("express");
const poolRoutes = require("./pool.routes");
const taskRoutes = require("./task.routes");
const occupancyRoutes = require("./occupancy.routes");

const router = express.Router();

router.use("/pools", poolRoutes);
router.use("/scan", taskRoutes);
router.use("/occupancy", occupancyRoutes);



module.exports = router;