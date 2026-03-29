const settingService = require("../services/system-setting.service");
const { ok } = require("../utils/response");

async function getSettings(req, res, next) {
  try {
    const data = await settingService.getSettings();
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await settingService.updateSettings(req.body || {});
    res.json(ok("settings updated", data));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSettings,
  updateSettings
};

