const cron = require("node-cron");
const scanPolicyRepo = require("../repositories/scan-policy.repo");
const taskRepo = require("../repositories/task.repo");
const taskService = require("./task.service");
const alertService = require("./alert.service");

const policyJobs = new Map();

function assert(condition, message, status = 400) {
  if (!condition) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
}

function parseTimeToMinute(text) {
  if (!text) return null;
  const m = String(text).match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function inSilentPeriod(policy) {
  const start = parseTimeToMinute(policy.silentStart);
  const end = parseTimeToMinute(policy.silentEnd);
  if (start === null || end === null) return false;
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

async function waitTaskDone(taskId, timeoutMs = 20 * 60 * 1000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const task = await taskRepo.getTaskById(taskId);
    if (!task) return { status: "failed", errorMsg: "task not found" };
    if (["success", "failed", "cancelled", "paused"].includes(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { status: "failed", errorMsg: "policy wait task timeout" };
}

async function executePolicy(policy) {
  if (inSilentPeriod(policy)) {
    await scanPolicyRepo.markPolicyTriggerResult(policy.policyId, { lastStatus: "silent_skipped", lastTaskId: null });
    return { status: "silent_skipped" };
  }
  const maxRetry = Math.min(Math.max(Number(policy.autoRetryTimes || 0), 0), 5);
  for (let attempt = 0; attempt <= maxRetry; attempt += 1) {
    try {
      const startData = await taskService.startScanTask(policy.poolId, {
        scopeType: "pool",
        frequencyType: "once",
        scanMethod: policy.scanMethod,
        timeoutMs: policy.timeoutMs,
        retryCount: policy.retryCount,
        concurrency: policy.concurrency,
        idempotencyKey: `policy-${policy.policyId}-${Date.now()}-${attempt}`
      });
      const task = await waitTaskDone(startData.taskId);
      if (task.status === "success") {
        await scanPolicyRepo.markPolicyTriggerResult(policy.policyId, {
          lastTaskId: startData.taskId,
          lastStatus: "success"
        });
        return { status: "success", taskId: startData.taskId };
      }
      if (attempt < maxRetry) continue;
      await scanPolicyRepo.markPolicyTriggerResult(policy.policyId, {
        lastTaskId: startData.taskId,
        lastStatus: task.status || "failed"
      });
      await alertService.raiseAlert({
        alertType: "policy_failed",
        level: "critical",
        title: "自动化扫描策略执行失败",
        content: `pool=${policy.poolId}, policy=${policy.policyId}, status=${task.status || "failed"}, attempt=${attempt + 1}`,
        poolId: policy.poolId,
        taskId: startData.taskId,
        channels: String(policy.channels || "in_app,email,wecom").split(",")
      });
      return { status: task.status || "failed", taskId: startData.taskId };
    } catch (error) {
      if (attempt < maxRetry) continue;
      await scanPolicyRepo.markPolicyTriggerResult(policy.policyId, { lastStatus: "dispatch_failed", lastTaskId: null });
      await alertService.raiseAlert({
        alertType: "policy_failed",
        level: "critical",
        title: "自动化扫描策略触发失败",
        content: `pool=${policy.poolId}, policy=${policy.policyId}, error=${error.message}`,
        poolId: policy.poolId,
        channels: String(policy.channels || "in_app,email,wecom").split(",")
      });
      return { status: "dispatch_failed" };
    }
  }
  return { status: "failed" };
}

function registerPolicyJob(policy) {
  if (!cron.validate(policy.cronExpr)) return;
  const job = cron.schedule(policy.cronExpr, async () => {
    await executePolicy(policy);
  });
  policyJobs.set(policy.policyId, job);
}

async function refreshPolicyJobs() {
  policyJobs.forEach((job) => job.stop());
  policyJobs.clear();
  const policies = await scanPolicyRepo.listEnabledPolicies();
  policies.forEach((policy) => registerPolicyJob(policy));
}

async function upsertPolicy(poolId, payload, user) {
  assert(Number.isInteger(poolId) && poolId > 0, "invalid pool id");
  const cronExpr = String(payload.cronExpr || "");
  assert(cron.validate(cronExpr), "invalid cron expression");
  const normalized = {
    poolId,
    enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : true,
    cronExpr,
    scanMethod: String(payload.scanMethod || "icmp_arp"),
    timeoutMs: Number(payload.timeoutMs || 1500),
    retryCount: Number(payload.retryCount || 1),
    concurrency: Number(payload.concurrency || 20),
    autoRetryTimes: Number(payload.autoRetryTimes || 0),
    silentStart: payload.silentStart || null,
    silentEnd: payload.silentEnd || null,
    channels: Array.isArray(payload.channels) ? payload.channels.join(",") : String(payload.channels || "in_app,email,wecom"),
    createdBy: user?.username || "system"
  };
  await scanPolicyRepo.upsertPolicy(normalized);
  await refreshPolicyJobs();
  return scanPolicyRepo.getPolicyByPoolId(poolId);
}

async function listPolicies() {
  return scanPolicyRepo.listPolicies();
}

async function deletePolicy(poolId) {
  await scanPolicyRepo.deletePolicyByPoolId(poolId);
  await refreshPolicyJobs();
  return { poolId };
}

async function triggerPolicyNow(poolId) {
  const policy = await scanPolicyRepo.getPolicyByPoolId(poolId);
  if (!policy) {
    const error = new Error("policy not found");
    error.status = 404;
    throw error;
  }
  return executePolicy(policy);
}

async function initPolicyScheduler() {
  await refreshPolicyJobs();
}

module.exports = {
  upsertPolicy,
  listPolicies,
  deletePolicy,
  triggerPolicyNow,
  initPolicyScheduler
};
