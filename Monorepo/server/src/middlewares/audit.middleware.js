const auditRepo = require("../repositories/audit.repo");

function getAction(method) {
  const upper = String(method || "").toUpperCase();
  if (upper === "POST") return "create";
  if (upper === "PUT" || upper === "PATCH") return "update";
  if (upper === "DELETE") return "delete";
  return "read";
}

function extractEntityInfo(path) {
  const clean = String(path || "").split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  let entity = null;
  if (parts[0] === "api") {
    entity = parts[1] || null;
  }
  let entityId = null;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const num = Number(parts[i]);
    if (Number.isInteger(num) && num > 0) {
      entityId = num;
      break;
    }
  }
  return { entity, entityId };
}

function safeStringify(data) {
  if (!data) return null;
  try {
    const text = JSON.stringify(data);
    return text.length > 4000 ? text.slice(0, 4000) : text;
  } catch (error) {
    return null;
  }
}

function auditMiddleware(req, res, next) {
  const method = String(req.method || "").toUpperCase();
  const path = req.originalUrl || "";
  if (!req.user || ["GET", "HEAD", "OPTIONS"].includes(method) || path.startsWith("/api/auth")) {
    return next();
  }
  const { entity, entityId } = extractEntityInfo(path);
  const payload = safeStringify(req.body);
  const queryParams = safeStringify(req.query);
  const ip = req.ip;
  const userAgent = req.headers["user-agent"] || "";

  res.on("finish", () => {
    const record = {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: getAction(method),
      method,
      path,
      entity,
      entityId,
      requestBody: payload,
      queryParams,
      ip,
      userAgent,
      statusCode: res.statusCode
    };
    setImmediate(() => {
      auditRepo.insertAuditLog(record).catch(() => {});
    });
  });
  next();
}

module.exports = auditMiddleware;
