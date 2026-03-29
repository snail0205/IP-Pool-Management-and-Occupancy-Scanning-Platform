const scanPolicyService = require("../services/scan-policy.service");
const { ok } = require("../utils/response");

async function listPolicies(req, res, next) {
  try {
    const data = await scanPolicyService.listPolicies();
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function upsertPolicy(req, res, next) {
  try {
    const poolId = Number(req.params.poolId);
    const data = await scanPolicyService.upsertPolicy(poolId, req.body, req.user);
    res.json(ok("policy saved", data));
  } catch (error) {
    next(error);
  }
}

async function deletePolicy(req, res, next) {
  try {
    const poolId = Number(req.params.poolId);
    const data = await scanPolicyService.deletePolicy(poolId);
    res.json(ok("policy deleted", data));
  } catch (error) {
    next(error);
  }
}

async function triggerPolicyNow(req, res, next) {
  try {
    const poolId = Number(req.params.poolId);
    const data = await scanPolicyService.triggerPolicyNow(poolId);
    res.json(ok("policy triggered", data));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPolicies,
  upsertPolicy,
  deletePolicy,
  triggerPolicyNow
};
