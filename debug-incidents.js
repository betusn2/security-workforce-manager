const fs = require('fs');
const mysql = require('mysql2/promise');

const BACKUP_PATH = 'C:/Users/Home/Downloads/backup_railway_2026-02-20T22-40-04_full.sql';

async function main() {
  const content = fs.readFileSync(BACKUP_PATH, 'utf8');
  
  // Extraire proprement avec split comme restore-direct.js
  const stmts = content.split(/;\r?\n/).map(s => s.trim()).filter(s => s.length > 5);
  const incStmts = stmts.filter(s => s.includes('INSERT INTO `incidents`'));
  
  console.log('Nb INSERT stmts pour incidents:', incStmts.length);
  if (!incStmts.length) { console.log('VIDE'); return; }
  
  let insertText = incStmts[0];
  console.log('Longueur INSERT:', insertText.length, 'chars');

  // Diagnostics
  const hasDataImage = insertText.includes('data:image');
  const hasEscapedQuote = insertText.includes("\\'");
  const hasObjectObject = insertText.includes('[object Object]');
  console.log('data:image présent:', hasDataImage);
  console.log("\\' (ancien escaping) présent:", hasEscapedQuote);
  console.log('[object Object] présent:', hasObjectObject);

  // === FIXES ===
  // 1. Remplacer \' par '' (SQL standard)
  insertText = insertText.replace(/\\'/g, "''");
  
  // 2. Remplacer data URLs base64 par JSON array vide
  const before2 = insertText.length;
  insertText = insertText.replace(/'data:[A-Za-z0-9+\/;,=\r\n]+'/g, "'[]'");
  console.log('Fix2 data URLs: longueur', before2, '->', insertText.length);
  
  // 3. Remplacer [object Object] par null JSON valide
  insertText = insertText.replace(/'\[object Object\]'/g, "'null'");

  // 4. Remplacer toutes les chaînes vides '' par NULL
  //    Utiliser lookahead (?=,) pour ne pas consommer la virgule suivante
  //    (permet de remplacer des '' consécutifs comme , '', '',)
  const emptyBefore = (insertText.match(/''/g) || []).length;
  insertText = insertText.replace(/,\s*''\s*(?=[,)])/g, ", NULL");
  const emptyAfter = (insertText.match(/''/g) || []).length;
  console.log('Fix4 empty strings: avant', emptyBefore, '->', emptyAfter);

  console.log('\nFixes 1-4 appliqués. Tentative INSERT IGNORE...');

  const conn = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net', port: 20601,
    user: 'root', password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway', connectTimeout: 30000
  });

  try {
    const sql = insertText.replace(/^INSERT INTO/, 'INSERT IGNORE INTO');
    await conn.query(sql);
    const [[row]] = await conn.query('SELECT COUNT(*) as c FROM incidents');
    console.log('✅ Succès:', row.c, 'lignes dans incidents');
  } catch(e) {
    console.log('❌ Erreur:', e.message.substring(0, 400));
    // Sauvegarder pour inspection manuelle
    fs.writeFileSync('C:/Users/Home/Downloads/incidents_debug.sql', insertText);
    console.log('SQL debug sauvegardé dans C:/Users/Home/Downloads/incidents_debug.sql');
  }

  await conn.end();
}

main().catch(console.error);
