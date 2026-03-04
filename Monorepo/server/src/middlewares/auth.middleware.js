const authRepo = require("../repositories/auth.repo");

function unauthorized(message = "unauthorized") {
  const err = new Error(message);
  err.status = 401;
  return err;
}

function forbidden(message = "forbidden") {
  const err = new Error(message);
  err.status = 403;
  return err;
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (!token || scheme.toLowerCase() !== "bearer") {
      throw unauthorized("missing bearer token");
    }
    const record = await authRepo.getToken(token);
    if (!record || record.revokedAt) {
      throw unauthorized("invalid token");
    }
    const expiresAt = record.expiresAt ? new Date(record.expiresAt).getTime() : 0;
    if (!expiresAt || Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      throw unauthorized("token expired");
    }
    if (!record.isActive) {
      throw forbidden("user disabled");
    }
    req.user = {
      id: record.userId,
      username: record.username,
      role: record.role
    };
    req.authToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

function authorize(req, res, next) {
  try {
    if (!req.user) {
      throw unauthorized("unauthorized");
    }
    if (req.user.role === "admin") {
      return next();
    }
    const method = String(req.method || "").toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      return next();
    }
    throw forbidden("read-only access");
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  try {
    if (!req.user || req.user.role !== "admin") {
      throw forbidden("admin required");
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate, authorize, requireAdmin };
