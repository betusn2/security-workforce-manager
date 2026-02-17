const mysql = require('mysql2/promise');
const crypto = require('crypto');

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createUserBadgesTable() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  try {
    // Create user_badges table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        badge_id CHAR(36) NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_by CHAR(36) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_badge (user_id, badge_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Table user_badges créée avec succès!');

    // Verify table structure
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'user_badges'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n📋 Structure de user_badges:');
    columns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.COLUMN_KEY ? '[' + col.COLUMN_KEY + ']' : ''}`);
    });

    console.log('\n════════════════════════════════════════');
    console.log('✅ Table user_badges prête!');
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

createUserBadgesTable();
