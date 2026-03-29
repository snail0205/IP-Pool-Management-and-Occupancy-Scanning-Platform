const express = require("express");
const assetController = require("../controllers/asset.controller");

const router = express.Router();

router.get("/ledger", assetController.listAssetLedger);
router.get("/trace/:poolId/:ip", assetController.traceAsset);

module.exports = router;
