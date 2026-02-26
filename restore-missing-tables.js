const fs = require('fs');
const mysql = require('mysql2/promise');

const BACKUP_PATH = 'C:/Users/Home/Downloads/backup_railway_2026-02-20T22-40-04_full.sql';
const MISSING_TABLES = ['incidents', 'badges', 'notifications'];

async function fixEscaping(sql) {
  // Ce backup utilise l'ancien format avec \' — on doit convertir en hex
  // Mais d'abord essayons direct, sinon on extrait et reconvertit
  return sql;
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

  for (const table of MISSING_TABLES) {
    console.log(`\n--- Restauration de ${table} ---`);
    
    // Extraire l'INSERT de ce table
    const regex = new RegExp('INSERT INTO `' + table + '`[^;]+;', 's');
    const match = content.match(regex);
    
    if (!match) {
      console.log(`  ⚠️  Pas de données pour ${table} dans le backup`);
      continue;
    }

    const insertSQL = match[0];
    console.log(`  Taille INSERT: ${(insertSQL.length/1024).toFixed(1)} KB`);
    
    // Compter les lignes (split par ), ()
    const valueRows = insertSQL.split(/\),\s*\(X'|,\s*\(X'/);
    console.log(`  Estimation lignes: ~${valueRows.length}`);

    // Vérifier l'état avant
    const [[before]] = await conn.query('SELECT COUNT(*) as c FROM `' + table + '`');
    console.log(`  Avant: ${before.c} lignes`);

    // Essayer l'INSERT direct
    try {
      await conn.query(insertSQL);
      const [[after]] = await conn.query('SELECT COUNT(*) as c FROM `' + table + '`');
      console.log(`  ✅ Succès! ${after.c} lignes restaurées`);
    } catch(e) {
      console.log(`  ❌ Erreur: ${e.message.substring(0, 200)}`);
      
      // Essayer avec IGNORE
      try {
        const insertIgnore = insertSQL.replace(/^INSERT INTO/, 'INSERT IGNORE INTO');
        await conn.query(insertIgnore);
        const [[after]] = await conn.query('SELECT COUNT(*) as c FROM `' + table + '`');
        console.log(`  ✅ INSERT IGNORE réussi: ${after.c} lignes`);
      } catch(e2) {
        console.log(`  ❌ Même avec IGNORE: ${e2.message.substring(0, 300)}`);
        
        // Afficher les 500 premiers caractères de l'INSERT pour diagnostic
        console.log('\n  === DEBUT DU INSERT (diagnostic) ===');
        console.log(insertSQL.substring(0, 800));
        console.log('  === FIN ===\n');
      }
    }
  }

  await conn.end();
  console.log('\n=== Résumé final ===');
}

main().catch(console.error);
