const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const crypto = require("node:crypto");

const authRoutes = require("./routes/auth.routes");
const routes = require("./routes");
const { authenticate, authorize } = require("./middlewares/auth.middleware");
const auditMiddleware = require("./middlewares/audit.middleware");
const { notFoundHandler, errorHandler} = require("./middlewares/error.middleware");

const app = express();

app.use(helmet());
app.use(cors());
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(multer().none());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
    res.json({ code: 0, message: "ok", data: { status: "up"}});
});

app.use("/api/auth", authRoutes);
app.use("/api", authenticate, authorize, auditMiddleware, routes);
app.use(notFoundHandler);
app.use(errorHandler)


module.exports = app;
