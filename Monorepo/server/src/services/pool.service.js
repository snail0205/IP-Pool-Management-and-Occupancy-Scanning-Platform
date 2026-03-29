const { requireFields } = require("../utils/validator");
const { isValidCidr, getHostIpsFromCidr } = require("../utils/cidr");
const poolRepo = require("../repositories/pool.repo");
const resultRepo = require("../repositories/result.repo");
const registryRepo = require("../repositories/registry.repo");
const {
  getIpVersion,
  compareIp,
  parseIpToBigInt,
  normalizeDnsList,
  isValidSubnetMask,
  generateRangeIps
} = require("../utils/ip-utils");

const MAX_POOL_IPS = 65536;

function assert(condition, message, status = 400) {
  if (!condition) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

function parseNetworkType(text) {
  const normalized = String(text || "").toUpperCase();
  if (normalized === "IPV4") return "IPv4";
  if (normalized === "IPV6") return "IPv6";
  return "";
}

function getRangeCount(startIp, endIp, version) {
  const start = parseIpToBigInt(startIp, version);
  const end = parseIpToBigInt(endIp, version);
  if (start === null || end === null) return null;
  if (end < start) return null;
  return end - start + 1n;
}

function getHostCountFromCidr(cidr, includeNetworkAndBroadcast) {
  if (!isValidCidr(cidr)) return null;
  const prefix = Number(String(cidr).split("/")[1]);
  if (!Number.isInteger(prefix)) return null;
  const hostBits = 32 - prefix;
  const blockSize = 2 ** hostBits;
  if (!includeNetworkAndBroadcast && blockSize > 2) {
    return blockSize - 2;
  }
  return blockSize;
}

function normalizeMac(text) {
  if (!text) return "";
  return String(text).trim().toUpperCase().replace(/-/g, ":");
}

function isValidMac(text) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalizeMac(text));
}

function validatePoolPayload(payload, existing) {
  requireFields(payload, ["name"]);

  // Backward compatible path: allow legacy CIDR-only creation.
  let startIp = payload.startIp;
  let endIp = payload.endIp;
  let networkType = parseNetworkType(payload.networkType);
  if (!startIp && !endIp && payload.cidr) {
    assert(isValidCidr(payload.cidr), "cidr must be valid IPv4 CIDR");
    const hostCount = getHostCountFromCidr(payload.cidr, Boolean(payload.includeNetworkAndBroadcast));
    assert(hostCount !== null && hostCount <= MAX_POOL_IPS, "cidr range too large");
    const hosts = getHostIpsFromCidr(payload.cidr, Boolean(payload.includeNetworkAndBroadcast));
    assert(hosts.length > 0, "cidr has no host ip");
    startIp = hosts[0];
    endIp = hosts[hosts.length - 1];
    networkType = "IPv4";
  }

  requireFields({ startIp, endIp, networkType }, ["startIp", "endIp", "networkType"]);
  assert(networkType, "networkType must be IPv4 or IPv6");

  const startVersion = getIpVersion(startIp);
  const endVersion = getIpVersion(endIp);
  assert(startVersion > 0 && endVersion > 0, "startIp/endIp must be valid ip");
  assert(startVersion === endVersion, "startIp and endIp must be same ip version");
  assert((networkType === "IPv4" && startVersion === 4) || (networkType === "IPv6" && startVersion === 6), "networkType mismatch with ip version");

  const rangeOrder = compareIp(startIp, endIp, startVersion);
  assert(rangeOrder !== null && rangeOrder <= 0, "startIp must be <= endIp");

  const rangeCount = getRangeCount(startIp, endIp, startVersion);
  assert(rangeCount !== null && rangeCount <= BigInt(MAX_POOL_IPS), "ip range too large");

  assert(isValidSubnetMask(payload.subnetMask, startVersion), "invalid subnetMask");

  if (payload.gateway) {
    assert(getIpVersion(payload.gateway) === startVersion, "gateway ip version mismatch");
  }

  const dnsList = normalizeDnsList(payload.dns);
  dnsList.forEach((dnsIp) => {
    assert(getIpVersion(dnsIp) === startVersion, "dns ip version mismatch");
  });

  if (payload.cidr) {
    assert(startVersion === 4 && isValidCidr(payload.cidr), "cidr must be valid IPv4 CIDR");
  }

  const leaseHours = payload.leaseHours === undefined || payload.leaseHours === null || payload.leaseHours === ""
    ? null
    : Number(payload.leaseHours);
  if (leaseHours !== null) {
    assert(Number.isInteger(leaseHours) && leaseHours > 0, "leaseHours must be positive integer");
  }

  return {
    name: String(payload.name).trim(),
    region: payload.region ? String(payload.region).trim() : null,
    networkType,
    startIp: String(startIp).trim(),
    endIp: String(endIp).trim(),
    subnetMask: payload.subnetMask ? String(payload.subnetMask).trim() : null,
    gateway: payload.gateway ? String(payload.gateway).trim() : null,
    dns: dnsList.join(","),
    leaseHours,
    enabled: payload.enabled === undefined ? (existing ? Boolean(existing.enabled) : true) : Boolean(payload.enabled),
    cidr: payload.cidr ? String(payload.cidr).trim() : null,
    includeNetworkAndBroadcast: Boolean(payload.includeNetworkAndBroadcast)
  };
}

