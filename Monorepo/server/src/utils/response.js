function ok(message = "ok", data = {}) {
    return { code: 0, message, data }
}

function fail(code = 50000, message = "internal error", data = null){
    return { code, message, data}
}

module.exports = { ok, fail }