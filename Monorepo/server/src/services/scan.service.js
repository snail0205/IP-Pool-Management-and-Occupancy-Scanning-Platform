const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const poolRepo = require("../repositories/pool.repo");
const resultRepo = require("../repositories/result.repo");
const registryRepo = require("../repositories/registry.repo");
const taskRepo = require("../repositories/task.repo");
const { getHostIpsFromCidr } = require("../utils/cidr");
const { getIpVersion, generateRangeIps } = require("../utils/ip-utils");

const execAsync = promisify(exec);
let socketServer = null;

function setSocketServer(io) {
  socketServer = io;
}

function emitTaskEvent(event, payload) {
  if (!socketServer) return;
  if (payload?.taskId) {
    socketServer.to(`task:${payload.taskId}`).emit(event, payload);
  }
  if (payload?.poolId) {
    socketServer.to(`pool:${payload.poolId}`).emit(event, payload);
  }
}

function parseTtlFromPingOutput(stdout = "") {
  const match = stdout.match(/ttl[=\s:](\d+)/i);
  return match ? Number(match[1]) : null;
}

async function pingIp(ip, timeoutMs) {
  const timeout = Math.max(Number(timeoutMs || 1000), 300);
  const command = process.platform === "win32" ? `ping -n 1 -w ${timeout} ${ip}` : `ping -c 1 -W 1 ${ip}`;

  try {
    const { stdout } = await execAsync(command);
    return {
      alive: true,
      ttl: parseTtlFromPingOutput(stdout)
    };
  } catch (error) {
    const stdout = error?.stdout || "";
    if (/ttl[=\s:]\d+/i.test(stdout)) {
      return {
        alive: true,
        ttl: parseTtlFromPingOutput(stdout)
      };
    }
    return {
      alive: false,
      ttl: null
    };
  }
}

async function pingIpWithRetry(ip, timeoutMs, retryCount) {
  const retries = Math.max(Number(retryCount || 0), 0);
  let last = { alive: false, ttl: null };
  for (let i = 0; i <= retries; i += 1) {
    last = await pingIp(ip, timeoutMs);
    if (last.alive) return last;
  }
  return last;
}

function buildStatus(alive, registry, currentMac) {
  if (!alive) {
    return { statusCode: 0, statusReason: "offline", occupancyType: "free" };
  }
  if (!registry) {
    return { statusCode: 2, statusReason: "illegal_occupancy", occupancyType: "illegal" };
  }

  const expectedMac = registry.expectedMac ? String(registry.expectedMac).toUpperCase() : "";
  const current = currentMac ? String(currentMac).toUpperCase() : "";
  if (expectedMac && current && expectedMac !== current) {
    return { statusCode: 2, statusReason: "inconsistent_mac", occupancyType: "inconsistent" };
  }
  return { statusCode: 1, statusReason: "registry_matched", occupancyType: "normal" };
}

async function processSingleIp({ taskId, poolId, ip, pingTimeoutMs, retryCount, scanMethod }) {
  const pingResult = await pingIpWithRetry(ip, pingTimeoutMs, retryCount);
  const registry = await registryRepo.getRegistryByPoolAndIp(poolId, ip);
  const status = buildStatus(pingResult.alive, registry, null);

  // Keep method metadata for audit; current MVP always probes by ICMP ping.
  if (scanMethod !== "icmp_arp") {
    await taskRepo.addTaskLog(taskId, "warn", "scan_method_fallback", "scanMethod fallback to icmp_arp in current implementation", {
      requestedMethod: scanMethod
    });
  }

  await resultRepo.upsertScanResult({
    poolId,
    ip,
    isAlive: pingResult.alive,
    ttl: pingResult.ttl,
    statusCode: status.statusCode,
    statusReason: status.statusReason,
    taskId
  });

  emitTaskEvent("scan:ip-updated", {
    taskId,
    poolId,
    ip,
    status: status.statusCode,
    isAlive: pingResult.alive,
    ttl: pingResult.ttl,
    reason: status.statusReason,
    lastScanTime: new Date().toISOString()
  });

  return {
    statusCode: status.statusCode,
    statusReason: status.statusReason,
    occupancyType: status.occupancyType,
    isAlive: pingResult.alive,
    ttl: pingResult.ttl
  };
}

function resolveScopeIps(task, pool, params) {
  const scopeType = String(task.scopeType || "pool").toLowerCase();

  if (scopeType === "custom_range") {
    const startIp = params?.range?.startIp;
    const endIp = params?.range?.endIp;
    const version = getIpVersion(startIp);
    return generateRangeIps(startIp, endIp, version);
  }

  if (scopeType === "custom_list") {
    return Array.isArray(params?.ips) ? params.ips : [];
  }

  // default: pool range/cidr
  if (pool.cidr) {
    return getHostIpsFromCidr(pool.cidr, Boolean(pool.includeNetworkAndBroadcast));
  }
  if (pool.startIp && pool.endIp) {
    const version = getIpVersion(pool.startIp);
    return generateRangeIps(pool.startIp, pool.endIp, version);
  }
  return [];
}

