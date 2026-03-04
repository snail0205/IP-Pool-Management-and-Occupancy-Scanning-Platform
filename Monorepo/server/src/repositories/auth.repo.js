const db = require("../config/db");

async function getUserByUsername(username) {
  const [rows] = await db.execute(
    `
      SELECT
        id,
        username,
        password_hash AS passwordHash,
        role,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM sys_user
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );
  return rows[0] || null;
}

async function getUserById(userId) {
  const [rows] = await db.execute(
    `
      SELECT
        id,
        username,
        password_hash AS passwordHash,
        role,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM sys_user
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
}

async function listUsers({ page = 1, pageSize = 20, keyword = "" }) {
  const safePage = Math.max(Number(page || 1), 1);
  const safePageSize = Math.min(Math.max(Number(pageSize || 20), 1), 100);
  const offset = (safePage - 1) * safePageSize;
  const kw = `%${keyword}%`;

  const [countRows] = await db.execute(
    "SELECT COUNT(*) AS total FROM sys_user WHERE username LIKE ?",
    [kw]
  );
  const total = countRows[0].total;

  const [rows] = await db.execute(
    `
      SELECT
        id,
        username,
        role,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM sys_user
      WHERE username LIKE ?
      ORDER BY id DESC
      LIMIT ${safePageSize} OFFSET ${offset}
    `,
    [kw]
  );

  return { page: safePage, pageSize: safePageSize, total, list: rows };
}

async function createUser({ username, passwordHash, role = "admin", isActive = true }) {
  const [result] = await db.execute(
    `
      INSERT INTO sys_user (username, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `,
    [username, passwordHash, role, isActive ? 1 : 0]
  );
  return result.insertId;
}

async function setUserStatus(userId, isActive) {
  await db.execute(
    "UPDATE sys_user SET is_active = ?, updated_at = NOW() WHERE id = ?",
    [isActive ? 1 : 0, userId]
  );
}

async function setUserRole(userId, role) {
  await db.execute(
    "UPDATE sys_user SET role = ?, updated_at = NOW() WHERE id = ?",
    [role, userId]
  );
}

async function createToken({ userId, token, expiresAt }) {
  await db.execute(
    `
      INSERT INTO sys_token (user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, NOW())
    `,
    [userId, token, expiresAt]
  );
}

async function getToken(token) {
  const [rows] = await db.execute(
    `
      SELECT
        t.token,
        t.expires_at AS expiresAt,
        t.revoked_at AS revokedAt,
        u.id AS userId,
        u.username,
        u.role,
        u.is_active AS isActive
      FROM sys_token t
      JOIN sys_user u ON u.id = t.user_id
      WHERE t.token = ?
      LIMIT 1
    `,
    [token]
  );
  return rows[0] || null;
}

async function revokeToken(token) {
  await db.execute(
    "UPDATE sys_token SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL",
    [token]
  );
}

module.exports = {
  getUserByUsername,
  getUserById,
  listUsers,
  createUser,
  setUserStatus,
  setUserRole,
  createToken,
  getToken,
  revokeToken
};
