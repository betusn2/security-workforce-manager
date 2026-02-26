const fs = require('fs');
const mysql = require('mysql2/promise');

const BACKUP_PATH = 'C:/Users/Home/Downloads/backup_railway_2026-02-20T22-40-04_full.sql';

function fixInsertSQL(tableName, insertSQL) {
  let fixed = insertSQL;

  // 1. Remplacer '[object Object]' par 'null' (JSON valide)
  fixed = fixed.replace(/'\\[object Object\\]'/g, "'null'");
  fixed = fixed.replace(/'\[object Object\]'/g, "'null'");

  // 2. Convertir l'escaping ancien style \' vers '' (style SQL standard)
  // On fait ça prudemment : \' -> '' mais seulement à l'intérieur des strings
  // Approche simple : remplacer \' par '' globalement dans le INSERT
  fixed = fixed.replace(/\\'/g, "''");

  // 3. Pour incidents/photos: les data:image/... peuvent causer des problèmes
  // Remplacer le champ photos par NULL si c'est un data URL incomplet
  if (tableName === 'incidents') {
    // Remplacer les data URLs courtes/invalides
    fixed = fixed.replace(/'data:,'/g, "NULL");
    fixed = fixed.replace(/'data:[^']{0,30}'/g, "NULL");
  }

  return fixed;
}

async function main() {
  const content = fs.readFileSync(BACKUP_PATH, 'utf8');
  
  const conn = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway',
    multipleStatements: false,
    connectTimeout: 30000
  });

  console.log('✅ Connecté à Railway\n');

  const TABLES = ['incidents', 'badges', 'notifications'];

  for (const table of TABLES) {
    console.log(`\n--- ${table} ---`);
    
    const regex = new RegExp('INSERT INTO `' + table + '`[^;]+;', 's');
    const match = content.match(regex);
    if (!match) { console.log('  Pas de données dans backup'); continue; }

    const [[before]] = await conn.query('SELECT COUNT(*) as c FROM `' + table + '`');
    console.log(`  Avant: ${before.c} lignes`);

    // Appliquer les corrections
    const fixedSQL = fixInsertSQL(table, match[0]);
    
    // Essayer INSERT IGNORE avec le SQL corrigé
    try {
      const sqlToRun = fixedSQL.replace(/^INSERT INTO/, 'INSERT IGNORE INTO');
      await conn.query(sqlToRun);
      const [[after]] = await conn.query('SELECT COUNT(*) as c FROM `' + table + '`');
      console.log(`  ✅ ${after.c} lignes restaurées`);
    } catch(e) {
      console.log(`  ❌ Erreur: ${e.message.substring(0, 300)}`);
      
      // Afficher le début pour diagnostic
      console.log('  Début SQL corrigé:\n' + fixedSQL.substring(0, 500));
    }
  }

  // Vérification finale
  console.log('\n=== RÉSUMÉ FINAL ===');
  const tables = ['users','attendance','assignments','incidents','badges','notifications','zones','events'];
  for (const t of tables) {
    const [[row]] = await conn.query('SELECT COUNT(*) as c FROM `' + t + '`');
    const icon = row.c > 0 ? '✅' : '⚠️  VIDE';
    console.log(`  ${icon}  ${t.padEnd(20)} ${row.c} lignes`);
  }

  await conn.end();
}

main().catch(console.error);
