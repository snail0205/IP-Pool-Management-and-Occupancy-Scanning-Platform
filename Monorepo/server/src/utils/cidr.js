const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isValidCidr(cidr) {
  if (typeof cidr !== "string") return false;
  const parts = cidr.split("/");
  if (parts.length !== 2) return false;

  const ip = parts[0];
  const prefix = Number(parts[1]);

  return IPV4_REGEX.test(ip) && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

function ipToInt(ip) {
  return ip.split(".").reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
}

function intToIp(intValue) {
  return [
    (intValue >>> 24) & 255,
    (intValue >>> 16) & 255,
    (intValue >>> 8) & 255,
    intValue & 255
  ].join(".");
}

function getHostIpsFromCidr(cidr, includeNetworkAndBroadcast = false) {
  if (!isValidCidr(cidr)) {
    const err = new Error("invalid cidr");
    err.status = 400;
    throw err;
  }

  const [rawIp, rawPrefix] = cidr.split("/");
  const prefix = Number(rawPrefix);
  const baseIpInt = ipToInt(rawIp);

  const hostBits = 32 - prefix;
  const blockSize = 2 ** hostBits;
  const mask = hostBits === 32 ? 0 : ((0xffffffff << hostBits) >>> 0);
  const network = baseIpInt & mask;
  const broadcast = (network + blockSize - 1) >>> 0;

  let start = network;
  let end = broadcast;

  if (!includeNetworkAndBroadcast && blockSize > 2) {
    start = (network + 1) >>> 0;
    end = (broadcast - 1) >>> 0;
  }

  const result = [];
  for (let current = start; current <= end; current = (current + 1) >>> 0) {
    result.push(intToIp(current));
    if (current === 0xffffffff) break;
  }
  return result;
}

module.exports = {
  isValidCidr,
  getHostIpsFromCidr
};