/**
 * Migration: Ajouter les colonnes manquantes aux tables existantes
 * 
 * Les tables créées par import SQL n'ont pas toutes les colonnes
 * définies dans les modèles Sequelize. sync({ alter: false }) ne
 * modifie pas les tables existantes. Cette migration ajoute les
 * colonnes manquantes de façon sûre (vérifie avant d'ajouter).
 * 
 * Also fixes columns that were created with wrong types by sync({ alter: true })
 * (e.g., ENUM columns created as VARCHAR)
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

/**
 * Force a column to the correct type (MODIFY COLUMN)
 * Used to fix columns created with wrong types by sync({ alter: true })
 */
async function ensureColumnType(tableName, columnName, columnDef) {
  if (!(await tableExists(tableName))) {
    console.warn(`  ⚠️ Table ${tableName} introuvable, skip MODIFY ${columnName}`);
    return false;
  }
  if (!(await columnExists(tableName, columnName))) {
    console.warn(`  ⚠️ Colonne ${tableName}.${columnName} introuvable, skip MODIFY`);
    return false;
  }
  
  try {
    await db.sequelize.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${columnDef}`
    );
    console.log(`  🔧 ${tableName}.${columnName} type corrigé`);
    return true;
  } catch (err) {
    // Always log the error so we can diagnose
    console.error(`  ⚠️ Erreur MODIFY ${tableName}.${columnName}:`, err.message);
    return false;
  }
}

/**
 * Force-fix ENUM columns regardless of current state
 * More aggressive than ensureColumnType - always runs ALTER
 */
async function forceFixEnum(tableName, columnName, columnDef) {
  if (!(await tableExists(tableName))) return;
  try {
    await db.sequelize.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${columnDef}`
    );
    console.log(`  ✅ ${tableName}.${columnName} ENUM forcée (OK)`);
  } catch (err) {
    console.error(`  ❌ ${tableName}.${columnName} ENUM force-fix échoué:`, err.message);
  }
}

