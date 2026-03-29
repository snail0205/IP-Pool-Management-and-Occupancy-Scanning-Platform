const alertService = require("../services/alert.service");
const { ok } = require("../utils/response");

async function listAlerts(req, res, next) {
  try {
    const data = await alertService.listAlerts(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function resolveAlert(req, res, next) {
  try {
    const alertId = Number(req.params.alertId);
    const data = await alertService.resolveAlert(alertId, req.user);
    res.json(ok("alert resolved", data));
  } catch (error) {
    next(error);
  }
}

async function reopenAlert(req, res, next) {
  try {
    const alertId = Number(req.params.alertId);
    const data = await alertService.reopenAlert(alertId);
    res.json(ok("alert reopened", data));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAlerts,
  resolveAlert,
  reopenAlert
};
