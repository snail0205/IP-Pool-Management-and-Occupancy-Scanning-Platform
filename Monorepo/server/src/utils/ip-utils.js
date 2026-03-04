const net = require("node:net");

function getIpVersion(ip) {
  const v = net.isIP(ip || "");
  return v === 4 || v === 6 ? v : 0;
}

function ipv4ToBigInt(ip) {
  return ip
    .split(".")
    .map((x) => Number(x))
    .reduce((acc, cur) => (acc << 8n) + BigInt(cur), 0n);
}

function bigIntToIpv4(value) {
  const v = Number(value);
  return [
    (v >>> 24) & 255,
    (v >>> 16) & 255,
    (v >>> 8) & 255,
    v & 255
  ].join(".");
}

function expandIPv6(ip) {
  if (ip.includes(".")) {
    return null;
  }
  const [left, right] = ip.split("::");
  if (ip.split("::").length > 2) return null;

  const leftParts = left ? left.split(":").filter(Boolean) : [];
  const rightParts = right ? right.split(":").filter(Boolean) : [];
  const missing = 8 - (leftParts.length + rightParts.length);
  if (missing < 0) return null;
  const zeroParts = new Array(missing).fill("0");
  const full = [...leftParts, ...zeroParts, ...rightParts];
  if (full.length !== 8) return null;
  return full.map((p) => p.padStart(4, "0").toLowerCase());
}

function ipv6ToBigInt(ip) {
  const parts = expandIPv6(ip);
  if (!parts) return null;
  return parts.reduce((acc, part) => (acc << 16n) + BigInt(`0x${part}`), 0n);
}

function bigIntToIpv6(value) {
  const parts = [];
  let cur = value;
  for (let i = 0; i < 8; i += 1) {
    const group = Number(cur & 0xffffn).toString(16).padStart(4, "0");
    parts.unshift(group);
    cur >>= 16n;
  }
  return parts.join(":");
}

function parseIpToBigInt(ip, version) {
  if (version === 4) return ipv4ToBigInt(ip);
  if (version === 6) return ipv6ToBigInt(ip);
  return null;
}

function compareIp(a, b, version) {
  const va = parseIpToBigInt(a, version);
  const vb = parseIpToBigInt(b, version);
  if (va === null || vb === null) return null;
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

function normalizeDnsList(dns) {
  if (!dns) return [];
  if (Array.isArray(dns)) return dns.map((x) => String(x).trim()).filter(Boolean);
  return String(dns)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isValidSubnetMask(mask, version) {
  if (mask === undefined || mask === null || mask === "") return true;
  const text = String(mask).trim();

  if (version === 4) {
    if (/^\d{1,2}$/.test(text)) {
      const n = Number(text);
      return n >= 0 && n <= 32;
    }
    const parts = text.split(".");
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(Number(p)))) return false;
    const values = parts.map((p) => Number(p));
    if (values.some((v) => v < 0 || v > 255)) return false;
    const bin = values.map((v) => v.toString(2).padStart(8, "0")).join("");
    return /^1*0*$/.test(bin);
  }

  if (version === 6) {
    const n = Number(text.replace("/", ""));
    return Number.isInteger(n) && n >= 0 && n <= 128;
  }

  return false;
}

function generateRangeIps(startIp, endIp, version, maxCount = 4096) {
  const start = parseIpToBigInt(startIp, version);
  const end = parseIpToBigInt(endIp, version);
  if (start === null || end === null) return [];
  if (end < start) return [];

  const count = end - start + 1n;
  if (count > BigInt(maxCount)) return [];

  const ips = [];
  for (let i = start; i <= end; i += 1n) {
    ips.push(version === 4 ? bigIntToIpv4(i) : bigIntToIpv6(i));
  }
  return ips;
}

module.exports = {
  getIpVersion,
  parseIpToBigInt,
  compareIp,
  normalizeDnsList,
  isValidSubnetMask,
  generateRangeIps
};
