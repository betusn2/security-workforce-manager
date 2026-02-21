/**
 * ============================================================
 *  RESTORE-DIRECT.JS — Restauration locale → Railway MySQL
 *  Compatible avec TOUS les formats de backup (ancien et nouveau)
 *  Corrections automatiques :
 *    - Ancien escaping \' → ''
 *    - [object Object] dans colonnes JSON → null
 *    - Photos base64 (data:image) → []
 *    - Chaînes vides '' dans colonnes JSON → NULL
 * ============================================================
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// ─── Config Railway ────────────────────────────────────────
const RAILWAY = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway',
  multipleStatements: false,
  connectTimeout: 60000,
  ssl: false
};

// ─── Colonnes JSON connues par table ────────────────────────
const JSON_COLUMNS = {
  incidents:     ['photos', 'witnesses', 'actions_taken'],
  badges:        ['criteria'],
  notifications: ['metadata', 'data'],
  users:         ['permissions', 'settings', 'languages', 'specializations',
                  'bank_details', 'authorized_devices', 'device_fingerprints',
                  'notification_preferences', 'emergency_contact'],
  events:        ['settings', 'metadata'],
  assignments:   ['metadata'],
  attendance:    ['metadata'],
  activity_logs: ['old_values', 'new_values', 'device_info', 'location', 'metadata'],
};

// ─── Vérifier si une valeur SQL est du JSON valide ───────────
function isSQLStringValidJSON(sqlVal) {
  // sqlVal est une valeur SQL type 'texte' (avec quotes incluses)
  if (!sqlVal.startsWith("'")) return true; // NULL, number, etc. → pas de problème
  const inner = sqlVal.slice(1, -1).replace(/''/g, "'"); // désescaper '' → '
  try { JSON.parse(inner); return true; } catch { return false; }
}

// ─── Envelopper une valeur comme JSON string ─────────────────
function wrapAsJSONString(sqlVal) {
  if (!sqlVal.startsWith("'")) return 'NULL';
  const inner = sqlVal.slice(1, -1).replace(/''/g, "'");
  try {
    const json = JSON.stringify(inner); // produit "\"texte\""
    return "'" + json.replace(/'/g, "''") + "'";
  } catch { return 'NULL'; }
}

// ─── Nullifier les colonnes JSON d'un INSERT mono-row ────────
// Prend un INSERT à UNE SEULE ROW et remplace les valeurs JSON invalides par NULL
function nullifyInvalidJsonCols(singleRowStmt, jsonCols) {
  const headerRe = /INSERT\s+(?:IGNORE\s+)?INTO\s+`([^`]+)`\s+\(([^)]+)\)\s+VALUES\s*/i;
  const headerMatch = singleRowStmt.match(headerRe);
  if (!headerMatch) return singleRowStmt;

  const cols = headerMatch[2].split(',').map(c => c.trim().replace(/`/g, ''));
  const jsonPositions = new Set(
    jsonCols.map(jc => cols.indexOf(jc)).filter(i => i >= 0)
  );
  if (jsonPositions.size === 0) return singleRowStmt;

  const headerEnd = singleRowStmt.lastIndexOf('VALUES') + 6;
  const header = singleRowStmt.substring(0, headerEnd);

  // Parser le contenu entre ( et ) après VALUES
  const bodyStart = singleRowStmt.indexOf('(', headerEnd);
  if (bodyStart < 0) return singleRowStmt;

  const body = singleRowStmt.substring(bodyStart + 1);
  const vals = [];
  let inStr = false, val = '', depth = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (!inStr && ch === "'") { inStr = true; val += ch; continue; }
    if (inStr && ch === "'") {
      if (body[i + 1] === "'") { val += "''"; i++; continue; }
      inStr = false; val += ch; continue;
    }
    if (!inStr && ch === '(') { depth++; val += ch; continue; }
    if (!inStr && ch === ')') {
      if (depth === 0) { vals.push(val.trim()); break; }
      depth--; val += ch; continue;
    }
    if (!inStr && ch === ',' && depth === 0) { vals.push(val.trim()); val = ''; continue; }
    val += ch;
  }

  // Remplacer valeurs JSON invalides par NULL
  const fixedVals = vals.map((v, idx) => {
    if (!jsonPositions.has(idx)) return v;
    if (!v.startsWith("'")) return v; // NULL, number, etc.
    const inner = v.slice(1, -1).replace(/''/g, "'");
    try { JSON.parse(inner); return v; } catch { return 'NULL'; }
  });

  return header + ' (' + fixedVals.join(', ') + ')';
}

// ─── Corriger les colonnes JSON d'un INSERT en fixant les valeurs non-JSON ──
// Garde simplement la fonction minimale — la vraie correction se fait dans le fallback
function fixJSONColumnValues(stmt, tableName, jsonCols) {
  // Pour les INSERTs multi-rows, on laisse la correction au fallback (splitInsertRows + nullifyInvalidJsonCols)
  // Ici on applique uniquement les corrections globales déjà faites dans fixStatement
  return stmt;
}

// ─── Trouver le backup le plus récent ───────────────────────
function findLatestBackup() {
  const downloadsDir = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, 'Downloads')
    : 'C:\\Users\\Home\\Downloads';
  
  if (!fs.existsSync(downloadsDir)) return null;
  
  const files = fs.readdirSync(downloadsDir)
    .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(downloadsDir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  
  return files.length > 0 ? path.join(downloadsDir, files[0].name) : null;
}

// ─── Découper un INSERT multi-rows en INSERTs individuels ───
function splitInsertRows(stmt) {
  // Trouver le vrai mot-clé VALUES (précédé par ) de la liste de colonnes)
  // Évite de matcher 'old_values', 'new_values' dans les noms de colonnes
  const valuesRe = /\)\s*(VALUES)\s*/i;
  const valuesMatch = valuesRe.exec(stmt);
  if (!valuesMatch) return [stmt];
  
  // header = tout jusqu'à (et incluant) VALUES
  const header = stmt.substring(0, valuesMatch.index + valuesMatch[0].length).trimEnd();
  const body = stmt.substring(valuesMatch.index + valuesMatch[0].length).trim();
  
  const rows = [];
  let depth = 0, inStr = false, rowStart = -1;
  
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    
    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") { i++; continue; } // '' = apostrophe SQL
        inStr = false;
      }
      continue;
    }
    
    if (ch === "'") { inStr = true; continue; }
    if (ch === '(') {
      depth++;
      if (depth === 1) rowStart = i;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && rowStart >= 0) {
        rows.push(body.substring(rowStart, i + 1));
        rowStart = -1;
      }
    }
  }
  
  return rows.length > 0
    ? rows.map(row => `${header} ${row}`)
    : [stmt];
}

// ─── Corriger un statement INSERT pour compatibilité MySQL ──
function fixStatement(stmt) {
  // Ne pas toucher aux CREATE TABLE, DROP, SET etc.
  if (!stmt.toUpperCase().startsWith('INSERT')) return stmt;

  let fixed = stmt;

  // 1. Ancien escaping \' → '' (style SQL standard)
  fixed = fixed.replace(/\\'/g, "''");

  // 2. Photos/images base64 embedded → tableau JSON vide
  //    Couvre: 'data:image/jpeg;base64,...', 'data:,' et autres data URLs
  fixed = fixed.replace(/'data:[^']*'/g, "'[]'");

  // 3. [object Object] → null JSON valide
  fixed = fixed.replace(/'\[object Object\]'/g, "'null'");

  // 3b. Valeurs JS invalides comme JSON → null
  fixed = fixed.replace(/'undefined'/gi, 'NULL');
  fixed = fixed.replace(/'NaN'/gi, 'NULL');
  fixed = fixed.replace(/'Infinity'/gi, 'NULL');
  fixed = fixed.replace(/'- ?Infinity'/gi, 'NULL');

  // 4. Toutes les chaînes vides '' → NULL
  //    Approche en 3 passes pour couvrir tous les cas possibles
  let prev;
  do {
    prev = fixed;
    fixed = fixed.replace(/,\s*''\s*(?=[,)])/g, ', NULL'); // milieu ou fin
    fixed = fixed.replace(/\(\s*''\s*,/g, '(NULL,');       // début d'une row
    fixed = fixed.replace(/\(\s*''\s*\)/g, '(NULL)');      // seule valeur
  } while (fixed !== prev);

  // 5. Fallback global : si '' reste encore (cas borders), remplacer tout
  //    (ne casse pas les INSERT car '' dans JSON = invalide de toute façon)
  fixed = fixed.replace(/(?<=[\s,(])''\s*(?=[,)\s])/g, 'NULL');

  // 6. Corriger les valeurs non-JSON dans les colonnes JSON connues
  //    (ex: adresse texte dans activity_logs.location)
  for (const [table, jsonCols] of Object.entries(JSON_COLUMNS)) {
    if (fixed.includes('`' + table + '`')) {
      fixed = fixJSONColumnValues(fixed, table, jsonCols);
      break;
    }
  }

  return fixed;
}

// ─── Afficher le résumé des tables ──────────────────────────
async function showTables(conn, label) {
  console.log(`\n=== ${label} ===`);
  const [tables] = await conn.query('SHOW TABLES');
  let total = 0;
  const results = {};
  for (const t of tables) {
    const name = Object.values(t)[0];
    const [[row]] = await conn.query(`SELECT COUNT(*) as c FROM \`${name}\``);
    results[name] = row.c;
    total += row.c;
  }
  for (const [name, count] of Object.entries(results)) {
    const icon = count > 0 ? '✅' : '⚠️  VIDE';
    console.log(`  ${icon}  ${name.padEnd(28)} ${count} lignes`);
  }
  console.log(`\n  TOTAL: ${total} lignes`);
  return results;
}

