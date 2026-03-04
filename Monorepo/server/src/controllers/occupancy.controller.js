const occupancyService = require("../services/occupancy.service");
const { ok } = require("../utils/response");

async function searchOccupancy(req, res, next) {
  try {
    const data = await occupancyService.searchOccupancy(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function getOccupancyDetail(req, res, next) {
  try {
    const poolId = Number(req.params.poolId);
    const ip = req.params.ip;
    const data = await occupancyService.getOccupancyDetail(poolId, ip);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const data = await occupancyService.getHistory(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function getReport(req, res, next) {
  try {
    const data = await occupancyService.getReport(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function exportExcel(req, res, next) {
  try {
    const buffer = await occupancyService.exportExcel(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"occupancy-report.xlsx\"");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

async function exportPdf(req, res, next) {
  try {
    const buffer = await occupancyService.exportPdf(req.query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"occupancy-report.pdf\"");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  searchOccupancy,
  getOccupancyDetail,
  getHistory,
  getReport,
  exportExcel,
  exportPdf
};
