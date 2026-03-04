const express = require("express");
const poolController = require("../controllers/pool.controller");

const router = express.Router();

router.post("/", poolController.createPool);
router.get("/", poolController.listPools);
router.get("/:id", poolController.getPoolDetail);
router.put("/:id", poolController.updatePool);
router.delete("/:id", poolController.deletePool);
router.patch("/:id/status", poolController.setPoolStatus);
router.get("/:id/stats", poolController.getPoolStats);
router.get("/:id/ips", poolController.listPoolIps);
router.post("/:id/bindings", poolController.createBinding);
router.get("/:id/bindings", poolController.listBindings);
router.put("/:id/bindings/:bindingId", poolController.updateBinding);
router.post("/:id/bindings/:bindingId/unbind", poolController.unbind);

module.exports = router;