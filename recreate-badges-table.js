const mysql = require('mysql2/promise');

async function recreateBadgesTable() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');
  console.log('🔧 RECRÉATION DE LA TABLE BADGES\n');

  try {
    // 1. Drop user_badges first (has foreign key to badges)
    console.log('🗑️  1. Suppression table user_badges...');
    await connection.execute(`DROP TABLE IF EXISTS user_badges`);
    console.log('   ✅ Table user_badges supprimée\n');

    // 2. Drop existing badges table
    console.log('🗑️  2. Suppression ancienne table badges...');
    await connection.execute(`DROP TABLE IF EXISTS badges`);
    console.log('   ✅ Table badges supprimée\n');

    // 3. Recreate badges table with correct structure
    console.log('🏗️  3. Création nouvelle table badges...');
    await connection.execute(`
      CREATE TABLE badges (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        icon VARCHAR(10) NULL,
        color VARCHAR(20) NULL,
        type VARCHAR(50) NULL,
        criteria JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ Table badges créée avec la bonne structure\n');

    // 4. Recreate user_badges table with proper foreign keys
    console.log('🔗 4. Création table user_badges...');
    await connection.execute(`
      CREATE TABLE user_badges (
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
    console.log('   ✅ Table user_badges créée\n');

    // 5. Verify structure
    console.log('✅ 5. Vérification structure badges...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'badges'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('   Colonnes:');
    columns.forEach(col => {
      console.log(`      ${col.COLUMN_NAME.padEnd(20)} (${col.DATA_TYPE})`);
    });

    console.log('\n═'.repeat(70));
    console.log('✅ TABLE BADGES RECRÉÉE AVEC SUCCÈS!');
    console.log('═'.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

recreateBadgesTable();