async function executeScanTask(taskId) {
  const task = await taskRepo.getTaskById(taskId);
  if (!task) {
    throw new Error("task not found");
  }

  const pool = await poolRepo.getPoolById(task.poolId);
  if (!pool) {
    throw new Error("pool not found");
  }

  const params = typeof task.paramsJson === "string" ? JSON.parse(task.paramsJson) : task.paramsJson || {};
  const concurrency = Math.max(Number(params.concurrency || 20), 1);
  const pingTimeoutMs = Number(task.timeoutMs || params.timeoutMs || params.pingTimeoutMs || 1500);
  const retryCount = Number(task.retryCount || params.retryCount || 1);
  const scanMethod = String(task.scanMethod || "icmp_arp").toLowerCase();

  let ips = resolveScopeIps(task, pool, params);
  if (!ips.length) {
    ips = await resultRepo.listIpsByPoolId(task.poolId);
  }
  if (!ips.length) {
    throw new Error("no ip targets resolved");
  }

  await taskRepo.markTaskRunning(taskId);
  await taskRepo.addTaskLog(taskId, "info", "task_started", "scan task started", {
    scopeType: task.scopeType,
    scanMethod,
    frequencyType: task.frequencyType,
    timeoutMs: pingTimeoutMs,
    retryCount,
    targetCount: ips.length
  });
  emitTaskEvent("scan_started", {
    taskId,
    poolId: task.poolId,
    status: "running",
    progress: 0,
    totalCount: ips.length,
    processedCount: 0,
    onlineCount: 0,
    conflictCount: 0
  });

  if (task.scopeType !== "custom_list" && task.scopeType !== "custom_range") {
    await poolRepo.initPoolIpRows(task.poolId, ips);
  }

  let processedCount = 0;
  let onlineCount = 0;
  let conflictCount = 0;
  const totalCount = ips.length;
  const chunkSize = concurrency;

  for (let i = 0; i < ips.length; i += chunkSize) {
    const control = await taskRepo.getTaskControlFlag(taskId);
    if (control.controlFlag === "stop_requested") {
      await taskRepo.finishTaskCancelled(taskId, "stopped by user");
      await taskRepo.addTaskLog(taskId, "warn", "task_cancelled", "task terminated by user", {
        processedCount,
        totalCount
      });
      emitTaskEvent("scan_cancelled", {
        taskId,
        poolId: task.poolId,
        status: "cancelled",
        progress: totalCount === 0 ? 100 : Math.floor((processedCount / totalCount) * 100),
        totalCount,
        processedCount,
        onlineCount,
        conflictCount
      });
      return;
    }
    if (control.controlFlag === "pause_requested") {
      await taskRepo.markTaskPaused(taskId);
      await taskRepo.addTaskLog(taskId, "info", "task_paused", "task paused by user request", {
        processedCount,
        totalCount
      });
      emitTaskEvent("scan_paused", {
        taskId,
        poolId: task.poolId,
        status: "paused",
        progress: totalCount === 0 ? 100 : Math.floor((processedCount / totalCount) * 100),
        totalCount,
        processedCount,
        onlineCount,
        conflictCount
      });
      return;
    }

    const chunk = ips.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map((ip) =>
        processSingleIp({
          taskId,
          poolId: task.poolId,
          ip,
          pingTimeoutMs,
          retryCount,
          scanMethod
        })
      )
    );

    results.forEach((x) => {
      processedCount += 1;
      if (x.statusCode === 1 || x.statusCode === 2) onlineCount += 1;
      if (x.statusCode === 2) conflictCount += 1;
    });

    const progress = totalCount === 0 ? 100 : Math.floor((processedCount / totalCount) * 100);
    await taskRepo.updateTaskProgress(taskId, {
      progress,
      totalCount,
      processedCount,
      onlineCount,
      conflictCount
    });

    await taskRepo.addTaskLog(taskId, "info", "task_progress", "scan progress updated", {
      processedCount,
      totalCount,
      progress
    });
    emitTaskEvent("scan_progress", {
      taskId,
      poolId: task.poolId,
      status: "running",
      progress,
      totalCount,
      processedCount,
      onlineCount,
      conflictCount
    });
  }

  await taskRepo.finishTaskSuccess(taskId);
  await taskRepo.addTaskLog(taskId, "info", "task_finished", "scan task finished", {
    totalCount,
    onlineCount,
    conflictCount
  });
  emitTaskEvent("scan_finished", {
    taskId,
    poolId: task.poolId,
    status: "success",
    progress: 100,
    totalCount,
    processedCount,
    onlineCount,
    conflictCount
  });
}

module.exports = {
  executeScanTask,
  setSocketServer,
  emitTaskEvent
};
