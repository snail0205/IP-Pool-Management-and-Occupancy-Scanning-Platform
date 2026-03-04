const crypto = require("node:crypto");
const { requireFields } = require("../utils/validator");
const authRepo = require("../repositories/auth.repo");

const TOKEN_EXPIRE_HOURS = Math.max(Number(process.env.TOKEN_EXPIRE_HOURS || 168), 1);
const ROLES = ["admin", "readonly"];

function assert(condition, message, status = 400) {
  if (!condition) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const iterations = 100000;
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const hash = parts[3];
  if (!Number.isInteger(iterations) || !salt || !hash) return false;
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: Boolean(user.isActive)
  };
}

async function ensureBootstrapUser(username) {
  const envUser = process.env.ADMIN_USER;
  const envPass = process.env.ADMIN_PASSWORD;
  if (!envUser || !envPass) return null;
  if (envUser !== username) return null;
  const existing = await authRepo.getUserByUsername(envUser);
  if (existing) return existing;
  const userId = await authRepo.createUser({
    username: envUser,
    passwordHash: hashPassword(envPass),
    role: "admin",
    isActive: true
  });
  return authRepo.getUserById(userId);
}

async function login(payload) {
  requireFields(payload, ["username", "password"]);
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  assert(username && password, "username and password required");

  let user = await authRepo.getUserByUsername(username);
  if (!user) {
    user = await ensureBootstrapUser(username);
  }
  assert(user, "invalid credentials", 401);
  assert(user.isActive, "user disabled", 403);
  assert(verifyPassword(password, user.passwordHash), "invalid credentials", 401);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRE_HOURS * 3600 * 1000);
  await authRepo.createToken({ userId: user.id, token, expiresAt });

  return {
    token,
    expiresAt,
    user: sanitizeUser(user)
  };
}

async function logout(token) {
  if (!token) return { ok: true };
  await authRepo.revokeToken(token);
  return { ok: true };
}

async function getMe(userId) {
  const user = await authRepo.getUserById(userId);
  if (!user) {
    const err = new Error("user not found");
    err.status = 404;
    throw err;
  }
  return sanitizeUser(user);
}

async function createUser(payload) {
  requireFields(payload, ["username", "password", "role"]);
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const role = String(payload.role || "").toLowerCase();
  assert(username && password, "username and password required");
  assert(ROLES.includes(role), "invalid role");

  const existing = await authRepo.getUserByUsername(username);
  assert(!existing, "username already exists", 409);

  const userId = await authRepo.createUser({
    username,
    passwordHash: hashPassword(password),
    role,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true
  });
  return getMe(userId);
}

async function listUsers(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const keyword = query.keyword || "";
  return authRepo.listUsers({ page, pageSize, keyword });
}

async function setUserStatus(userId, isActive) {
  await authRepo.setUserStatus(userId, Boolean(isActive));
  return getMe(userId);
}

async function setUserRole(userId, role) {
  const nextRole = String(role || "").toLowerCase();
  assert(ROLES.includes(nextRole), "invalid role");
  await authRepo.setUserRole(userId, nextRole);
  return getMe(userId);
}

module.exports = {
  login,
  logout,
  getMe,
  createUser,
  listUsers,
  setUserStatus,
  setUserRole
};
