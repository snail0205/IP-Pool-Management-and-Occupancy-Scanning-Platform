const { fail} = require("../utils/response");

function notFoundHandler(req, res) {
    res.status(404).json(fail(40400, `route not found:${req.method} ${req.originalUrl} `));
}

function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const code = status === 500 ? 50000 : status * 100;
    res.status(status).json(fail(code,err.message || "internal server error"));
}

module.exports = { notFoundHandler, errorHandler };