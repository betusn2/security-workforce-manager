const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway',
  connectTimeout: 30000
};

async function addMissingColumns() {
  let connection;
  
  try {
    console.log('🔗 Connexion à Railway MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connecté!\n');

    // ==================== USERS TABLE ====================
    console.log('👤 Ajout colonnes manquantes dans users...');
    
    const userColumns = [
      { name: 'cin', sql: "ADD COLUMN cin VARCHAR(20) AFTER employee_id" },
      "ADD COLUMN IF NOT EXISTS facial_descriptor TEXT AFTER facial_vector",
      "ADD COLUMN IF NOT EXISTS height DECIMAL(5,2) AFTER refresh_token",
      "ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2) AFTER height",
      "ADD COLUMN IF NOT EXISTS diploma VARCHAR(255) AFTER weight",
      "ADD COLUMN IF NOT EXISTS diploma_level VARCHAR(50) AFTER diploma",
      "ADD COLUMN IF NOT EXISTS security_card VARCHAR(100) AFTER diploma_level",
      "ADD COLUMN IF NOT EXISTS security_card_expiry DATE AFTER security_card",
      "ADD COLUMN IF NOT EXISTS experience_years INT AFTER security_card_expiry",
      "ADD COLUMN IF NOT EXISTS specializations JSON AFTER experience_years",
      "ADD COLUMN IF NOT EXISTS languages JSON AFTER specializations",
      "ADD COLUMN IF NOT EXISTS current_latitude DECIMAL(10, 8) AFTER languages",
      "ADD COLUMN IF NOT EXISTS current_longitude DECIMAL(11, 8) AFTER current_latitude",
      "ADD COLUMN IF NOT EXISTS last_location_update DATETIME AFTER current_longitude",
      "ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 2) DEFAULT 0.00 AFTER last_location_update",
      "ADD COLUMN IF NOT EXISTS total_ratings INT DEFAULT 0 AFTER rating",
      "ADD COLUMN IF NOT EXISTS punctuality_score DECIMAL(5, 2) DEFAULT 0 AFTER total_ratings",
      "ADD COLUMN IF NOT EXISTS reliability_score DECIMAL(5, 2) DEFAULT 0 AFTER punctuality_score",
      "ADD COLUMN IF NOT EXISTS professionalism_score DECIMAL(5, 2) DEFAULT 0 AFTER reliability_score",
      "ADD COLUMN IF NOT EXISTS overall_score DECIMAL(5, 2) DEFAULT 0 AFTER professionalism_score",
      "ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255) AFTER overall_score",
      "ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20) AFTER emergency_contact",
      "ADD COLUMN IF NOT EXISTS id_card_number VARCHAR(50) AFTER emergency_phone",
      "ADD COLUMN IF NOT EXISTS social_security_number VARCHAR(50) AFTER id_card_number",
      "ADD COLUMN IF NOT EXISTS bank_details JSON AFTER social_security_number",
      "ADD COLUMN IF NOT EXISTS supervisor_id CHAR(36) AFTER bank_details",
      "ADD COLUMN IF NOT EXISTS authorized_devices JSON AFTER supervisor_id",
      "ADD COLUMN IF NOT EXISTS last_check_in_location VARCHAR(500) AFTER authorized_devices",
      "ADD COLUMN IF NOT EXISTS created_by_type VARCHAR(20) AFTER last_check_in_location",
      "ADD COLUMN IF NOT EXISTS created_by_user_id CHAR(36) AFTER created_by_type",
      "ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE AFTER created_by_user_id",
      "ADD COLUMN IF NOT EXISTS validated_by CHAR(36) AFTER is_temporary",
      "ADD COLUMN IF NOT EXISTS validated_at DATETIME AFTER validated_by",
      "ADD COLUMN IF NOT EXISTS last_liveness_check DATETIME AFTER validated_at",
      "ADD COLUMN IF NOT EXISTS fraud_score INT DEFAULT 0 AFTER last_liveness_check",
      "ADD COLUMN IF NOT EXISTS device_fingerprints JSON AFTER fraud_score"
    ];

    for (const col of userColumns) {
      try {
        await connection.query(`ALTER TABLE users ${col}`);
        console.log(`  ✅ ${col.split('ADD COLUMN IF NOT EXISTS ')[1]?.split(' ')[0] || 'Colonne'}`);
      } catch (err) {
        if (!err.message.includes('Duplicate column')) {
          console.log(`  ⚠️  ${col.split('ADD COLUMN IF NOT EXISTS ')[1]?.split(' ')[0]}: ${err.message}`);
        }
      }
    }

    // ==================== EVENTS TABLE ====================
    console.log('\n📅 Ajout colonnes manquantes dans events...');
    
    const eventColumns = [
      "ADD COLUMN IF NOT EXISTS agent_creation_buffer INT DEFAULT 0 AFTER late_threshold",
      "ADD COLUMN IF NOT EXISTS priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal' AFTER status",
      "ADD COLUMN IF NOT EXISTS color VARCHAR(20) AFTER priority",
      "ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(50) AFTER recurrence",
      "ADD COLUMN IF NOT EXISTS recurrence_end_date DATE AFTER recurrence_type",
      "ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255) AFTER recurrence_end_date",
      "ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20) AFTER contact_name",
      "ADD COLUMN IF NOT EXISTS supervisor_id CHAR(36) AFTER created_by"
    ];

    for (const col of eventColumns) {
      try {
        await connection.query(`ALTER TABLE events ${col}`);
        console.log(`  ✅ ${col.split('ADD COLUMN IF NOT EXISTS ')[1]?.split(' ')[0] || 'Colonne'}`);
      } catch (err) {
        if (!err.message.includes('Duplicate column')) {
          console.log(`  ⚠️  ${col.split('ADD COLUMN IF NOT EXISTS ')[1]?.split(' ')[0]}: ${err.message}`);
        }
      }
    }

    // ==================== AJOUTER INDEX CIN ====================
    console.log('\n🔍 Ajout index sur cin...');
    try {
      await connection.query('CREATE INDEX IF NOT EXISTS idx_cin ON users(cin)');
      console.log('  ✅ Index idx_cin créé');
    } catch (err) {
      if (!err.message.includes('Duplicate key')) {
        console.log(`  ⚠️  Index cin: ${err.message}`);
      }
    }

    // ==================== VÉRIFICATION ====================
    console.log('\n🔍 Vérification des colonnes...');
    
    const [userCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'railway' 
      AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `);
    
    const [eventCols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'railway' 
      AND TABLE_NAME = 'events'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`\n✅ Table users: ${userCols.length} colonnes`);
    console.log(`✅ Table events: ${eventCols.length} colonnes`);
    
    // Vérifier colonnes critiques
    const criticalCols = ['cin', 'agent_creation_buffer', 'priority'];
    const userColNames = userCols.map(c => c.COLUMN_NAME);
    const eventColNames = eventCols.map(c => c.COLUMN_NAME);
    
    console.log('\n🔍 Colonnes critiques:');
    console.log(`  cin (users): ${userColNames.includes('cin') ? '✅' : '❌'}`);
    console.log(`  agent_creation_buffer (events): ${eventColNames.includes('agent_creation_buffer') ? '✅' : '❌'}`);
    console.log(`  priority (events): ${eventColNames.includes('priority') ? '✅' : '❌'}`);

    console.log('\n✅ Migration terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

addMissingColumns();
