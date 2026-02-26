const fs = require('fs');
const mysql = require('mysql2/promise');

// Copy fixStatement from restore-direct.js
function fixStatement(stmt) {
  if (!stmt.toUpperCase().startsWith('INSERT')) return stmt;
  let fixed = stmt;
  fixed = fixed.replace(/\\'/g, "''");
  fixed = fixed.replace(/'data:[^']*'/g, "'[]'");
  fixed = fixed.replace(/'\[object Object\]'/g, "'null'");
  fixed = fixed.replace(/'undefined'/gi, 'NULL');
  fixed = fixed.replace(/'NaN'/gi, 'NULL');
  fixed = fixed.replace(/'Infinity'/gi, 'NULL');
  let prev;
  do {
    prev = fixed;
    fixed = fixed.replace(/,\s*''\s*(?=[,)])/g, ', NULL');
    fixed = fixed.replace(/\(\s*''\s*,/g, '(NULL,');
    fixed = fixed.replace(/\(\s*''\s*\)/g, '(NULL)');
  } while (fixed !== prev);
  fixed = fixed.replace(/(?<=[\s,(])''\s*(?=[,)\s])/g, 'NULL');
  return fixed;
}

async function main() {
  const raw = fs.readFileSync('C:/Users/Home/Downloads/al_debug.sql', 'utf8');
  console.log('Longueur brute:', raw.length);
  
  const fixed = fixStatement(raw);
  console.log('Longueur après fix:', fixed.length);
  console.log('[object Object] restants:', (fixed.match(/\[object Object\]/g) || []).length);
  console.log("'' restants:", (fixed.match(/''/g) || []).length);
  
  fs.writeFileSync('C:/Users/Home/Downloads/al_fixed.sql', fixed);
  console.log('Fixed sauvegardé');

  // Tester directement sur Railway
  const conn = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net', port: 20601,
    user: 'root', password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway', connectTimeout: 30000
  });

  const [[before]] = await conn.query('SELECT COUNT(*) as c FROM activity_logs');
  console.log('\nAvant:', before.c, 'activity_logs');

  try {
    await conn.query(fixed.replace(/^INSERT INTO/, 'INSERT IGNORE INTO'));
    const [[after]] = await conn.query('SELECT COUNT(*) as c FROM activity_logs');
    console.log('✅ Succès:', after.c, 'activity_logs');
  } catch(e) {
    console.log('❌ Erreur:', e.message.substring(0, 300));
    
    // Afficher la position dans le SQL fixed où ça plante
    const match = e.message.match(/position (\d+)/);
    if (match) {
      const sqlMsg = e.sqlMessage || e.message;
      console.log('SQL Message:', sqlMsg);
    }
  }

  await conn.end();
}

main().catch(console.error);
