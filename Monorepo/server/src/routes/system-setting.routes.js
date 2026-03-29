const express = require("express");
const controller = require("../controllers/system-setting.controller");

const router = express.Router();

router.get("/settings", controller.getSettings);
router.put("/settings", controller.updateSettings);

module.exports = router;