async function ensurePoolExists(poolId) {
  const pool = await poolRepo.getPoolById(poolId);
  if (!pool) {
    const err = new Error("pool not found");
    err.status = 404;
    throw err;
  }
  return pool;
}

async function ensureIpInPoolRange(pool, ip) {
  const version = pool.networkType === "IPv6" ? 6 : 4;
  assert(getIpVersion(ip) === version, "binding ip version mismatch with pool");
  const lower = compareIp(pool.startIp, ip, version);
  const upper = compareIp(ip, pool.endIp, version);
  assert(lower !== null && upper !== null && lower <= 0 && upper <= 0, "ip out of pool range");
}

async function createPool(payload){
  const normalized = validatePoolPayload(payload);
  let data;
  try {
    data = await poolRepo.createPool(normalized);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || (err.message && err.message.includes('Duplicate entry'))) {
      const conflictErr = new Error("网段 CIDR 或名称已存在，请勿重复创建");
      conflictErr.status = 409;
      throw conflictErr;
    }
    throw err;
  }

  let ips = [];
  if (normalized.cidr) {
    ips = getHostIpsFromCidr(normalized.cidr, normalized.includeNetworkAndBroadcast);
  } else {
    ips = generateRangeIps(
      normalized.startIp,
      normalized.endIp,
      normalized.networkType === "IPv6" ? 6 : 4,
      MAX_POOL_IPS
    );
  }

  if (ips.length > 0) {
    await poolRepo.initPoolIpRows(data.id, ips);
  }

  return{
    poolId: data.id,
    networkType: data.networkType,
    totalIpCount: ips.length
  };
}

async function listPools(query){
    const page = Math.max(Number(query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize || 10), 1), 100);
    const keyword = query.keyword || "";
  return poolRepo.listPools({ page, pageSize, keyword});
}

async function listPoolIps(poolId, query){
  if(!poolId){
    const err = new Error("invalid pool id");
    err.status = 400;
    throw err;
  }
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 50), 1), 200);
  const status = query.status;
  const keyword = query.keyword || "";
  return resultRepo.listResultsByPoolId({ poolId, page, pageSize, status, keyword });
}

async function getPoolDetail(poolId) {
  if (!Number.isInteger(poolId) || poolId <= 0) {
    const err = new Error("invalid pool id");
    err.status = 400;
    throw err;
  }
  return ensurePoolExists(poolId);
}

async function updatePool(poolId, payload) {
  const existing = await ensurePoolExists(poolId);
  const normalized = validatePoolPayload(payload, existing);
  await poolRepo.updatePool(poolId, normalized);
  return poolRepo.getPoolById(poolId);
}

