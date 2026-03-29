const taskService = require("../services/task.service");
const { ok } = require("../utils/response");

async function startScanTask(req, res, next) {
  try {
    const poolId = Number(req.params.poolId);
    const data = await taskService.startScanTask(poolId, req.body);
    res.status(201).json(ok("scan started", data));
  } catch (error) {
    next(error);
  }
}

async function getTaskProgress(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const data = await taskService.getTaskProgress(taskId);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function createScanTask(req, res, next) {
  try {
    const poolId = Number(req.body.poolId);
    const data = await taskService.createScanTask(poolId, req.body);
    res.status(201).json(ok("task created", data));
  } catch (error) {
    next(error);
  }
}

async function triggerTask(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const data = await taskService.triggerTask(taskId);
    res.json(ok("task triggered", data));
  } catch (error) {
    next(error);
  }
}

async function pauseTask(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const data = await taskService.pauseTask(taskId);
    res.json(ok("pause requested", data));
  } catch (error) {
    next(error);
  }
}

async function terminateTask(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const data = await taskService.terminateTask(taskId);
    res.json(ok("terminate requested", data));
  } catch (error) {
    next(error);
  }
}

async function listTasks(req, res, next) {
  try {
    const data = await taskService.listTasks(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function listTaskLogs(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const data = await taskService.listTaskLogs(taskId, req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function listRecentFailedTasks(req, res, next) {
  try {
    const data = await taskService.listRecentFailedTasks(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function exportTaskLogs(req, res, next) {
  try {
    const taskId = Number(req.params.taskId);
    const csv = await taskService.exportTaskLogsCsv(taskId);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"task-${taskId}-logs.csv\"`);
    res.send(csv);
  } catch (error) {
    next(error);
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
  listRecentFailedTasks,
  exportTaskLogs
};
