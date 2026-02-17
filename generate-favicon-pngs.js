/**
 * Générateur de favicons PNG - Security Workforce Manager
 * Crée des icônes PNG valides pour remplacer les fichiers SVG mal nommés
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Crée un fichier PNG basique avec un symbole de badge de sécurité
 */
function createPNG(size, filename) {
  // Configuration couleur (bleu violet du thème)
  const bgColor = { r: 37, g: 99, b: 235 }; // #2563eb
  const fgColor = { r: 255, g: 255, b: 255 }; // blanc
  
  // Créer les pixels (RGBA)
  const pixels = [];
  
  for (let y = 0; y < size; y++) {
    // Ligne avec byte de filtrage (0 = aucun filtre)
    const row = [0];
    
    for (let x = 0; x < size; x++) {
      const centerX = size / 2;
      const centerY = size / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Dessiner un badge de sécurité (forme de bouclier)
      let isBadge = false;
      
      // Badge circulaire avec bordure
      const radius = size * 0.4;
      const borderWidth = size * 0.08;
      
      if (dist < radius && dist > radius - borderWidth) {
        isBadge = true; // Bordure
      } else if (dist < radius - borderWidth) {
        // Intérieur: dessiner "S" stylisé
        const relX = (x - centerX) / (size * 0.25);
        const relY = (y - centerY) / (size * 0.25);
        
        // Lettre S simplifiée (3 segments horizontaux)
        if (Math.abs(relX) < 0.8) {
          if (Math.abs(relY + 0.6) < 0.15 || // haut
              Math.abs(relY) < 0.15 ||       // milieu
              Math.abs(relY - 0.6) < 0.15) { // bas
            isBadge = true;
          }
        }
      }
      
      // Ajouter les pixels RGBA
      if (isBadge) {
        row.push(fgColor.r, fgColor.g, fgColor.b, 255);
      } else {
        row.push(bgColor.r, bgColor.g, bgColor.b, 255);
      }
    }
    
    pixels.push(...row);
  }
  
  // Compresser les données avec zlib
  const pixelBuffer = Buffer.from(pixels);
  const compressed = zlib.deflateSync(pixelBuffer, { level: 9 });
  
  // Créer le fichier PNG
  const png = Buffer.alloc(
    8 + // Signature PNG
    12 + 13 + // Chunk IHDR
    12 + compressed.length + // Chunk IDAT
    12 // Chunk IEND
  );
  
  let offset = 0;
  
  // Signature PNG
  png.writeUInt32BE(0x89504e47, offset); offset += 4;
  png.writeUInt32BE(0x0d0a1a0a, offset); offset += 4;
  
  // Chunk IHDR
  png.writeUInt32BE(13, offset); offset += 4; // Longueur
  png.write('IHDR', offset); offset += 4;
  png.writeUInt32BE(size, offset); offset += 4; // Largeur
  png.writeUInt32BE(size, offset); offset += 4; // Hauteur
  png.writeUInt8(8, offset); offset += 1; // Profondeur de bit
  png.writeUInt8(6, offset); offset += 1; // Type couleur (RGBA)
  png.writeUInt8(0, offset); offset += 1; // Compression
  png.writeUInt8(0, offset); offset += 1; // Filtre
  png.writeUInt8(0, offset); offset += 1; // Entrelacement
  
  const crcIHDR = crc32(png.slice(offset - 17, offset));
  png.writeUInt32BE(crcIHDR, offset); offset += 4;
  
  // Chunk IDAT
  png.writeUInt32BE(compressed.length, offset); offset += 4;
  png.write('IDAT', offset); offset += 4;
  compressed.copy(png, offset);
  const idatStart = offset - 4;
  offset += compressed.length;
  
  const crcIDAT = crc32(png.slice(idatStart, offset));
  png.writeUInt32BE(crcIDAT, offset); offset += 4;
  
  // Chunk IEND
  png.writeUInt32BE(0, offset); offset += 4;
  png.write('IEND', offset); offset += 4;
  
  const crcIEND = crc32(png.slice(offset - 4, offset));
  png.writeUInt32BE(crcIEND, offset); offset += 4;
  
  // Écrire le fichier
  fs.writeFileSync(filename, png);
  console.log(`✅ Créé: ${path.basename(filename)} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

/**
 * Calcul CRC32 pour chunks PNG
 */
function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

// Générer les favicons
const outputDir = path.join(__dirname, 'web-dashboard', 'public');

console.log('\n🎨 Génération des favicons PNG...\n');

// Supprimer les anciens fichiers PNG (qui sont en fait des SVG)
const sizes = [
  { size: 16, file: 'favicon-16.png' },
  { size: 32, file: 'favicon-32.png' },
  { size: 180, file: 'favicon-180.png' }
];

sizes.forEach(({ size, file }) => {
  const filepath = path.join(outputDir, file);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    console.log(`🗑️  Supprimé: ${file} (SVG renommé)`);
  }
});

console.log();

// Créer les nouveaux PNG
sizes.forEach(({ size, file }) => {
  createPNG(size, path.join(outputDir, file));
});

// Recréer favicon.ico depuis le nouveau 32x32 PNG
const favicon32 = path.join(outputDir, 'favicon-32.png');
const faviconIco = path.join(outputDir, 'favicon.ico');

if (fs.existsSync(favicon32)) {
  fs.copyFileSync(favicon32, faviconIco);
  console.log(`✅ Mis à jour: favicon.ico (depuis favicon-32.png)`);
}

console.log('\n✅ Favicons PNG générés avec succès\n');