async function deletePool(poolId) {
  await ensurePoolExists(poolId);
  await poolRepo.deletePool(poolId);
  return { poolId };
}

async function setPoolStatus(poolId, enabled) {
  await ensurePoolExists(poolId);
  await poolRepo.setPoolEnabled(poolId, Boolean(enabled));
  return { poolId, enabled: Boolean(enabled) };
}

async function getPoolStats(poolId) {
  await ensurePoolExists(poolId);
  return poolRepo.getPoolStats(poolId);
}

async function createBinding(poolId, payload) {
  const pool = await ensurePoolExists(poolId);
  requireFields(payload, ["ip", "deviceName", "department", "owner"]);
  await ensureIpInPoolRange(pool, payload.ip);

  if (payload.expectedMac) {
    assert(isValidMac(payload.expectedMac), "expectedMac format invalid");
  }

  const conflictBinding = await registryRepo.findActiveBindingByIp(poolId, payload.ip);
  assert(!conflictBinding, "ip already bound by another record", 409);

  const bindingId = await registryRepo.createBinding(poolId, {
    ip: payload.ip,
    expectedMac: normalizeMac(payload.expectedMac),
    deviceName: payload.deviceName,
    department: payload.department,
    owner: payload.owner,
    purpose: payload.purpose || ""
  });

  // Conflict check: if live scan MAC exists and differs expected MAC, mark response.
  const snapshot = await registryRepo.getScanSnapshotByIp(poolId, payload.ip);
  const conflict = Boolean(
    snapshot &&
      snapshot.isAlive &&
      payload.expectedMac &&
      snapshot.mac &&
      normalizeMac(snapshot.mac) !== normalizeMac(payload.expectedMac)
  );

  return {
    bindingId,
    conflict
  };
}

async function listBindings(poolId, query) {
  await ensurePoolExists(poolId);
  return registryRepo.listBindings(poolId, query);
}

async function updateBinding(poolId, bindingId, payload) {
  await ensurePoolExists(poolId);
  const existing = await registryRepo.getBindingById(poolId, bindingId);
  assert(existing, "binding not found", 404);

  const next = {
    ip: payload.ip || existing.ip,
    expectedMac: payload.expectedMac !== undefined ? payload.expectedMac : existing.expectedMac,
    deviceName: payload.deviceName || existing.deviceName,
    department: payload.department || existing.department,
    owner: payload.owner || existing.owner,
    purpose: payload.purpose !== undefined ? payload.purpose : existing.purpose
  };
  await ensureIpInPoolRange(await ensurePoolExists(poolId), next.ip);
  if (next.expectedMac) {
    assert(isValidMac(next.expectedMac), "expectedMac format invalid");
  }

  const conflictBinding = await registryRepo.findActiveBindingByIp(poolId, next.ip, bindingId);
  assert(!conflictBinding, "ip already bound by another record", 409);

  await registryRepo.updateBinding(poolId, bindingId, {
    ...next,
    expectedMac: normalizeMac(next.expectedMac)
  });

  const snapshot = await registryRepo.getScanSnapshotByIp(poolId, next.ip);
  const conflict = Boolean(
    snapshot &&
      snapshot.isAlive &&
      next.expectedMac &&
      snapshot.mac &&
      normalizeMac(snapshot.mac) !== normalizeMac(next.expectedMac)
  );

  return {
    bindingId,
    conflict
  };
}

async function unbind(poolId, bindingId) {
  await ensurePoolExists(poolId);
  const existing = await registryRepo.getBindingById(poolId, bindingId);
  assert(existing, "binding not found", 404);
  await registryRepo.unbind(poolId, bindingId);
  return { bindingId };
}

module.exports = {
  createPool,
  listPools,
  getPoolDetail,
  updatePool,
  deletePool,
  setPoolStatus,
  getPoolStats,
  listPoolIps,
  createBinding,
  listBindings,
  updateBinding,
  unbind
};
