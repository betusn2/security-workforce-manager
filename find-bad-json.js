const fs = require('fs');
const content = fs.readFileSync('C:/Users/Home/Downloads/backup_railway_2026-02-20T22-40-04_full.sql', 'utf8');
const stmts = content.split(/;\r?\n/).map(s => s.trim()).filter(s => s.length > 5);
const alStmt = stmts.find(s => s.includes("INSERT INTO `activity_logs`"));
if (!alStmt) { console.log('Non trouvé'); process.exit(); }

// Sauvegarder pour lecture directe
fs.writeFileSync('C:/Users/Home/Downloads/al_debug.sql', alStmt);
console.log('Sauvegardé. Longueur:', alStmt.length);

// Chercher des valeurs JSON invalides connues
const patterns = ['undefined', 'NaN', 'Infinity', '[object', 'function('];
patterns.forEach(p => {
  const idx = alStmt.toLowerCase().indexOf(p.toLowerCase());
  if (idx >= 0) {
    console.log(`"${p}" trouvé à pos ${idx}:`, JSON.stringify(alStmt.substring(Math.max(0,idx-20), idx+50)));
  } else {
    console.log(`"${p}" : non trouvé`);
  }
});
