const assetRepo = require("../repositories/asset.repo");
const occupancyRepo = require("../repositories/occupancy.repo");

async function listAssetLedger(query) {
  return assetRepo.listAssetLedger(query);
}

async function traceAsset(poolId, ip, query = {}) {
  const detail = await occupancyRepo.getOccupancyDetail(poolId, ip);
  const history = await occupancyRepo.listHistory({
    poolId,
    ip,
    page: Number(query.page || 1),
    pageSize: Number(query.pageSize || 20)
  });
  return {
    detail,
    history
  };
}

module.exports = {
  listAssetLedger,
  traceAsset
};
