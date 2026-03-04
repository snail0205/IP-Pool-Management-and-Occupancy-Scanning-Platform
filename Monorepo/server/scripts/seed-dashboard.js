/**
 * 填充 IP 池与仪表盘展示用数据（IP 池、扫描结果分布、扫描任务历史）
 * 使用方式：在 Monorepo/server 目录下执行 node scripts/seed-dashboard.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("../src/config/db");
const poolService = require("../src/services/pool.service");

const SEED_POOLS = [
  { name: "办公网 A 区", cidr: "10.0.0.0/24", region: "北京" },
  { name: "办公网 B 区", cidr: "10.0.1.0/24", region: "北京" },
  { name: "机房 DMZ", cidr: "192.168.10.0/24", region: "上海" },
  { name: "测试环境", cidr: "172.16.1.0/24", region: "广州" },
  { name: "研发网段", cidr: "10.10.0.0/24", region: "深圳" }
];

async function createPools() {
  const ids = [];
  for (const p of SEED_POOLS) {
    const [existing] = await db.execute("SELECT id FROM ip_pool WHERE name = ? OR cidr = ? LIMIT 1", [p.name, p.cidr]);
    if (existing[0]) {
      ids.push(existing[0].id);
      console.log(`  use existing pool: ${p.name} (id=${existing[0].id})`);
      continue;
    }
    try {
      const data = await poolService.createPool({
        name: p.name,
        cidr: p.cidr,
        networkType: "IPv4",
        region: p.region,
        enabled: true
      });
      ids.push(data.poolId);
      console.log(`  created pool: ${p.name} (id=${data.poolId}, ips=${data.totalIpCount})`);
    } catch (e) {
      const [byName] = await db.execute("SELECT id FROM ip_pool WHERE name = ? OR cidr = ? LIMIT 1", [p.name, p.cidr]);
      if (byName[0]) ids.push(byName[0].id);
      console.warn(`  skip pool ${p.name}:`, e.message);
    }
  }
  return ids;
}

async function enrichScanResults(poolIds) {
  for (const poolId of poolIds) {
    const [ips] = await db.execute(
      "SELECT ip FROM ip_scan_result WHERE pool_id = ? ORDER BY ip ASC",
      [poolId]
    );
    if (ips.length === 0) continue;
    const total = ips.length;
    const freeCount = Math.floor(total * 0.4);
    const occupiedCount = Math.floor(total * 0.45);
    const conflictCount = total - freeCount - occupiedCount;
    for (let i = 0; i < ips.length; i++) {
      let statusCode = -1;
      let isAlive = 0;
      if (i < freeCount) {
        statusCode = 0;
        isAlive = 0;
      } else if (i < freeCount + occupiedCount) {
        statusCode = 1;
        isAlive = 1;
      } else {
        statusCode = 2;
        isAlive = 1;
      }
      await db.execute(
        "UPDATE ip_scan_result SET status_code = ?, is_alive = ?, last_scan_time = NOW() WHERE pool_id = ? AND ip = ?",
        [statusCode, isAlive, poolId, ips[i].ip]
      );
    }
    console.log(`  enriched pool ${poolId}: free=${freeCount}, occupied=${occupiedCount}, conflict=${conflictCount}`);
  }
}

async function seedScanTasks(poolIds) {
  if (poolIds.length === 0) return;
  const placeholders = poolIds.map(() => "?").join(",");
  const [existingPools] = await db.execute(`SELECT id FROM ip_pool WHERE id IN (${placeholders})`, poolIds);
  const validIds = existingPools.map((r) => r.id);
  if (validIds.length === 0) {
    console.warn("  no valid pool ids for scan tasks");
    return;
  }
  const now = new Date();
  const tasks = [
    { poolId: validIds[0], status: "success", progress: 100, total: 254, processed: 254, online: 120, conflict: 8, hoursAgo: 2 },
    { poolId: validIds[0], status: "success", progress: 100, total: 254, processed: 254, online: 118, conflict: 6, hoursAgo: 8 },
    { poolId: validIds[1 % validIds.length], status: "success", progress: 100, total: 254, processed: 254, online: 95, conflict: 3, hoursAgo: 5 },
    { poolId: validIds[2 % validIds.length], status: "running", progress: 67, total: 254, processed: 170, online: 82, conflict: 2, hoursAgo: 0 },
    { poolId: validIds[2 % validIds.length], status: "failed", progress: 30, total: 254, processed: 76, online: 40, conflict: 1, hoursAgo: 12 },
    { poolId: validIds[3 % validIds.length], status: "success", progress: 100, total: 254, processed: 254, online: 50, conflict: 0, hoursAgo: 1 },
    { poolId: validIds[4 % validIds.length], status: "cancelled", progress: 15, total: 254, processed: 38, online: 20, conflict: 0, hoursAgo: 20 }
  ];
  for (const t of tasks) {
    const [r] = await db.execute(
      `INSERT INTO scan_task
        (pool_id, status, progress, total_count, processed_count, online_count, conflict_count,
         params_json, created_by, scope_type, scan_method, frequency_type, timeout_ms, retry_count,
         idempotency_key, schedule_cron, control_flag)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', 'seed', 'pool', 'icmp_arp', 'once', 1500, 1, NULL, NULL, 'none')`,
      [
        Number(t.poolId),
        String(t.status),
        Number(t.progress),
        Number(t.total),
        Number(t.processed),
        Number(t.online),
        Number(t.conflict)
      ]
    );
    const taskId = r.insertId;
    if (!taskId) continue;
    const started = new Date(now.getTime() - t.hoursAgo * 60 * 60 * 1000);
    const ended = ["success", "failed", "cancelled"].includes(t.status)
      ? new Date(started.getTime() + 3 * 60 * 1000)
      : null;
    await db.execute(
      "UPDATE scan_task SET started_at = ?, ended_at = ?, triggered_at = ? WHERE id = ?",
      [started, ended ?? null, started, taskId]
    );
  }
  console.log(`  inserted ${tasks.length} scan tasks`);
}

async function main() {
  console.log("Seed: creating IP pools...");
  const poolIds = await createPools();
  console.log("Seed: enriching scan results (free/occupied/conflict)...");
  await enrichScanResults(poolIds);
  console.log("Seed: inserting scan tasks for dashboard...");
  await seedScanTasks(poolIds);
  console.log("Seed done. Refresh Dashboard to see data.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
