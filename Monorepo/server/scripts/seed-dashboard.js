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
  { name: "研发网段", cidr: "10.10.0.0/24", region: "深圳" },
  { name: "华东办公网-杭州", cidr: "10.20.0.0/24", region: "杭州" },
  { name: "华东办公网-南京", cidr: "10.20.1.0/24", region: "南京" },
  { name: "华东办公网-苏州", cidr: "10.20.2.0/24", region: "苏州" },
  { name: "华中办公网-武汉", cidr: "10.21.0.0/24", region: "武汉" },
  { name: "华中办公网-长沙", cidr: "10.21.1.0/24", region: "长沙" },
  { name: "华中办公网-郑州", cidr: "10.21.2.0/24", region: "郑州" },
  { name: "西南办公网-成都", cidr: "10.22.0.0/24", region: "成都" },
  { name: "西南办公网-重庆", cidr: "10.22.1.0/24", region: "重庆" },
  { name: "西南办公网-昆明", cidr: "10.22.2.0/24", region: "昆明" },
  { name: "西南办公网-贵阳", cidr: "10.22.3.0/24", region: "贵阳" },
  { name: "华南业务网-厦门", cidr: "10.23.0.0/24", region: "厦门" },
  { name: "华南业务网-福州", cidr: "10.23.1.0/24", region: "福州" },
  { name: "华南业务网-南宁", cidr: "10.23.2.0/24", region: "南宁" },
  { name: "华南业务网-海口", cidr: "10.23.3.0/24", region: "海口" },
  { name: "华北生产网-天津", cidr: "10.24.0.0/24", region: "天津" },
  { name: "华北生产网-石家庄", cidr: "10.24.1.0/24", region: "石家庄" },
  { name: "华北生产网-太原", cidr: "10.24.2.0/24", region: "太原" },
  { name: "东北生产网-沈阳", cidr: "10.25.0.0/24", region: "沈阳" },
  { name: "东北生产网-大连", cidr: "10.25.1.0/24", region: "大连" },
  { name: "东北生产网-长春", cidr: "10.25.2.0/24", region: "长春" },
  { name: "东北生产网-哈尔滨", cidr: "10.25.3.0/24", region: "哈尔滨" },
  { name: "西北核心网-西安", cidr: "10.26.0.0/24", region: "西安" },
  { name: "西北核心网-兰州", cidr: "10.26.1.0/24", region: "兰州" },
  { name: "西北核心网-西宁", cidr: "10.26.2.0/24", region: "西宁" },
  { name: "西北核心网-乌鲁木齐", cidr: "10.26.3.0/24", region: "乌鲁木齐" },
  { name: "西北核心网-银川", cidr: "10.26.4.0/24", region: "银川" },
  { name: "西北核心网-呼和浩特", cidr: "10.26.5.0/24", region: "呼和浩特" },
  { name: "边缘节点-拉萨", cidr: "10.27.0.0/24", region: "拉萨" },
  { name: "边缘节点-青岛", cidr: "10.27.1.0/24", region: "青岛" },
  { name: "边缘节点-济南", cidr: "10.27.2.0/24", region: "济南" },
  { name: "边缘节点-合肥", cidr: "10.27.3.0/24", region: "合肥" },
  { name: "边缘节点-南昌", cidr: "10.27.4.0/24", region: "南昌" }
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
