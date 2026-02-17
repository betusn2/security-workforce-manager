const mysql = require('mysql2/promise');

async function checkAllTables() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  try {
    // Check critical tables structure
    const criticalTables = [
      'users',
      'events', 
      'assignments',
      'attendance',
      'notifications',
      'zones'
    ];

    for (const table of criticalTables) {
      console.log(`\n📋 Table: ${table}`);
      console.log('─'.repeat(60));
      
      try {
        const [columns] = await connection.execute(
          `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [table]
        );

        if (columns.length === 0) {
          console.log('❌ Table does not exist!');
          continue;
        }

        // Check primary key
        const pk = columns.find(c => c.COLUMN_KEY === 'PRI');
        if (pk) {
          console.log(`🔑 Primary Key: ${pk.COLUMN_NAME} (${pk.DATA_TYPE})`);
        } else {
          console.log('❌ No primary key found!');
        }

        // Check important columns
        const colNames = columns.map(c => c.COLUMN_NAME);
        console.log(`📊 Total columns: ${columns.length}`);
        console.log(`📝 Key columns: ${colNames.slice(0, 10).join(', ')}${columns.length > 10 ? '...' : ''}`);

        // Check if has data
        const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`📦 Rows: ${count[0].count}`);

        // For problematic tables, show sample row
        if (['assignments', 'attendance'].includes(table) && count[0].count > 0) {
          const [sample] = await connection.execute(`SELECT * FROM ${table} LIMIT 1`);
          console.log('📄 Sample row columns:', Object.keys(sample[0]).join(', '));
        }

      } catch (error) {
        console.log(`❌ Error checking ${table}:`, error.message);
      }
    }

    // Check for foreign key issues
    console.log('\n\n🔗 Checking Foreign Key Constraints...');
    console.log('═'.repeat(60));
    
    const [fks] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'railway'
        AND REFERENCED_TABLE_NAME IS NOT NULL
        AND TABLE_NAME IN ('assignments', 'attendance', 'notifications', 'events')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);

    for (const fk of fks) {
      console.log(`\n${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      
      // Check if data types match
      const [sourceCol] = await connection.execute(
        `SELECT DATA_TYPE, COLUMN_TYPE 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'railway' 
           AND TABLE_NAME = ? 
           AND COLUMN_NAME = ?`,
        [fk.TABLE_NAME, fk.COLUMN_NAME]
      );
      
      const [targetCol] = await connection.execute(
        `SELECT DATA_TYPE, COLUMN_TYPE 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'railway' 
           AND TABLE_NAME = ? 
           AND COLUMN_NAME = ?`,
        [fk.REFERENCED_TABLE_NAME, fk.REFERENCED_COLUMN_NAME]
      );

      if (sourceCol.length && targetCol.length) {
        const match = sourceCol[0].COLUMN_TYPE === targetCol[0].COLUMN_TYPE;
        console.log(`   Source: ${sourceCol[0].COLUMN_TYPE}`);
        console.log(`   Target: ${targetCol[0].COLUMN_TYPE}`);
        console.log(`   ${match ? '✅ Match' : '❌ MISMATCH!'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkAllTables();
