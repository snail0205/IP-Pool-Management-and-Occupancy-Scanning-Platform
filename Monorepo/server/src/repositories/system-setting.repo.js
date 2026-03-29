const db = require("../config/db");

async function listSettings() {
  const [rows] = await db.execute(
    `
      SELECT
        setting_key AS settingKey,
        setting_value AS settingValue,
        description,
        updated_at AS updatedAt
      FROM sys_setting
      ORDER BY id ASC
    `
  );
  return rows;
}

async function upsertSetting({ settingKey, settingValue, description }) {
  await db.execute(
    `
      INSERT INTO sys_setting (setting_key, setting_value, description, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        description = VALUES(description),
        updated_at = NOW()
    `,
    [settingKey, settingValue, description || null]
  );
}

module.exports = {
  listSettings,
  upsertSetting
};

