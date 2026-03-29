const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const reportRepo = require("../repositories/report.repo");

function toDateKey(input) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input).slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function buildDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const list = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 3600 * 1000) {
    list.push(new Date(t).toISOString().slice(0, 10));
  }
  return list;
}

function calcMetrics(summary) {
  const totalTasks = summary.usageTrend.reduce((sum, x) => sum + Number(x.taskCount || 0), 0);
  const totalSuccessTasks = summary.usageTrend.reduce((sum, x) => sum + Number(x.successTaskCount || 0), 0);
  const totalFailedTasks = summary.usageTrend.reduce((sum, x) => sum + Number(x.failedTaskCount || 0), 0);
  const successRate = totalTasks > 0 ? Number(((totalSuccessTasks / totalTasks) * 100).toFixed(2)) : 0;
  const avgDailyTasks = summary.usageTrend.length > 0 ? Number((totalTasks / summary.usageTrend.length).toFixed(2)) : 0;
  return {
    totalTasks,
    totalSuccessTasks,
    totalFailedTasks,
    successRate,
    avgDailyTasks,
    conflictCount: summary.conflictTop10.length,
    longOfflineCount: summary.longOfflineAssets.length
  };
}

function resolvePeriod(period) {
  const p = String(period || "weekly").toLowerCase();
  if (p === "monthly") {
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 24 * 3600 * 1000);
    return {
      period: "monthly",
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    };
  }
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 24 * 3600 * 1000);
  return {
    period: "weekly",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

async function getSummary(query = {}) {
  const range = resolvePeriod(query.period);
  const offlineHours = Math.max(Number(query.offlineHours || 72), 1);
  const [usageTrend, conflictTop10, longOfflineAssets] = await Promise.all([
    reportRepo.getUsageTrend(range),
    reportRepo.getConflictTop10(),
    reportRepo.getLongOfflineAssets(offlineHours)
  ]);
  const usageMap = new Map(
    (usageTrend || []).map((x) => [
      toDateKey(x.statDate),
      {
        statDate: toDateKey(x.statDate),
        taskCount: Number(x.taskCount || 0),
        successTaskCount: Number(x.successTaskCount || 0),
        failedTaskCount: Number(x.failedTaskCount || 0)
      }
    ])
  );
  const fullUsageTrend = buildDateRange(range.startDate, range.endDate).map((key) => {
    return (
      usageMap.get(key) || {
        statDate: key,
        taskCount: 0,
        successTaskCount: 0,
        failedTaskCount: 0
      }
    );
  });
  const summary = {
    period: range.period,
    startDate: range.startDate,
    endDate: range.endDate,
    offlineHours,
    usageTrend: fullUsageTrend,
    conflictTop10,
    longOfflineAssets
  };
  return {
    ...summary,
    metrics: calcMetrics(summary)
  };
}

async function exportExcel(query = {}) {
  const summary = await getSummary(query);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ip-pool-platform";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("summary");
  summarySheet.columns = [
    { header: "key", key: "key", width: 24 },
    { header: "value", key: "value", width: 24 }
  ];
  summarySheet.addRow({ key: "period", value: summary.period });
  summarySheet.addRow({ key: "dateRange", value: `${summary.startDate} ~ ${summary.endDate}` });
  summarySheet.addRow({ key: "offlineHours", value: summary.offlineHours });
  summarySheet.addRow({ key: "totalTasks", value: summary.metrics.totalTasks });
  summarySheet.addRow({ key: "successRate", value: `${summary.metrics.successRate}%` });
  summarySheet.addRow({ key: "conflictCount", value: summary.metrics.conflictCount });
  summarySheet.addRow({ key: "longOfflineCount", value: summary.metrics.longOfflineCount });

  const trendSheet = workbook.addWorksheet("usage_trend");
  trendSheet.columns = [
    { header: "date", key: "statDate", width: 16 },
    { header: "taskCount", key: "taskCount", width: 12 },
    { header: "successTaskCount", key: "successTaskCount", width: 18 },
    { header: "failedTaskCount", key: "failedTaskCount", width: 16 }
  ];
  summary.usageTrend.forEach((row) => trendSheet.addRow(row));

  const conflictSheet = workbook.addWorksheet("conflict_top10");
  conflictSheet.columns = [
    { header: "poolId", key: "poolId", width: 10 },
    { header: "poolName", key: "poolName", width: 26 },
    { header: "ip", key: "ip", width: 20 },
    { header: "statusReason", key: "statusReason", width: 22 },
    { header: "lastScanTime", key: "lastScanTime", width: 22 }
  ];
  summary.conflictTop10.forEach((row) => conflictSheet.addRow(row));

  const offlineSheet = workbook.addWorksheet("long_offline_assets");
  offlineSheet.columns = [
    { header: "poolId", key: "poolId", width: 10 },
    { header: "poolName", key: "poolName", width: 26 },
    { header: "ip", key: "ip", width: 20 },
    { header: "deviceName", key: "deviceName", width: 26 },
    { header: "owner", key: "owner", width: 18 },
    { header: "offlineHours", key: "offlineHours", width: 14 }
  ];
  summary.longOfflineAssets.forEach((row) => offlineSheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

async function exportPdf(query = {}) {
  const summary = await getSummary(query);
  const doc = new PDFDocument({ size: "A4", margin: 32 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.fontSize(16).text(`IP Report Center - ${summary.period}`, { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Range: ${summary.startDate} ~ ${summary.endDate}`);
  doc.fontSize(12).text(`Offline Threshold: ${summary.offlineHours}h`);
  doc.fontSize(12).text(
    `Tasks: ${summary.metrics.totalTasks}, Success: ${summary.metrics.totalSuccessTasks}, Failed: ${summary.metrics.totalFailedTasks}, Success Rate: ${summary.metrics.successRate}%`
  );
  doc.moveDown();
  doc.fontSize(13).text("Daily Usage Trend");
  summary.usageTrend.forEach((x) => {
    doc.fontSize(10).text(`${x.statDate}: total=${x.taskCount}, success=${x.successTaskCount}, failed=${x.failedTaskCount}`);
  });
  doc.moveDown();
  doc.fontSize(13).text("Conflict Top10");
  summary.conflictTop10.forEach((x, idx) => {
    doc.fontSize(10).text(`${idx + 1}. [${x.poolName || x.poolId}] ${x.ip} - ${x.statusReason}`);
  });
  doc.moveDown();
  doc.fontSize(13).text("Long Offline Assets");
  summary.longOfflineAssets.slice(0, 20).forEach((x, idx) => {
    doc.fontSize(10).text(`${idx + 1}. ${x.ip} (${x.deviceName || "-"}) offline ${x.offlineHours}h`);
  });
  doc.end();
  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function sendReport(query = {}, user) {
  const period = resolvePeriod(query.period).period;
  const reportType = String(query.reportType || "weekly").toLowerCase();
  const channels = Array.isArray(query.channels) ? query.channels.join(",") : String(query.channels || "in_app,email,wecom");
  const receivers = query.receivers ? String(query.receivers) : "";
  await reportRepo.insertReportDeliveryLog({
    reportPeriod: period,
    reportType,
    channels,
    receivers,
    status: "sent",
    detail: "mock delivered",
    createdBy: user?.id || null
  });
  return {
    period,
    reportType,
    channels,
    receivers,
    status: "sent"
  };
}

async function listReportDeliveries(query) {
  return reportRepo.listReportDeliveries(query);
}

module.exports = {
  getSummary,
  exportExcel,
  exportPdf,
  sendReport,
  listReportDeliveries
};
