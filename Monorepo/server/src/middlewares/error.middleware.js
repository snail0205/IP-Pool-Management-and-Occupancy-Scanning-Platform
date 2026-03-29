const { fail} = require("../utils/response");

function notFoundHandler(req, res) {
    res.status(404).json(
      fail(40400, `route not found:${req.method} ${req.originalUrl} `, { requestId: req.requestId || null })
    );
}

function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const code = status === 500 ? 50000 : status * 100;
    if (status >= 500) {
      // 输出请求链路标识，便于快速定位线上报错。
      console.error(`[${req.requestId || "no-request-id"}]`, err.stack || err.message || err);
    }
    res.status(status).json(
      fail(code, err.message || "internal server error", { requestId: req.requestId || null })
    );
}

module.exports = { notFoundHandler, errorHandler };