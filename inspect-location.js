const fs = require('fs');

function fixStatement(stmt) {
  if (!stmt.toUpperCase().startsWith('INSERT')) return stmt;
  let fixed = stmt;
  fixed = fixed.replace(/\\'/g, "''");
  fixed = fixed.replace(/'data:[^']*'/g, "'[]'");
  fixed = fixed.replace(/'\[object Object\]'/g, "'null'");
  fixed = fixed.replace(/'undefined'/gi, 'NULL');
  fixed = fixed.replace(/'NaN'/gi, 'NULL');
  let prev;
  do {
    prev = fixed;
    fixed = fixed.replace(/,\s*''\s*(?=[,)])/g, ', NULL');
    fixed = fixed.replace(/\(\s*''\s*,/g, '(NULL,');
    fixed = fixed.replace(/\(\s*''\s*\)/g, '(NULL)');
  } while (fixed !== prev);
  return fixed;
}

const raw = fs.readFileSync('C:/Users/Home/Downloads/al_debug.sql', 'utf8');
const fixed = fixStatement(raw);

// Trouver l'index de location dans les colonnes
const headerMatch = fixed.match(/INSERT INTO `activity_logs` \(([^)]+)\) VALUES/);
if (!headerMatch) { console.log('Header non trouvé'); process.exit(); }

const cols = headerMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
const locIdx = cols.indexOf('location');
console.log('Colonnes (', cols.length, '):', cols.slice(0, 15).join(', '));
console.log('location @ index:', locIdx);

// Extraire la première row
const valuesStart = fixed.indexOf(') VALUES\n') + ') VALUES\n'.length;
const firstRowStart = fixed.indexOf('(', valuesStart);

// Parser avec gestion des strings
let depth = 0, inStr = false, i = firstRowStart + 1;
let colVal = '', colN = 0, values = [];
let escape = false;

while (i < fixed.length && !(depth === 0 && colN >= cols.length)) {
  const ch = fixed[i];
  if (escape) { colVal += ch; escape = false; i++; continue; }
  if (ch === '\\') { escape = true; colVal += ch; i++; continue; }
  if (ch === "'" && !inStr) { inStr = true; colVal += ch; i++; continue; }
  if (ch === "'" && inStr) {
    if (fixed[i+1] === "'") { colVal += "''"; i += 2; continue; } // escaped quote
    inStr = false; colVal += ch; i++; continue;
  }
  if (!inStr) {
    if (ch === '(') { depth++; colVal += ch; i++; continue; }
    if (ch === ')') {
      if (depth === 0) break;
      depth--; colVal += ch; i++; continue;
    }
    if (ch === ',' && depth === 0) {
      values.push(colVal.trim());
      colVal = ''; colN++;
      i++; continue;
    }
  }
  colVal += ch;
  i++;
}
values.push(colVal.trim());

console.log('\nPremière row - valeurs JSON:');
const jsonCols = ['old_values', 'new_values', 'device_info', 'location'];
jsonCols.forEach(col => {
  const idx = cols.indexOf(col);
  if (idx >= 0 && idx < values.length) {
    console.log(`  ${col} (idx ${idx}):`, JSON.stringify(values[idx]));
  }
});

console.log('\nValeur location brute:', JSON.stringify(values[locIdx]));
