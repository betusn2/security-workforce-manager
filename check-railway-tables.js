const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway\n');
  console.log('=== ÉTAT DES TABLES ===\n');

  const [tables] = await conn.query('SHOW TABLES');
  let totalRows = 0;

  for (const t of tables) {
    const name = Object.values(t)[0];
    try {
      const [[row]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${name}\``);
      totalRows += row.cnt;
      const status = row.cnt === 0 ? '⚠️  VIDE' : '✅';
      console.log(`  ${status}  ${name.padEnd(35)} ${row.cnt} lignes`);
    } catch (e) {
      console.log(`  ❌  ${name.padEnd(35)} ERREUR: ${e.message}`);
    }
  }

  console.log(`\n=== TOTAL : ${tables.length} tables, ${totalRows} lignes ===`);
  await conn.end();
}

check().catch(console.error);
