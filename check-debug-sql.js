const fs = require('fs');
const sql = fs.readFileSync('C:/Users/Home/Downloads/incidents_debug.sql', 'utf8');

console.log('Total longueur SQL debug:', sql.length);

// Chercher les chaines vides restantes
const emptyStrings = [];
let p = sql.indexOf("''");
while (p >= 0 && emptyStrings.length < 10) {
  emptyStrings.push({ pos: p, ctx: sql.substring(Math.max(0,p-30), p+40) });
  p = sql.indexOf("''", p + 2);
}

console.log('Nb chaines vides restantes:', emptyStrings.length);
emptyStrings.forEach(e => {
  console.log('\n  pos', e.pos, ':', JSON.stringify(e.ctx));
});

// Afficher le début des VALUES
const firstVal = sql.indexOf('VALUES');
if (firstVal >= 0) {
  console.log('\n=== DEBUT VALUES ===');
  console.log(sql.substring(firstVal, firstVal + 600));
}
