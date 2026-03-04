const poolService = require("../services/pool.service");
const { ok } = require("../utils/response");

async function createPool(req, res, next){
    try{
        const data = await poolService.createPool(req.body);
        res.status(201).json(ok("pool created", data));
    } catch(err){
        next(err);
    }
}

async function listPools(req, res, next){
    try{
        const data = await poolService.listPools(req.query);
        res.json(ok("ok", data));
    }catch (err){
        next(err);
    }
}

async function listPoolIps(req, res, next){
    try{
        const poolId = Number(req.params.id);
        const data = await poolService.listPoolIps(poolId, req.query);
        res.json(ok("ok", data));
    }catch (err){
        next(err);
    }
}

async function getPoolDetail(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const data = await poolService.getPoolDetail(poolId);
    res.json(ok("ok", data));
  } catch (err) {
    next(err);
  }
}

async function updatePool(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const data = await poolService.updatePool(poolId, req.body);
    res.json(ok("pool updated", data));
  } catch (err) {
    next(err);
  }
}

async function deletePool(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const data = await poolService.deletePool(poolId);
    res.json(ok("pool deleted", data));
  } catch (err) {
    next(err);
  }
}

async function setPoolStatus(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const data = await poolService.setPoolStatus(poolId, req.body.enabled);
    res.json(ok("pool status updated", data));
  } catch (err) {
    next(err);
  }
}

async function getPoolStats(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const data = await poolService.getPoolStats(poolId);
    res.json(ok("ok", data));
  } catch (err) {
    next(err);
  }
}

async function createBinding(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const data = await poolService.createBinding(poolId, req.body);
    res.status(201).json(ok("binding created", data));
  } catch (err) {
    next(err);
  }
}

async function listBindings(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const data = await poolService.listBindings(poolId, req.query);
    res.json(ok("ok", data));
  } catch (err) {
    next(err);
  }
}

async function updateBinding(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const bindingId = Number(req.params.bindingId);
    const data = await poolService.updateBinding(poolId, bindingId, req.body);
    res.json(ok("binding updated", data));
  } catch (err) {
    next(err);
  }
}

async function unbind(req, res, next) {
  try {
    const poolId = Number(req.params.id);
    const bindingId = Number(req.params.bindingId);
    const data = await poolService.unbind(poolId, bindingId);
    res.json(ok("binding unbound", data));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPool,
  listPools,
  getPoolDetail,
  updatePool,
  deletePool,
  setPoolStatus,
  getPoolStats,
  listPoolIps,
  createBinding,
  listBindings,
  updateBinding,
  unbind
};