async function migrateAddMissingColumns() {
  console.log('🔄 Migration: Ajout colonnes manquantes aux tables existantes...');
  
  let added = 0;

  // =========================================
  // TABLE: events (7 missing columns)
  // =========================================
  if (await addColumnIfMissing('events', 'agent_creation_buffer', 
    'INT DEFAULT 120')) added++;
  if (await addColumnIfMissing('events', 'priority', 
    'ENUM(\'low\', \'medium\', \'high\', \'critical\') DEFAULT \'medium\'')) added++;
  if (await addColumnIfMissing('events', 'color', 
    'VARCHAR(7) DEFAULT \'#3B82F6\'')) added++;
  if (await addColumnIfMissing('events', 'recurrence_type', 
    'ENUM(\'none\', \'daily\', \'weekly\', \'biweekly\', \'monthly\') DEFAULT \'none\'')) added++;
  if (await addColumnIfMissing('events', 'recurrence_end_date', 
    'DATETIME NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('events', 'contact_name', 
    'VARCHAR(100) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('events', 'contact_phone', 
    'VARCHAR(20) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('events', 'supervisor_id', 
    'CHAR(36) NULL DEFAULT NULL')) added++;

  // Fix ENUM columns that may have been created with wrong type by sync({ alter: true })
  // Use forceFixEnum to always run ALTER regardless of current state
  let fixed = 0;
  console.log('  🔍 Vérification ENUMs events...');
  if (await ensureColumnType('events', 'priority', 
    'ENUM(\'low\', \'medium\', \'high\', \'critical\') NOT NULL DEFAULT \'medium\'')) fixed++;
  if (await ensureColumnType('events', 'recurrence_type', 
    'ENUM(\'none\', \'daily\', \'weekly\', \'biweekly\', \'monthly\') NOT NULL DEFAULT \'none\'')) fixed++;
  if (await ensureColumnType('events', 'status', 
    'ENUM(\'draft\', \'scheduled\', \'active\', \'completed\', \'cancelled\') NOT NULL DEFAULT \'draft\'')) fixed++;
  if (await ensureColumnType('events', 'type', 
    'ENUM(\'regular\', \'special\', \'emergency\') NOT NULL DEFAULT \'regular\'')) fixed++;
  if (fixed > 0) console.log(`  🔧 ${fixed} colonne(s) ENUM corrigée(s) dans events`);
  
  // Force-fix: always run ENUM correction for events (in case ensureColumnType missed it)
  await forceFixEnum('events', 'priority',
    "ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium'");
  await forceFixEnum('events', 'recurrence_type',
    "ENUM('none', 'daily', 'weekly', 'biweekly', 'monthly') NOT NULL DEFAULT 'none'");
  await forceFixEnum('events', 'status',
    "ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'draft'");
  await forceFixEnum('events', 'type',
    "ENUM('regular', 'special', 'emergency') NOT NULL DEFAULT 'regular'");

  // =========================================
  // TABLE: assignments (1 missing column)
  // =========================================
  if (await addColumnIfMissing('assignments', 'zone_id', 
    'CHAR(36) NULL DEFAULT NULL')) added++;

  // =========================================
  // TABLE: attendance (9 missing columns)
  // =========================================
  if (await addColumnIfMissing('attendance', 'check_in_device_name', 
    'VARCHAR(255) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'check_in_device_ip', 
    'VARCHAR(45) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'check_in_device_mac', 
    'VARCHAR(17) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'checked_in_by', 
    'CHAR(36) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'check_out_device_name', 
    'VARCHAR(255) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'check_out_device_ip', 
    'VARCHAR(45) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'check_out_device_mac', 
    'VARCHAR(17) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'facial_verified', 
    'BOOLEAN DEFAULT FALSE')) added++;
  if (await addColumnIfMissing('attendance', 'facial_verified_at', 
    'DATETIME NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'facial_match_score', 
    'DECIMAL(5,4) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'is_within_geofence', 
    'BOOLEAN DEFAULT TRUE')) added++;
  if (await addColumnIfMissing('attendance', 'distance_from_location', 
    'INT NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'total_hours', 
    'DECIMAL(5,2) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'overtime_hours', 
    'DECIMAL(5,2) DEFAULT 0')) added++;
  if (await addColumnIfMissing('attendance', 'verified_by', 
    'CHAR(36) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('attendance', 'verified_at', 
    'DATETIME NULL DEFAULT NULL')) added++;

  // =========================================
  // TABLE: users (34 missing columns)
  // =========================================
  // Identity & Personal
  if (await addColumnIfMissing('users', 'cin', 
    'VARCHAR(20) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'facial_descriptor', 
    'LONGTEXT NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'height', 
    'INT NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'weight', 
    'INT NULL DEFAULT NULL')) added++;
  
  // Professional
  if (await addColumnIfMissing('users', 'diploma', 
    'VARCHAR(255) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'diploma_level', 
    'ENUM(\'cap\', \'bac\', \'bac+2\', \'bac+3\', \'bac+5\', \'autre\') NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'security_card', 
    'VARCHAR(100) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'security_card_expiry', 
    'DATE NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'experience_years', 
    'INT NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'specializations', 
    'JSON NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'languages', 
    'JSON NULL DEFAULT NULL')) added++;
  
  // Location tracking
  if (await addColumnIfMissing('users', 'current_latitude', 
    'DECIMAL(10,8) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'current_longitude', 
    'DECIMAL(11,8) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'last_location_update', 
    'DATETIME NULL DEFAULT NULL')) added++;
  
  // Scores & Ratings
  if (await addColumnIfMissing('users', 'rating', 
    'DECIMAL(3,2) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'total_ratings', 
    'INT DEFAULT 0')) added++;
  if (await addColumnIfMissing('users', 'punctuality_score', 
    'INT DEFAULT 0')) added++;
  if (await addColumnIfMissing('users', 'reliability_score', 
    'INT DEFAULT 0')) added++;
  if (await addColumnIfMissing('users', 'professionalism_score', 
    'INT DEFAULT 0')) added++;
  if (await addColumnIfMissing('users', 'overall_score', 
    'INT DEFAULT 0')) added++;
  
  // Emergency contacts
  if (await addColumnIfMissing('users', 'emergency_contact', 
    'VARCHAR(100) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'emergency_phone', 
    'VARCHAR(20) NULL DEFAULT NULL')) added++;
  
  // Administrative
  if (await addColumnIfMissing('users', 'id_card_number', 
    'VARCHAR(50) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'social_security_number', 
    'VARCHAR(50) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'bank_details', 
    'JSON NULL DEFAULT NULL')) added++;
  
  // Relations
  if (await addColumnIfMissing('users', 'supervisor_id', 
    'CHAR(36) NULL DEFAULT NULL')) added++;
  
  // Security & Device
  if (await addColumnIfMissing('users', 'authorized_devices', 
    'JSON NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'last_check_in_location', 
    'JSON NULL DEFAULT NULL')) added++;
  
  // Creation tracking
  if (await addColumnIfMissing('users', 'created_by_type', 
    'ENUM(\'admin\', \'supervisor\', \'self_registration\') NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'created_by_user_id', 
    'CHAR(36) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'is_temporary', 
    'BOOLEAN DEFAULT FALSE')) added++;
  if (await addColumnIfMissing('users', 'validated_by', 
    'CHAR(36) NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'validated_at', 
    'DATETIME NULL DEFAULT NULL')) added++;
  
  // Fraud detection
  if (await addColumnIfMissing('users', 'last_liveness_check', 
    'DATETIME NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('users', 'fraud_score', 
    'INT DEFAULT 0')) added++;
  if (await addColumnIfMissing('users', 'device_fingerprints', 
    'JSON NULL DEFAULT NULL')) added++;

  // Fix users ENUM columns
  let fixedUsers = 0;
  if (await ensureColumnType('users', 'role', 
    'ENUM(\'agent\', \'supervisor\', \'admin\', \'user\') DEFAULT \'agent\'')) fixedUsers++;
  if (await ensureColumnType('users', 'status', 
    'ENUM(\'active\', \'inactive\', \'suspended\') DEFAULT \'active\'')) fixedUsers++;
  if (fixedUsers > 0) console.log(`  🔧 ${fixedUsers} colonne(s) ENUM corrigée(s) dans users`);

  // =========================================
  // TABLE: scheduled_backups (fix missing/wrong columns)
  // =========================================
  if (await addColumnIfMissing('scheduled_backups', 'enabled',
    'BOOLEAN NOT NULL DEFAULT TRUE')) added++;
  if (await addColumnIfMissing('scheduled_backups', 'interval_days',
    'INT NOT NULL DEFAULT 7')) added++;
  if (await addColumnIfMissing('scheduled_backups', 'backup_type',
    "ENUM('full', 'structure') NOT NULL DEFAULT 'full'")) added++;
  if (await addColumnIfMissing('scheduled_backups', 'retention_count',
    'INT NOT NULL DEFAULT 3')) added++;
  if (await addColumnIfMissing('scheduled_backups', 'last_run_at',
    'DATETIME NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('scheduled_backups', 'next_run_at',
    'DATETIME NULL DEFAULT NULL')) added++;
  if (await addColumnIfMissing('scheduled_backups', 'created_by',
    'CHAR(36) NULL DEFAULT NULL')) added++;

  // =========================================
  // TABLE: activity_logs (needs updated_at column for safety)
  // =========================================
  // Model has updatedAt: false, so no issue there.
  // But deleted_at is handled by migrate-add-deleted-at.js

  console.log(`✅ Migration colonnes manquantes: ${added} colonne(s) ajoutée(s)`);
  return added;
}

module.exports = migrateAddMissingColumns;
