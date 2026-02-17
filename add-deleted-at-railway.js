const mysql = require('mysql2/promise');

async function addDeletedAtColumn() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  try {
    // Get all tables
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'railway' 
        AND TABLE_TYPE = 'BASE TABLE'
    `);

    console.log(`📋 Found ${tables.length} tables\n`);

    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      // Check if deleted_at column exists
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'railway' 
          AND TABLE_NAME = ? 
          AND COLUMN_NAME = 'deleted_at'
      `, [tableName]);

      if (columns.length === 0) {
        console.log(`⚠️  ${tableName} - Missing deleted_at column`);
        
        try {
          await connection.execute(`
            ALTER TABLE \`${tableName}\` 
            ADD COLUMN deleted_at DATETIME DEFAULT NULL
          `);
          console.log(`   ✅ Added deleted_at column to ${tableName}`);
        } catch (error) {
          console.log(`   ❌ Failed to add deleted_at to ${tableName}: ${error.message}`);
        }
      } else {
        console.log(`✅ ${tableName} - Has deleted_at column`);
      }
    }

    console.log('\n════════════════════════════════════════');
    console.log('✅ All tables updated with deleted_at column!');
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

addDeletedAtColumn();
