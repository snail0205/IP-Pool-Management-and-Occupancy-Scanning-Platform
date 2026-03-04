const express = require("express");
const authController = require("../controllers/auth.controller");
const { authenticate, requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);
router.get("/users", authenticate, requireAdmin, authController.listUsers);
router.post("/users", authenticate, requireAdmin, authController.createUser);
router.patch("/users/:id/status", authenticate, requireAdmin, authController.setUserStatus);
router.patch("/users/:id/role", authenticate, requireAdmin, authController.setUserRole);

module.exports = router;
