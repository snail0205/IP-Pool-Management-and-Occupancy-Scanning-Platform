const alertRepo = require("../repositories/alert.repo");

function normalizeChannels(channels) {
  if (Array.isArray(channels)) return channels;
  if (!channels) return ["in_app"];
  return String(channels)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function mockNotify(channels, payload) {
  const result = {};
  channels.forEach((channel) => {
    if (channel === "in_app") {
      result[channel] = { status: "sent", detail: "stored as in-app alert" };
      return;
    }
    if (channel === "email") {
      result[channel] = { status: "queued", detail: "email adapter not configured, queued only" };
      return;
    }
    if (channel === "wecom") {
      result[channel] = { status: "queued", detail: "wecom adapter not configured, queued only" };
      return;
    }
    result[channel] = { status: "ignored", detail: "unknown channel" };
  });
  result.meta = {
    title: payload.title,
    createdAt: new Date().toISOString()
  };
  return result;
}

async function raiseAlert(payload) {
  const channels = normalizeChannels(payload.channels);
  const notifyResult = mockNotify(channels, payload);
  const dedupKey =
    payload.dedupKey ||
    `${payload.alertType || "generic"}:${payload.poolId || 0}:${payload.ip || ""}:${payload.taskId || 0}`;
  const alertId = await alertRepo.upsertOpenAlert({
    alertType: payload.alertType || "generic",
    level: payload.level || "warning",
    title: payload.title || "系统告警",
    content: payload.content || "",
    poolId: payload.poolId || null,
    ip: payload.ip || null,
    taskId: payload.taskId || null,
    channels: channels.join(","),
    notifyResultJson: JSON.stringify(notifyResult),
    dedupKey
  });
  return { alertId, notifyResult };
}

async function raiseOccupancyAlert({ poolId, ip, statusReason }) {
  if (!["illegal_occupancy", "inconsistent_mac"].includes(statusReason)) return null;
  const alertType = statusReason === "illegal_occupancy" ? "illegal_occupancy" : "conflict_occupancy";
  const title = statusReason === "illegal_occupancy" ? "检测到非法占用" : "检测到冲突占用";
  return raiseAlert({
    alertType,
    level: "warning",
    title,
    content: `pool=${poolId}, ip=${ip}, reason=${statusReason}`,
    poolId,
    ip,
    channels: ["in_app", "email", "wecom"],
    dedupKey: `${alertType}:${poolId}:${ip}`
  });
}

async function raiseTaskFailedAlert({ taskId, poolId, errorMsg }) {
  return raiseAlert({
    alertType: "task_failed",
    level: "critical",
    title: "扫描任务失败",
    content: `task=${taskId}, pool=${poolId}, error=${errorMsg || "unknown"}`,
    poolId,
    taskId,
    channels: ["in_app", "email", "wecom"],
    dedupKey: `task_failed:${taskId}`
  });
}

async function listAlerts(query) {
  return alertRepo.listAlerts(query);
}

async function resolveAlert(alertId, user) {
  await alertRepo.resolveAlert(alertId, user?.id);
  return { alertId, status: "resolved" };
}

async function reopenAlert(alertId) {
  await alertRepo.reopenAlert(alertId);
  return { alertId, status: "open" };
}

module.exports = {
  raiseAlert,
  raiseOccupancyAlert,
  raiseTaskFailedAlert,
  listAlerts,
  resolveAlert,
  reopenAlert
};
