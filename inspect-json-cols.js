const fs = require('fs');
const content = fs.readFileSync('C:/Users/Home/Downloads/backup_railway_2026-02-20T22-40-04_full.sql', 'utf8');

const stmts = content.split(/;\r?\n/).map(s => s.trim()).filter(s => s.length > 5);

// activity_logs
const alStmt = stmts.find(s => s.includes('INSERT INTO `activity_logs`'));
if (alStmt) {
  const locPos = alStmt.indexOf('`location`');
  const valStart = alStmt.indexOf('VALUES');
  // Compter les colonnes pour trouver l'index de location
  const colsMatch = alStmt.match(/\(([^)]+)\)\s*VALUES/);
  if (colsMatch) {
    const cols = colsMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
    const locIdx = cols.indexOf('location');
    console.log('activity_logs.location est colonne n°', locIdx);
    
    // Extraire la première row
    const rowMatch = alStmt.replace(/.*VALUES\s*/s, '').match(/^\(([^;]*)\)/s);
    if (rowMatch) {
      const vals = rowMatch[1];
      // Split manuel sur ,  mais en respectant les strings
      let inStr = false, depth = 0, curr = '', parts = [];
      for (let i = 0; i < vals.length; i++) {
        const ch = vals[i];
        if (ch === "'" && vals[i-1] !== '\\') inStr = !inStr;
        if (!inStr && ch === '(') depth++;
        if (!inStr && ch === ')') depth--;
        if (!inStr && ch === ',' && depth === 0) { parts.push(curr); curr = ''; }
        else curr += ch;
      }
      parts.push(curr);
      console.log(`  Valeur location (idx ${locIdx}):`, JSON.stringify(parts[locIdx]?.trim()));
    }
  }
}

// users
const usersStmt = stmts.find(s => s.includes('INSERT INTO `users`'));
if (usersStmt) {
  const colsMatch = usersStmt.match(/\(([^)]+)\)\s*VALUES/);
  if (colsMatch) {
    const cols = colsMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
    const langIdx = cols.indexOf('languages');
    console.log('\nusers.languages est colonne n°', langIdx);
    console.log('Colonnes users:', cols.join(', '));
    
    const rowMatch = usersStmt.replace(/.*VALUES\s*/s, '').match(/^\(([^;]*)\)/s);
    if (rowMatch) {
      const vals = rowMatch[1];
      let inStr = false, curr = '', parts = [];
      for (let i = 0; i < vals.length; i++) {
        const ch = vals[i];
        if (ch === "'" && vals[i-1] !== '\\') inStr = !inStr;
        if (!inStr && ch === ',' ) { parts.push(curr); curr = ''; }
        else curr += ch;
      }
      parts.push(curr);
      if (langIdx < parts.length) {
        console.log(`  Valeur languages (idx ${langIdx}):`, JSON.stringify(parts[langIdx]?.trim()));
      }
    }
  }
}
