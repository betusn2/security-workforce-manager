/**
 * Migration: Ajouter la colonne deleted_at aux tables qui en ont besoin
 * 
 * Le config global Sequelize a `paranoid: true`, ce qui ajoute automatiquement
 * `WHERE deleted_at IS NULL` à toutes les requêtes. Si une table n'a pas cette
 * colonne, toutes les requêtes échouent avec une erreur 500.
 * 
 * Tables créées par SQL import qui n'avaient pas deleted_at:
 * - attendance, notifications, activity_logs, badges, user_badges,
 *   conversations, messages, geo_tracking, liveness_logs, fraud_attempts,
 *   sos_alerts, incidents, permissions, role_permissions, user_permissions,
 *   user_documents, zones, gps_tracking, tracking_alerts, scheduled_backups
 */
const db = require('../models');

async function migrateAddDeletedAt() {
  console.log('🔄 Migration: Vérification colonne deleted_at sur toutes les tables...');
  
  // All tables that models use (paranoid: true either explicit or inherited)
  const allTables = [
    'users',
    'events', 
    'assignments',
    'attendance',
    'notifications',
    'activity_logs',
    'badges',
    'user_badges',
    'conversations',
    'messages',
    'geo_tracking',
    'gps_tracking',
    'liveness_logs',
    'fraud_attempts',
    'sos_alerts',
    'incidents',
    'permissions',
    'role_permissions',
    'user_permissions',
    'user_documents',
    'zones',
    'tracking_alerts',
    'scheduled_backups'
  ];
  
  let added = 0;
  let skipped = 0;
  let missing = 0;
  
  for (const tableName of allTables) {
    try {
      // Check if table exists
      const [tableExists] = await db.sequelize.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        { replacements: [tableName] }
      );
      
      if (!tableExists[0] || tableExists[0].cnt === 0) {
        missing++;
        continue; // Table doesn't exist yet, sync will create it with deleted_at
      }
      
      // Check if deleted_at column already exists
      const [columns] = await db.sequelize.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = ? 
         AND COLUMN_NAME = 'deleted_at'`,
        { replacements: [tableName] }
      );
      
      if (columns.length > 0) {
        skipped++;
        continue; // Column already exists
      }
      
      // Add deleted_at column
      console.log(`  📝 ${tableName}: Ajout colonne deleted_at`);
      await db.sequelize.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`deleted_at\` DATETIME NULL DEFAULT NULL`
      );
      added++;
      
    } catch (err) {
      console.error(`  ⚠️ Erreur sur ${tableName}:`, err.message);
    }
  }
  
  console.log(`✅ Migration deleted_at: ${added} ajoutée(s), ${skipped} déjà OK, ${missing} tables inexistantes`);
  return added;
}

module.exports = migrateAddDeletedAt;
