const app = require("./app");
const env = require("./config/env");
const db = require("./config/db");
const { ensureIpPoolSchema } = require("./config/ensurePoolSchema");

async function start() {
  try {
    await db.query("SELECT 1");
    await ensureIpPoolSchema();
    app.listen(env.port, () => {
      console.log(`server is running: http://localhost:${env.port}`);
    });
  } catch (e) {
    console.log("start failed:", e.message);
    process.exit(1);
  }
}

start();