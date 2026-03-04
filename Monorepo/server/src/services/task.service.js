const cron = require("node-cron");
const poolRepo = require("../repositories/pool.repo");
const taskRepo = require("../repositories/task.repo");
const scanService = require("./scan.service");
const { getIpVersion, parseIpToBigInt } = require("../utils/ip-utils");

const MAX_TASK_IPS = 65536;

const poolExecutionLocks = new Set();
const taskQueue = [];
let queueRunning = false;
const scheduledJobs = new Map();

function assert(condition, message, status = 400) {
  if (!condition) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

function normalizeTaskPayload(payload) {
  const scopeType = String(payload.scopeType || "pool").toLowerCase();
  const scanMethod = String(payload.scanMethod || "icmp_arp").toLowerCase();
  const frequencyType = String(payload.frequencyType || "once").toLowerCase();
  const timeoutMs = Number(payload.timeoutMs || 1500);
  const retryCount = Number(payload.retryCount || 1);
  const concurrency = Number(payload.concurrency || 20);
  const idempotencyKey = payload.idempotencyKey ? String(payload.idempotencyKey) : null;
  const scheduleCron = payload.scheduleCron ? String(payload.scheduleCron) : null;

  assert(["pool", "custom_range", "custom_list"].includes(scopeType), "invalid scopeType");
  assert(["icmp_arp", "tcp", "udp"].includes(scanMethod), "invalid scanMethod");
  assert(["once", "hourly", "daily", "weekly"].includes(frequencyType), "invalid frequencyType");
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 300 && timeoutMs <= 30000, "timeoutMs out of range");
  assert(Number.isInteger(retryCount) && retryCount >= 0 && retryCount <= 5, "retryCount out of range");
  assert(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 128, "concurrency out of range");

  const paramsJson = {
    concurrency,
    timeoutMs,
    retryCount
  };

  if (scopeType === "custom_range") {
    const startIp = payload?.range?.startIp;
    const endIp = payload?.range?.endIp;
    assert(startIp && endIp, "custom_range requires range.startIp and range.endIp");
    const version = getIpVersion(startIp);
    assert(version > 0 && version === getIpVersion(endIp), "invalid custom_range ip");
    const start = parseIpToBigInt(startIp, version);
    const end = parseIpToBigInt(endIp, version);
    assert(start !== null && end !== null && end >= start, "invalid custom_range ip");
    assert(end - start + 1n <= BigInt(MAX_TASK_IPS), "custom_range too large");
    paramsJson.range = { startIp, endIp };
  }
  if (scopeType === "custom_list") {
    assert(Array.isArray(payload.ips) && payload.ips.length > 0, "custom_list requires ips");
    payload.ips.forEach((ip) => assert(getIpVersion(ip) > 0, `invalid ip in custom_list: ${ip}`));
    paramsJson.ips = payload.ips;
  }

  return {
    scopeType,
    scanMethod,
    frequencyType,
    timeoutMs,
    retryCount,
    concurrency,
    idempotencyKey,
    scheduleCron,
    paramsJson
  };
}

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (taskQueue.length > 0) {
      const taskId = taskQueue.shift();
      const task = await taskRepo.getTaskById(taskId);
      if (!task || task.status === "cancelled" || task.status === "success" || task.status === "failed") {
        continue;
      }

      const lockKey = String(task.poolId);
      if (poolExecutionLocks.has(lockKey)) {
        taskQueue.push(taskId);
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }

      poolExecutionLocks.add(lockKey);
      try {
        await scanService.executeScanTask(taskId);
      } catch (error) {
        await taskRepo.finishTaskFailed(taskId, error.message);
        await taskRepo.addTaskLog(taskId, "error", "task_failed", "task failed while running", {
          reason: error.message
        });
        scanService.emitTaskEvent("scan_failed", {
          taskId,
          poolId: task.poolId,
          status: "failed",
          error: error.message
        });
      } finally {
        poolExecutionLocks.delete(lockKey);
      }
    }
  } finally {
    queueRunning = false;
  }
}

function enqueueTask(taskId) {
  if (!taskQueue.includes(taskId)) {
    taskQueue.push(taskId);
  }
  setImmediate(processQueue);
}

async function createScanTask(poolId, payload = {}) {
  if (!Number.isInteger(poolId) || poolId <= 0) {
    const err = new Error("invalid pool id");
    err.status = 400;
    throw err;
  }

  const pool = await poolRepo.getPoolById(poolId);
  if (!pool) {
    const err = new Error("pool not found");
    err.status = 404;
    throw err;
  }

  const normalized = normalizeTaskPayload(payload);
  const existingByIdempotency = await taskRepo.getTaskByIdempotency(poolId, normalized.idempotencyKey);
  if (existingByIdempotency) {
    return {
      taskId: existingByIdempotency.taskId,
      poolId,
      status: existingByIdempotency.status,
      idempotent: true
    };
  }

  const taskId = await taskRepo.createTask({
    poolId,
    paramsJson: normalized.paramsJson,
    createdBy: "system",
    scopeType: normalized.scopeType,
    scanMethod: normalized.scanMethod,
    frequencyType: normalized.frequencyType,
    timeoutMs: normalized.timeoutMs,
    retryCount: normalized.retryCount,
    idempotencyKey: normalized.idempotencyKey,
    scheduleCron: normalized.scheduleCron
  });

  await taskRepo.addTaskLog(taskId, "info", "task_created", "task created", {
    poolId,
    ...normalized
  });
  const createdTask = await taskRepo.getTaskById(taskId);
  if (createdTask) {
    await scheduleTask(createdTask);
  }

  return {
    taskId,
    poolId,
    status: "pending"
  };
}

