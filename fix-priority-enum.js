const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway',
  connectTimeout: 30000
};

async function fixPriorityEnum() {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log('✅ Connecté à Railway MySQL');

    // Check current priority column
    const [cols] = await conn.query(
      "SELECT COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='events' AND COLUMN_NAME='priority'"
    );
    console.log('📋 Colonne priority actuelle:', cols[0]);

    // Check current status column
    const [statusCols] = await conn.query(
      "SELECT COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='events' AND COLUMN_NAME='status'"
    );
    console.log('📋 Colonne status actuelle:', statusCols[0]);

    // Step 1: Expand ENUM to include both old and new values
    console.log('\n🔧 Étape 1: Expansion ENUM priority...');
    await conn.query(
      "ALTER TABLE events MODIFY COLUMN priority ENUM('low','normal','medium','high','urgent','critical') DEFAULT 'normal'"
    );
    console.log('✅ ENUM élargi');

    // Step 2: Migrate old values to new ones
    const [updated1] = await conn.query(
      "UPDATE events SET priority='medium' WHERE priority='normal' OR priority IS NULL"
    );
    console.log(`✅ ${updated1.affectedRows} lignes 'normal' -> 'medium'`);
    const [updated2] = await conn.query(
      "UPDATE events SET priority='high' WHERE priority='urgent'"
    );
    console.log(`✅ ${updated2.affectedRows} lignes 'urgent' -> 'high'`);

    // Step 3: Now shrink to final ENUM
    console.log('\n🔧 Étape 2: Finalisation ENUM priority...');
    await conn.query(
      "ALTER TABLE events MODIFY COLUMN priority ENUM('low','medium','high','critical') DEFAULT 'medium'"
    );
    console.log('✅ ENUM priority final -> (low, medium, high, critical)');

    // Verify fix
    const [verify] = await conn.query(
      "SELECT COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='events' AND COLUMN_NAME='priority'"
    );
    console.log('\n✅ Colonne priority après correction:', verify[0]);

    // Also check if all other event columns exist
    const [allCols] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='events' ORDER BY ORDINAL_POSITION"
    );
    console.log('\n📋 Toutes les colonnes events:', allCols.map(c => c.COLUMN_NAME).join(', '));

    await conn.end();
    console.log('\n🎉 Terminé!');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (conn) await conn.end();
    process.exit(1);
  }
}

fixPriorityEnum();
