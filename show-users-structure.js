// Afficher la structure exacte de la table users
const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway'
};

async function showStructure() {
  try {
    const connection = await mysql.createConnection(config);
    
    console.log('📋 COLONNES DE LA TABLE USERS:');
    console.log('='.repeat(80));
    
    const [columns] = await connection.execute(`SHOW COLUMNS FROM users`);
    
    columns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.Field} - ${col.Type} - ${col.Null} - ${col.Key}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total colonnes: ${columns.length}`);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

showStructure();