async function getTaskProgress(taskId) {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    const err = new Error("invalid task id");
    err.status = 400;
    throw err;
  }

  const task = await taskRepo.getTaskById(taskId);
  if (!task) {
    const err = new Error("task not found");
    err.status = 404;
    throw err;
  }
  return task;
}

async function triggerTask(taskId) {
  const task = await getTaskProgress(taskId);
  assert(!["running", "success"].includes(task.status), "task already running or finished", 409);

  const runningTask = await taskRepo.getRunningTaskByPoolId(task.poolId);
  if (runningTask && runningTask.taskId !== taskId) {
    const err = new Error("another running task exists in same pool");
    err.status = 409;
    throw err;
  }

  await taskRepo.markTaskRunning(taskId);
  await taskRepo.addTaskLog(taskId, "info", "task_triggered", "task manually triggered", { taskId });
  enqueueTask(taskId);
  return { taskId, status: "running" };
}

async function pauseTask(taskId) {
  const task = await getTaskProgress(taskId);
  assert(task.status === "running", "only running task can be paused", 409);
  await taskRepo.markPauseRequested(taskId);
  await taskRepo.addTaskLog(taskId, "info", "pause_requested", "pause requested", { taskId });
  return { taskId, status: "pause_requested" };
}

async function terminateTask(taskId) {
  const task = await getTaskProgress(taskId);
  assert(["running", "paused", "pending"].includes(task.status), "task can not be terminated", 409);
  await taskRepo.markStopRequested(taskId);
  await taskRepo.addTaskLog(taskId, "warn", "terminate_requested", "terminate requested", { taskId });
  if (task.status === "pending" || task.status === "paused") {
    await taskRepo.finishTaskCancelled(taskId, "terminated before run");
    scanService.emitTaskEvent("scan_cancelled", {
      taskId,
      poolId: task.poolId,
      status: "cancelled"
    });
  }
  return { taskId, status: "stop_requested" };
}

async function listTasks(query) {
  return taskRepo.listTasks(query);
}

async function listTaskLogs(taskId, query) {
  await getTaskProgress(taskId);
  return taskRepo.listTaskLogs(taskId, query);
}

async function exportTaskLogsCsv(taskId) {
  const logs = await taskRepo.listTaskLogs(taskId, { page: 1, pageSize: 10000 });
  const header = ["id", "taskId", "level", "eventType", "message", "createdAt"];
  const lines = [header.join(",")];
  logs.list.forEach((item) => {
    const row = [
      item.id,
      item.taskId,
      item.level,
      item.eventType,
      `"${String(item.message || "").replace(/"/g, "\"\"")}"`,
      item.createdAt
    ];
    lines.push(row.join(","));
  });
  return lines.join("\n");
}

async function startScanTask(poolId, payload = {}) {
  const created = await createScanTask(poolId, {
    ...payload,
    scopeType: "pool",
    frequencyType: "once"
  });
  return triggerTask(created.taskId);
}

function getCronExpression(task) {
  if (task.scheduleCron) return task.scheduleCron;
  if (task.frequencyType === "hourly") return "0 * * * *";
  if (task.frequencyType === "daily") return "0 0 * * *";
  if (task.frequencyType === "weekly") return "0 0 * * 1";
  return null;
}

async function scheduleTask(task) {
  const expression = getCronExpression(task);
  if (!expression) return;
  if (!cron.validate(expression)) {
    await taskRepo.addTaskLog(task.taskId, "warn", "schedule_invalid", "invalid cron expression", {
      scheduleCron: task.scheduleCron,
      frequencyType: task.frequencyType
    });
    return;
  }
  if (scheduledJobs.has(task.taskId)) return;
  const job = cron.schedule(expression, async () => {
    try {
      const runningTask = await taskRepo.getRunningTaskByPoolId(task.poolId);
      if (runningTask) return;
      const paramsJson = typeof task.paramsJson === "string" ? JSON.parse(task.paramsJson) : task.paramsJson || {};
      const newTaskId = await taskRepo.createTask({
        poolId: task.poolId,
        paramsJson,
        createdBy: "scheduler",
        scopeType: task.scopeType,
        scanMethod: task.scanMethod,
        frequencyType: task.frequencyType,
        timeoutMs: task.timeoutMs,
        retryCount: task.retryCount,
        idempotencyKey: null,
        scheduleCron: task.scheduleCron
      });
      await taskRepo.addTaskLog(newTaskId, "info", "task_created", "task created by scheduler", {
        sourceTaskId: task.taskId
      });
      await triggerTask(newTaskId);
    } catch (error) {
      await taskRepo.addTaskLog(task.taskId, "error", "schedule_trigger_failed", "schedule trigger failed", {
        reason: error.message
      });
    }
  });
  scheduledJobs.set(task.taskId, job);
}

async function initScheduler() {
  scheduledJobs.forEach((job) => job.stop());
  scheduledJobs.clear();
  const tasks = await taskRepo.listScheduledTasks();
  for (const task of tasks) {
    await scheduleTask(task);
  }
}

module.exports = {
  createScanTask,
  startScanTask,
  getTaskProgress,
  triggerTask,
  pauseTask,
  terminateTask,
  listTasks,
  listTaskLogs,
  exportTaskLogsCsv,
  initScheduler
};
