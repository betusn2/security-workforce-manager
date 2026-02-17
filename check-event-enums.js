const mysql = require('mysql2/promise');

async function checkEventEnums() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');
  console.log('📋 ENUM COLUMNS DE LA TABLE EVENTS\n');

  try {
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'railway' 
        AND TABLE_NAME = 'events' 
        AND DATA_TYPE = 'enum'
      ORDER BY ORDINAL_POSITION
    `);

    for (const col of columns) {
      console.log(`${col.COLUMN_NAME}:`);
      console.log(`   ${col.COLUMN_TYPE}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkEventEnums();
