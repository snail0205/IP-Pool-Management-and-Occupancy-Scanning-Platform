const settingRepo = require("../repositories/system-setting.repo");

const SETTING_META = {
  scanDefaultConcurrency: {
    type: "number",
    default: 30,
    min: 1,
    max: 128,
    description: "扫描默认并发数"
  },
  scanDefaultTimeoutMs: {
    type: "number",
    default: 1500,
    min: 300,
    max: 30000,
    description: "扫描默认超时(ms)"
  },
  scanDefaultRetryCount: {
    type: "number",
    default: 1,
    min: 0,
    max: 5,
    description: "扫描默认重试次数"
  },
  dashboardAutoRefreshSec: {
    type: "number",
    default: 30,
    min: 5,
    max: 300,
    description: "仪表盘自动刷新间隔(s)"
  },
  taskListAutoRefreshSec: {
    type: "number",
    default: 15,
    min: 5,
    max: 120,
    description: "任务列表自动刷新间隔(s)"
  },
  enableTaskFailureAlert: {
    type: "boolean",
    default: true,
    description: "启用任务失败提醒"
  }
};

function parseByType(type, raw, defaultValue) {
  if (raw === undefined || raw === null) return defaultValue;
  if (type === "boolean") {
    if (typeof raw === "boolean") return raw;
    const t = String(raw).toLowerCase();
    if (["1", "true", "yes", "on"].includes(t)) return true;
    if (["0", "false", "no", "off"].includes(t)) return false;
    return defaultValue;
  }
  if (type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }
  return String(raw);
}

function normalizeIncoming(payload = {}) {
  const normalized = {};
  Object.keys(SETTING_META).forEach((key) => {
    if (payload[key] === undefined) return;
    const rule = SETTING_META[key];
    const value = parseByType(rule.type, payload[key], rule.default);
    if (rule.type === "number") {
      if (value < rule.min || value > rule.max) {
        const err = new Error(`${key} out of range`);
        err.status = 400;
        throw err;
      }
    }
    normalized[key] = value;
  });
  return normalized;
}

async function getSettings() {
  const rows = await settingRepo.listSettings();
  const byKey = new Map(rows.map((r) => [r.settingKey, r.settingValue]));
  const result = {};

  for (const [key, meta] of Object.entries(SETTING_META)) {
    result[key] = parseByType(meta.type, byKey.get(key), meta.default);
  }

  return result;
}

async function updateSettings(payload = {}) {
  const normalized = normalizeIncoming(payload);
  const entries = Object.entries(normalized);
  for (const [key, value] of entries) {
    await settingRepo.upsertSetting({
      settingKey: key,
      settingValue: String(value),
      description: SETTING_META[key].description
    });
  }
  return getSettings();
}

module.exports = {
  getSettings,
  updateSettings
};

