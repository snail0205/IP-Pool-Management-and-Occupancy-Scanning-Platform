const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const occupancyRepo = require("../repositories/occupancy.repo");

async function searchOccupancy(query) {
  return occupancyRepo.searchOccupancy(query);
}

async function getOccupancyDetail(poolId, ip) {
  if (!poolId || !ip) {
    const err = new Error("poolId and ip are required");
    err.status = 400;
    throw err;
  }
  const detail = await occupancyRepo.getOccupancyDetail(poolId, ip);
  if (!detail) {
    const err = new Error("occupancy detail not found");
    err.status = 404;
    throw err;
  }
  return detail;
}

async function getHistory(query) {
  return occupancyRepo.listHistory(query);
}

async function getReport(query) {
  const defaults = {
    usage: {
      totalIpCount: 0,
      normalOccupiedCount: 0,
      abnormalOccupiedCount: 0,
      freeCount: 0,
      usageRate: 0
    },
    occupancyType: [],
    departmentDistribution: [],
    duration: { occupiedDurationSeconds: 0, occupiedDurationHours: 0 }
  };

  const [usage, occupancyType, departmentDistribution, duration] = await Promise.all([
    occupancyRepo.getUsageStats(query).catch(() => defaults.usage),
    occupancyRepo.getOccupancyTypeDistribution(query).catch(() => defaults.occupancyType),
    occupancyRepo.getDepartmentDistribution(query).catch(() => defaults.departmentDistribution),
    occupancyRepo.getOccupancyDurationStats(query).catch(() => defaults.duration)
  ]);

  return {
    usage: usage || defaults.usage,
    occupancyType: occupancyType || defaults.occupancyType,
    departmentDistribution: departmentDistribution || defaults.departmentDistribution,
    duration: duration || defaults.duration
  };
}

async function exportExcel(query) {
  const report = await getReport(query);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ip-pool-server";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("summary");
  summarySheet.columns = [
    { header: "metric", key: "metric", width: 24 },
    { header: "value", key: "value", width: 24 }
  ];
  summarySheet.addRow({ metric: "totalIpCount", value: report.usage.totalIpCount });
  summarySheet.addRow({ metric: "normalOccupiedCount", value: report.usage.normalOccupiedCount });
  summarySheet.addRow({ metric: "abnormalOccupiedCount", value: report.usage.abnormalOccupiedCount });
  summarySheet.addRow({ metric: "freeCount", value: report.usage.freeCount });
  summarySheet.addRow({ metric: "usageRate", value: report.usage.usageRate });
  summarySheet.addRow({ metric: "occupiedDurationHours", value: report.duration.occupiedDurationHours });

  const typeSheet = workbook.addWorksheet("occupancy_type");
  typeSheet.columns = [
    { header: "occupancyType", key: "occupancyType", width: 30 },
    { header: "count", key: "count", width: 12 }
  ];
  report.occupancyType.forEach((row) => typeSheet.addRow(row));

  const deptSheet = workbook.addWorksheet("department_distribution");
  deptSheet.columns = [
    { header: "department", key: "department", width: 30 },
    { header: "count", key: "count", width: 12 }
  ];
  report.departmentDistribution.forEach((row) => deptSheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

async function exportPdf(query) {
  const report = await getReport(query);
  const doc = new PDFDocument({ size: "A4", margin: 32 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(16).text("IP Occupancy Report", { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Generated At: ${new Date().toISOString()}`);
  doc.text(`Usage Rate: ${report.usage.usageRate}%`);
  doc.text(`Total IP: ${report.usage.totalIpCount}`);
  doc.text(`Normal Occupied: ${report.usage.normalOccupiedCount}`);
  doc.text(`Abnormal Occupied: ${report.usage.abnormalOccupiedCount}`);
  doc.text(`Free: ${report.usage.freeCount}`);
  doc.text(`Occupied Duration (hours): ${report.duration.occupiedDurationHours}`);
  doc.moveDown();

  doc.fontSize(13).text("Occupancy Type Distribution");
  report.occupancyType.forEach((item) => {
    doc.fontSize(11).text(`- ${item.occupancyType || "unknown"}: ${item.count}`);
  });
  doc.moveDown();

  doc.fontSize(13).text("Department Distribution");
  report.departmentDistribution.forEach((item) => {
    doc.fontSize(11).text(`- ${item.department}: ${item.count}`);
  });
  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = {
  searchOccupancy,
  getOccupancyDetail,
  getHistory,
  getReport,
  exportExcel,
  exportPdf
};
