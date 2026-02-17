/**
 * Migration: TEXT → LONGTEXT pour les colonnes photos/facial
 * Résout: "Data too long for column 'profile_photo' at row 1"
 * Les colonnes TEXT MySQL sont limitées à 64KB, LONGTEXT supporte 4GB
 */
const db = require('../models');

async function migratePhotosToLongtext() {
  console.log('🔄 Migration: Vérification colonnes LONGTEXT photos...');
  
  const queryInterface = db.sequelize.getQueryInterface();
  
  // Colonnes à migrer dans la table users
  const userColumns = [
    { name: 'profile_photo', comment: 'Photo profil base64' },
    { name: 'facial_vector', comment: 'Vecteur facial chiffré' },
    { name: 'facial_descriptor', comment: 'Descripteur facial JSON' }
  ];
  
  // Colonnes à migrer dans la table attendance
  const attendanceColumns = [
    { name: 'check_in_photo', comment: 'Photo check-in base64' },
    { name: 'check_out_photo', comment: 'Photo check-out base64' }
  ];
  
  let changed = 0;
  
  // Vérifier et migrer les colonnes users
  try {
    const [userCols] = await db.sequelize.query(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME IN ('profile_photo', 'facial_vector', 'facial_descriptor')`
    );
    
    for (const col of userCols) {
      if (col.DATA_TYPE !== 'longtext') {
        console.log(`  📝 users.${col.COLUMN_NAME}: ${col.DATA_TYPE} → LONGTEXT`);
        await db.sequelize.query(
          `ALTER TABLE users MODIFY COLUMN \`${col.COLUMN_NAME}\` LONGTEXT`
        );
        changed++;
      }
    }
  } catch (err) {
    console.error('⚠️ Erreur migration users:', err.message);
  }
  
  // Vérifier et migrer les colonnes attendance
  try {
    const [attCols] = await db.sequelize.query(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'attendance' 
       AND COLUMN_NAME IN ('check_in_photo', 'check_out_photo')`
    );
    
    for (const col of attCols) {
      if (col.DATA_TYPE !== 'longtext') {
        console.log(`  📝 attendance.${col.COLUMN_NAME}: ${col.DATA_TYPE} → LONGTEXT`);
        await db.sequelize.query(
          `ALTER TABLE attendance MODIFY COLUMN \`${col.COLUMN_NAME}\` LONGTEXT`
        );
        changed++;
      }
    }
  } catch (err) {
    // Table attendance might not exist yet
    console.log('ℹ️ Table attendance non trouvée ou déjà migrée');
  }
  
  if (changed > 0) {
    console.log(`✅ Migration LONGTEXT: ${changed} colonne(s) migrée(s)`);
  } else {
    console.log('✅ Toutes les colonnes photos sont déjà en LONGTEXT');
  }
}

module.exports = migratePhotosToLongtext;
