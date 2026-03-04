const express = require("express");
const taskController = require("../controllers/task.controller");

const router = express.Router();

router.post("/tasks", taskController.createScanTask);
router.get("/tasks", taskController.listTasks);
router.post("/tasks/:taskId/trigger", taskController.triggerTask);
router.post("/tasks/:taskId/pause", taskController.pauseTask);
router.post("/tasks/:taskId/terminate", taskController.terminateTask);
router.post("/:poolId/start", taskController.startScanTask);
router.get("/tasks/:taskId", taskController.getTaskProgress);
router.get("/tasks/:taskId/logs", taskController.listTaskLogs);
router.get("/tasks/:taskId/logs/export", taskController.exportTaskLogs);

module.exports = router;
