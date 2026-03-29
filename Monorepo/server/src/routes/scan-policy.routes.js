const express = require("express");
const scanPolicyController = require("../controllers/scan-policy.controller");

const router = express.Router();

router.get("/", scanPolicyController.listPolicies);
router.put("/:poolId", scanPolicyController.upsertPolicy);
router.delete("/:poolId", scanPolicyController.deletePolicy);
router.post("/:poolId/trigger", scanPolicyController.triggerPolicyNow);

module.exports = router;
