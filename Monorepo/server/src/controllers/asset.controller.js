const assetService = require("../services/asset.service");
const { ok } = require("../utils/response");

async function listAssetLedger(req, res, next) {
  try {
    const data = await assetService.listAssetLedger(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function traceAsset(req, res, next) {
  try {
    const poolId = Number(req.params.poolId);
    const ip = decodeURIComponent(req.params.ip);
    const data = await assetService.traceAsset(poolId, ip, req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAssetLedger,
  traceAsset
};