// ─── MAIN ────────────────────────────────────────────────────
async function restore() {
  // Trouver le fichier backup
  let backupFile = process.argv[2];

  if (backupFile) {
    backupFile = backupFile.replace(/^["']|["']$/g, '');
  }

  if (!backupFile || !fs.existsSync(backupFile)) {
    backupFile = findLatestBackup();
    if (!backupFile) {
      console.error('❌ Aucun fichier backup trouvé dans Downloads.');
      console.error('   Usage: node restore-direct.js "C:\\chemin\\backup.sql"');
      process.exit(1);
    }
    console.log(`📁 Backup auto-détecté: ${path.basename(backupFile)}`);
  }

  const stats = fs.statSync(backupFile);
  console.log(`\n📁 Fichier : ${path.basename(backupFile)}`);
  console.log(`📏 Taille  : ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const sqlContent = fs.readFileSync(backupFile, 'utf8');

  console.log('\n🔌 Connexion à Railway...');
  const conn = await mysql.createConnection(RAILWAY);
  console.log('✅ Connecté à Railway');

  // ─── Charger les colonnes JSON réelles depuis Railway ────────
  const dbJsonCols = {};
  const [tables] = await conn.query('SHOW TABLES');
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const jsonCols = cols.filter(c => c.Type === 'json').map(c => c.Field);
    if (jsonCols.length > 0) dbJsonCols[tableName] = jsonCols;
  }
  // Merge avec JSON_COLUMNS statiques (pour la compatibilité)
  for (const [t, cols] of Object.entries(JSON_COLUMNS)) {
    if (!dbJsonCols[t]) dbJsonCols[t] = [];
    cols.forEach(c => { if (!dbJsonCols[t].includes(c)) dbJsonCols[t].push(c); });
  }

  // État avant
  const beforeCounts = await showTables(conn, 'ÉTAT AVANT RESTAURATION');

  await conn.query('SET FOREIGN_KEY_CHECKS=0').catch(() => {});
  await conn.query('SET SESSION sql_mode=""').catch(() => {});

  const rawStmts = sqlContent
    .split(/;\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.startsWith('--') && !s.startsWith('/*'));

  console.log(`\n🔄 Restauration de ${rawStmts.length} instructions...\n`);

  let ok = 0, fixed_ok = 0, fail = 0;
  const errors = [];

  for (const raw of rawStmts) {
    let stmt = fixStatement(raw);
    const wasFixed = stmt !== raw;

    try {
      const execStmt = stmt.startsWith('INSERT INTO')
        ? stmt.replace(/^INSERT INTO/, 'INSERT IGNORE INTO')
        : stmt;
      await conn.query(execStmt);
      if (wasFixed) fixed_ok++;
      else ok++;
    } catch (e) {
      // Si erreur JSON → fallback ligne-par-ligne avec NULL pour colonnes JSON
      if (e.message.includes('Invalid JSON') || e.message.includes('JSON text')) {
        const subStmts = splitInsertRows(stmt);
        if (subStmts.length > 1) {
          let subOk = 0, subFail = 0;
          for (let sub of subStmts) {
            try {
              const execSub = sub.replace(/^INSERT INTO/, 'INSERT IGNORE INTO');
              await conn.query(execSub);
              subOk++;
            } catch(e2) {
              // Si JSON error sur une row individuelle → nullify les colonnes JSON invalides
              if ((e2.message.includes('Invalid JSON') || e2.message.includes('JSON text')) && dbJsonCols) {
                let nullified = sub;
                for (const [tableName, jsonCols] of Object.entries(dbJsonCols)) {
                  if (sub.includes('`' + tableName + '`')) {
                    nullified = nullifyInvalidJsonCols(sub, jsonCols);
                    break;
                  }
                }
                if (nullified !== sub) {
                  try {
                    await conn.query(nullified.replace(/^INSERT INTO/, 'INSERT IGNORE INTO'));
                    subOk++;
                    continue;
                  } catch(e3) { /* log below */ }
                }
              }
              subFail++;
              errors.push({ stmt: sub.substring(0, 100), err: e2.message.substring(0, 150) });
            }
          }
          fixed_ok += subOk;
          fail += subFail;
          if (subOk > 0) continue;
        }
      }
      fail++;
      errors.push({ stmt: raw.substring(0, 100), err: e.message.substring(0, 150) });
    }
  }

  await conn.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});

  console.log(`✅ ${ok} OK  |  🔧 ${fixed_ok} corrigés & OK  |  ❌ ${fail} erreurs`);

  const realErrors = errors.filter(e =>
    !e.err.includes('already exists') &&
    !e.err.includes('Duplicate entry') &&
    !e.err.includes('Table')
  );
  if (realErrors.length > 0) {
    console.log(`\n⚠️  ${realErrors.length} erreur(s) réelle(s):`);
    realErrors.slice(0, 10).forEach(e =>
      console.log(`  • ${e.stmt.substring(0,80)}...\n    → ${e.err}`)
    );
  }

  const afterCounts = await showTables(conn, 'ÉTAT APRÈS RESTAURATION');

  console.log('\n=== RÉSUMÉ DES CHANGEMENTS ===');
  let anyChange = false;
  for (const [table, after] of Object.entries(afterCounts)) {
    const before = beforeCounts[table] || 0;
    if (after !== before) {
      console.log(`  📥 ${table}: ${before} → ${after} lignes (+${after - before})`);
      anyChange = true;
    }
  }
  if (!anyChange) console.log('  (aucun changement — données déjà à jour)');

  // Fix soft-deletes: le backup peut contenir deleted_at non null
  // → restaurer tous les enregistrements pour qu'ils soient visibles dans l'API
  console.log('\n🔓 Restauration des enregistrements soft-deleted...');
  const softDeleteTables = ['users','events','incidents','zones','assignments','notifications','badges','activity_logs'];
  for (const t of softDeleteTables) {
    try {
      const [[{ c }]] = await conn.query(`SELECT COUNT(*) as c FROM ${t} WHERE deleted_at IS NOT NULL`);
      if (c > 0) {
        await conn.query(`UPDATE ${t} SET deleted_at=NULL WHERE deleted_at IS NOT NULL`);
        console.log(`  ✅ ${t}: ${c} enregistrement(s) restauré(s)`);
      }
    } catch(e) { /* table sans deleted_at, ignorer */ }
  }

  const [[adminCheck]] = await conn.query(
    `SELECT COUNT(*) as c FROM users WHERE email='admin@security.com'`
  );
  if (adminCheck.c === 0) {
    try {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('Admin123!', 12);
      const id = require('crypto').randomUUID();
      await conn.query(
        `INSERT INTO users (id,employee_id,first_name,last_name,email,password,phone,role,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
        [id, 'ADMIN001', 'Administrateur', 'Principal', 'admin@security.com', hash, '+33600000000', 'admin', 'active']
      );
      console.log('\n🔑 Admin recréé : admin@security.com / Admin123!');
    } catch(e) {
      console.log('\n⚠️  Admin non recréé:', e.message);
    }
  } else {
    console.log('\n✅ Compte admin présent');
  }

  await conn.end();
  console.log('\n🎉 Restauration terminée ! Actualisez le dashboard.\n');
}

restore().catch(err => {
  console.error('\n❌ ERREUR FATALE:', err.message);
  process.exit(1);
});
