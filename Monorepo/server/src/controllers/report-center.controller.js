const reportCenterService = require("../services/report-center.service");
const { ok } = require("../utils/response");

async function getSummary(req, res, next) {
  try {
    const data = await reportCenterService.getSummary(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function exportExcel(req, res, next) {
  try {
    const buffer = await reportCenterService.exportExcel(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"report-center.xlsx\"");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

async function exportPdf(req, res, next) {
  try {
    const buffer = await reportCenterService.exportPdf(req.query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"report-center.pdf\"");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

async function sendReport(req, res, next) {
  try {
    const data = await reportCenterService.sendReport(req.body, req.user);
    res.json(ok("report sent", data));
  } catch (error) {
    next(error);
  }
}

async function listDeliveries(req, res, next) {
  try {
    const data = await reportCenterService.listReportDeliveries(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSummary,
  exportExcel,
  exportPdf,
  sendReport,
  listDeliveries
};
