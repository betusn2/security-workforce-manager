const mysql = require('mysql2/promise');

async function checkEventTypes() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  try {
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'railway' 
        AND TABLE_NAME = 'events' 
        AND COLUMN_NAME = 'type'
    `);

    console.log('📋 Colonne type de la table events:\n');
    console.log(columns[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkEventTypes();
