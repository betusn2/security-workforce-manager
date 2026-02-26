const fs = require('fs');
const mysql = require('mysql2/promise');

const BACKUP_PATH = 'C:/Users/Home/Downloads/backup_railway_2026-02-20T22-40-04_full.sql';

async function main() {
  const content = fs.readFileSync(BACKUP_PATH, 'utf8');
  console.log('=== ANALYSE DU FICHIER BACKUP ===');
  console.log('Taille:', (content.length / 1024).toFixed(1), 'KB\n');

  const tables = ['users','attendance','assignments','incidents','badges',
    'notifications','zones','events','geo_tracking','messages','conversations',
    'sos_alerts','liveness_logs','fraud_attempts'];

  let backupCounts = {};
  for (const t of tables) {
    const regex = new RegExp('INSERT INTO `' + t + '`', 'g');
    const m = content.match(regex);
    backupCounts[t] = m ? m.length : 0;
    if (m) console.log('  BACKUP -', t + ':', m.length, 'INSERT(s)');
    else console.log('  BACKUP -', t + ': VIDE');
  }

  console.log('\n=== COMPARAISON AVEC RAILWAY ===');
  const conn = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway',
    connectTimeout: 30000
  });

  for (const t of tables) {
    try {
      const [rows] = await conn.query('SELECT COUNT(*) as c FROM `' + t + '`');
      const dbCount = rows[0].c;
      const backupHas = backupCounts[t] > 0;
      const icon = backupHas && dbCount === 0 ? '❌ MANQUE' : (dbCount > 0 ? '✅' : '⚪');
      console.log('  ' + icon + '  ' + t.padEnd(25) + 'backup=' + (backupCounts[t] > 0 ? 'OUI' : 'NON') + '  railway=' + dbCount);
    } catch(e) {
      console.log('  ⚠️  ' + t + ': ' + e.message);
    }
  }

  await conn.end();

  // Check specifically what's in users backup
  console.log('\n=== USERS DANS LE BACKUP ===');
  const userMatch = content.match(/INSERT INTO `users`[^;]+;/s);
  if (userMatch) {
    const hexStrings = userMatch[0].match(/X'([a-f0-9]+)'/g) || [];
    // Extract first_name / last_name patterns
    const emailHexes = [];
    const valRows = userMatch[0].split(/\),\s*\(/);
    console.log('Nombre de lignes users dans backup:', valRows.length);
  }
}

main().catch(console.error);
