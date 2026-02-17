/**
 * Migration: Ajouter les colonnes manquantes aux tables existantes
 * 
 * Les tables créées par import SQL n'ont pas toutes les colonnes
 * définies dans les modèles Sequelize. sync({ alter: false }) ne
 * modifie pas les tables existantes. Cette migration ajoute les
 * colonnes manquantes de façon sûre (vérifie avant d'ajouter).
 */
const db = require('../models');

/**
 * Check if a column exists in a table
 */
async function columnExists(tableName, columnName) {
  try {
    const [rows] = await db.sequelize.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      { replacements: [tableName, columnName] }
    );
    return rows[0] && rows[0].cnt > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Check if a table exists
 */
async function tableExists(tableName) {
  try {
    const [rows] = await db.sequelize.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      { replacements: [tableName] }
    );
    return rows[0] && rows[0].cnt > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Safely add a column if it doesn't exist
 */
async function addColumnIfMissing(tableName, columnName, columnDef) {
  if (!(await tableExists(tableName))) return false;
  if (await columnExists(tableName, columnName)) return false;
  
  try {
    await db.sequelize.query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`
    );
    console.log(`  📝 ${tableName}.${columnName} ajoutée`);
    return true;
  } catch (err) {
    console.error(`  ⚠️ Erreur ajout ${tableName}.${columnName}:`, err.message);
    return false;
  }
}

async function migrateAddMissingColumns() {
  console.log('🔄 Migration: Ajout colonnes manquantes aux tables existantes...');
  
  let added = 0;

  // =========================================
  // TABLE: events
  // Colonnes ajoutées dans le modèle mais pas dans le SQL d'import
  // =========================================
  if (await addColumnIfMissing('events', 'agent_creation_buffer', 
    'INT DEFAULT 120 COMMENT \'Minutes before event start when agent creation is allowed\'')) added++;
  
  if (await addColumnIfMissing('events', 'priority', 
    'ENUM(\'low\', \'medium\', \'high\', \'critical\') DEFAULT \'medium\'')) added++;
  
  if (await addColumnIfMissing('events', 'color', 
    'VARCHAR(7) DEFAULT \'#3B82F6\' COMMENT \'Couleur hex de l\\\'événement\'')) added++;
  
  if (await addColumnIfMissing('events', 'recurrence_type', 
    'ENUM(\'none\', \'daily\', \'weekly\', \'biweekly\', \'monthly\') DEFAULT \'none\'')) added++;
  
  if (await addColumnIfMissing('events', 'recurrence_end_date', 
    'DATETIME NULL DEFAULT NULL COMMENT \'Date de fin de la récurrence\'')) added++;
  
  if (await addColumnIfMissing('events', 'contact_name', 
    'VARCHAR(100) NULL DEFAULT NULL COMMENT \'Nom du contact sur site\'')) added++;
  
  if (await addColumnIfMissing('events', 'contact_phone', 
    'VARCHAR(20) NULL DEFAULT NULL COMMENT \'Téléphone du contact sur site\'')) added++;
  
  if (await addColumnIfMissing('events', 'supervisor_id', 
    'CHAR(36) NULL DEFAULT NULL COMMENT \'Responsable/Superviseur principal\'')) added++;

  // =========================================
  // TABLE: assignments
  // =========================================
  if (await addColumnIfMissing('assignments', 'zone_id', 
    'CHAR(36) NULL DEFAULT NULL COMMENT \'Zone spécifique dans l\\\'événement\'')) added++;

  // =========================================
  // TABLE: attendance
  // Device tracking columns
  // =========================================
  if (await addColumnIfMissing('attendance', 'check_in_device_name', 
    'VARCHAR(255) NULL DEFAULT NULL')) added++;
  
  if (await addColumnIfMissing('attendance', 'check_in_device_ip', 
    'VARCHAR(45) NULL DEFAULT NULL')) added++;
  
  if (await addColumnIfMissing('attendance', 'check_in_device_mac', 
    'VARCHAR(17) NULL DEFAULT NULL')) added++;
  
  if (await addColumnIfMissing('attendance', 'checked_in_by', 
    'CHAR(36) NULL DEFAULT NULL COMMENT \'Admin/Supervisor who performed check-in\'')) added++;
  
  if (await addColumnIfMissing('attendance', 'check_out_device_name', 
    'VARCHAR(255) NULL DEFAULT NULL')) added++;
  
  if (await addColumnIfMissing('attendance', 'check_out_device_ip', 
    'VARCHAR(45) NULL DEFAULT NULL')) added++;
  
  if (await addColumnIfMissing('attendance', 'check_out_device_mac', 
    'VARCHAR(17) NULL DEFAULT NULL')) added++;
  
  // Facial verification columns
  if (await addColumnIfMissing('attendance', 'facial_verified', 
    'BOOLEAN DEFAULT FALSE')) added++;
  
  if (await addColumnIfMissing('attendance', 'facial_verified_at', 
    'DATETIME NULL DEFAULT NULL')) added++;

  // =========================================
  // TABLE: users
  // Extra columns from model not in SQL import
  // =========================================
  if (await addColumnIfMissing('users', 'facial_descriptor', 
    'LONGTEXT NULL DEFAULT NULL COMMENT \'Descripteur facial JSON\'')) added++;
  
  if (await addColumnIfMissing('users', 'supervisor_id', 
    'CHAR(36) NULL DEFAULT NULL COMMENT \'Superviseur de l\\\'agent\'')) added++;
  
  if (await addColumnIfMissing('users', 'created_by_user_id', 
    'CHAR(36) NULL DEFAULT NULL COMMENT \'Créateur de l\\\'utilisateur\'')) added++;
  
  if (await addColumnIfMissing('users', 'validated_by', 
    'CHAR(36) NULL DEFAULT NULL COMMENT \'Validateur de l\\\'utilisateur\'')) added++;

  // =========================================
  // TABLE: incidents
  // =========================================
  if (await addColumnIfMissing('incidents', 'deleted_at', 
    'DATETIME NULL DEFAULT NULL')) added++;

  console.log(`✅ Migration colonnes manquantes: ${added} colonne(s) ajoutée(s)`);
  return added;
}

module.exports = migrateAddMissingColumns;
