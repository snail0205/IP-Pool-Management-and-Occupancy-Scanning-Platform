const authService = require("../services/auth.service");
const { ok } = require("../utils/response");

async function login(req, res, next) {
  try {
    const data = await authService.login(req.body || {});
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const data = await authService.logout(req.authToken);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const data = await authService.getMe(req.user.id);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const data = await authService.listUsers(req.query);
    res.json(ok("ok", data));
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const data = await authService.createUser(req.body || {});
    res.status(201).json(ok("user created", data));
  } catch (error) {
    next(error);
  }
}

async function setUserStatus(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const data = await authService.setUserStatus(userId, req.body?.isActive);
    res.json(ok("user status updated", data));
  } catch (error) {
    next(error);
  }
}

async function setUserRole(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const data = await authService.setUserRole(userId, req.body?.role);
    res.json(ok("user role updated", data));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  logout,
  me,
  listUsers,
  createUser,
  setUserStatus,
  setUserRole
};
