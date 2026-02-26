const fs = require('fs');
const mysql = require('mysql2/promise');

// ─── Copy des fonctions depuis restore-direct.js ─────────────
function splitInsertRows(stmt) {
  const valuesIdx = stmt.toUpperCase().indexOf('VALUES');
  if (valuesIdx < 0) return [stmt];
  const header = stmt.substring(0, valuesIdx + 6);
  const body = stmt.substring(valuesIdx + 6).trim();
  const rows = [];
  let depth = 0, inStr = false, rowStart = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") { i++; continue; }
        inStr = false;
      }
      continue;
    }
    if (ch === "'") { inStr = true; continue; }
    if (ch === '(') { depth++; if (depth === 1) rowStart = i; }
    else if (ch === ')') {
      depth--;
      if (depth === 0 && rowStart >= 0) { rows.push(body.substring(rowStart, i + 1)); rowStart = -1; }
    }
  }
  return rows.length > 0 ? rows.map(row => `${header} ${row}`) : [stmt];
}

function nullifyInvalidJsonCols(singleRowStmt, jsonCols) {
  const headerRe = /INSERT\s+(?:IGNORE\s+)?INTO\s+`([^`]+)`\s+\(([^)]+)\)\s+VALUES\s*/i;
  const headerMatch = singleRowStmt.match(headerRe);
  if (!headerMatch) { console.log('  headerRe no match!'); return singleRowStmt; }
  
  const cols = headerMatch[2].split(',').map(c => c.trim().replace(/`/g, ''));
  const jsonPositions = new Set(jsonCols.map(jc => cols.indexOf(jc)).filter(i => i >= 0));
  console.log('  jsonPositions:', [...jsonPositions], '(cols:', jsonCols.join(','), ')');
  if (jsonPositions.size === 0) { console.log('  No JSON positions found!'); return singleRowStmt; }

  const headerEnd = singleRowStmt.lastIndexOf('VALUES') + 6;
  const bodyStart = singleRowStmt.indexOf('(', headerEnd);
  if (bodyStart < 0) { console.log('  bodyStart not found!'); return singleRowStmt; }

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
  
  console.log('  Parsed', vals.length, 'cols total');
  jsonPositions.forEach(pos => {
    console.log(`  Col[${pos}] (${cols[pos]}):`, JSON.stringify(vals[pos]?.substring(0, 60)));
  });

  const fixedVals = vals.map((v, idx) => {
    if (!jsonPositions.has(idx)) return v;
    if (!v.startsWith("'")) return v;
    const inner = v.slice(1, -1).replace(/''/g, "'");
    try { JSON.parse(inner); return v; } 
    catch { console.log(`  -> Fixing col[${idx}] to NULL`); return 'NULL'; }
  });

  const header = singleRowStmt.substring(0, headerEnd);
  return header + ' (' + fixedVals.join(', ') + ')';
}

async function main() {
  const raw = fs.readFileSync('C:/Users/Home/Downloads/al_debug.sql', 'utf8');
  
  // Appliquer fix1 (\\' -> '')
  const fixed = raw.replace(/\\'/g, "''").replace(/'\[object Object\]'/g, "'null'");
  
  const rows = splitInsertRows(fixed);
  console.log('Nombre de rows activity_logs:', rows.length);
  
  const jsonCols = ['old_values', 'new_values', 'device_info', 'location', 'metadata'];
  
  // Tester la 2ème row (qui a la location problématique)
  let testRow = null;
  for (const row of rows) {
    if (row.includes('Rue Oujda') || row.includes('Arrondissement')) {
      testRow = row;
      break;
    }
  }
  
  if (!testRow) {
    // Prendre la première row
    testRow = rows[0];
    console.log('Row cible non trouvée, test avec row 1');
  }
  
  console.log('\n=== TEST ROW ===');
  console.log('Longueur row:', testRow.length);
  
  const nullified = nullifyInvalidJsonCols(testRow, jsonCols);
  console.log('\nOriginal === Nullified?', nullified === testRow);
  
  if (nullified !== testRow) {
    // Test sur Railway
    const conn = await mysql.createConnection({
      host: 'mainline.proxy.rlwy.net', port: 20601,
      user: 'root', password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
      database: 'railway', connectTimeout: 30000
    });
    
    const execStmt = nullified.replace(/^INSERT INTO/, 'INSERT IGNORE INTO');
    console.log('\nTest INSERT:');
    console.log(execStmt.substring(0, 200));
    
    try {
      await conn.query(execStmt);
      console.log('✅ Succès!');
    } catch(e) {
      console.log('❌ Erreur:', e.message.substring(0, 200));
    }
    
    await conn.end();
  }
}

main().catch(console.error);
