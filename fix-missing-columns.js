const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway',
  connectTimeout: 30000
};

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'railway' 
     AND TABLE_NAME = ? 
     AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function addColumnIfNotExists(connection, tableName, columnName, sqlDefinition) {
  const exists = await columnExists(connection, tableName, columnName);
  if (exists) {
    console.log(`  ⏭️  ${columnName} existe déjà`);
    return false;
  }
  
  await connection.query(`ALTER TABLE ${tableName} ${sqlDefinition}`);
  console.log(`  ✅ ${columnName} ajoutée`);
  return true;
}

async function addMissingColumns() {
  let connection;
  
  try {
    console.log('🔗 Connexion à Railway MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connecté!\n');

    // ==================== USERS TABLE ====================
    console.log('👤 Ajout colonnes manquantes dans users...');
    
    await addColumnIfNotExists(connection, 'users', 'cin', 
      "ADD COLUMN cin VARCHAR(20) AFTER employee_id");
    await addColumnIfNotExists(connection, 'users', 'facial_descriptor', 
      "ADD COLUMN facial_descriptor TEXT AFTER facial_vector");
    await addColumnIfNotExists(connection, 'users', 'height', 
      "ADD COLUMN height DECIMAL(5,2) AFTER refresh_token");
    await addColumnIfNotExists(connection, 'users', 'weight', 
      "ADD COLUMN weight DECIMAL(5,2) AFTER height");
    await addColumnIfNotExists(connection, 'users', 'diploma', 
      "ADD COLUMN diploma VARCHAR(255) AFTER weight");
    await addColumnIfNotExists(connection, 'users', 'diploma_level', 
      "ADD COLUMN diploma_level VARCHAR(50) AFTER diploma");
    await addColumnIfNotExists(connection, 'users', 'security_card', 
      "ADD COLUMN security_card VARCHAR(100) AFTER diploma_level");
    await addColumnIfNotExists(connection, 'users', 'security_card_expiry', 
      "ADD COLUMN security_card_expiry DATE AFTER security_card");
    await addColumnIfNotExists(connection, 'users', 'experience_years', 
      "ADD COLUMN experience_years INT AFTER security_card_expiry");
    await addColumnIfNotExists(connection, 'users', 'specializations', 
      "ADD COLUMN specializations JSON AFTER experience_years");
    await addColumnIfNotExists(connection, 'users', 'languages', 
      "ADD COLUMN languages JSON AFTER specializations");
    await addColumnIfNotExists(connection, 'users', 'current_latitude', 
      "ADD COLUMN current_latitude DECIMAL(10, 8) AFTER languages");
    await addColumnIfNotExists(connection, 'users', 'current_longitude', 
      "ADD COLUMN current_longitude DECIMAL(11, 8) AFTER current_latitude");
    await addColumnIfNotExists(connection, 'users', 'last_location_update', 
      "ADD COLUMN last_location_update DATETIME AFTER current_longitude");
    await addColumnIfNotExists(connection, 'users', 'rating', 
      "ADD COLUMN rating DECIMAL(3, 2) DEFAULT 0.00 AFTER last_location_update");
    await addColumnIfNotExists(connection, 'users', 'total_ratings', 
      "ADD COLUMN total_ratings INT DEFAULT 0 AFTER rating");
    await addColumnIfNotExists(connection, 'users', 'punctuality_score', 
      "ADD COLUMN punctuality_score DECIMAL(5, 2) DEFAULT 0 AFTER total_ratings");
    await addColumnIfNotExists(connection, 'users', 'reliability_score', 
      "ADD COLUMN reliability_score DECIMAL(5, 2) DEFAULT 0 AFTER punctuality_score");
    await addColumnIfNotExists(connection, 'users', 'professionalism_score', 
      "ADD COLUMN professionalism_score DECIMAL(5, 2) DEFAULT 0 AFTER reliability_score");
    await addColumnIfNotExists(connection, 'users', 'overall_score', 
      "ADD COLUMN overall_score DECIMAL(5, 2) DEFAULT 0 AFTER professionalism_score");
    await addColumnIfNotExists(connection, 'users', 'emergency_contact', 
      "ADD COLUMN emergency_contact VARCHAR(255) AFTER overall_score");
    await addColumnIfNotExists(connection, 'users', 'emergency_phone', 
      "ADD COLUMN emergency_phone VARCHAR(20) AFTER emergency_contact");
    await addColumnIfNotExists(connection, 'users', 'id_card_number', 
      "ADD COLUMN id_card_number VARCHAR(50) AFTER emergency_phone");
    await addColumnIfNotExists(connection, 'users', 'social_security_number', 
      "ADD COLUMN social_security_number VARCHAR(50) AFTER id_card_number");
    await addColumnIfNotExists(connection, 'users', 'bank_details', 
      "ADD COLUMN bank_details JSON AFTER social_security_number");
    await addColumnIfNotExists(connection, 'users', 'supervisor_id', 
      "ADD COLUMN supervisor_id CHAR(36) AFTER bank_details");
    await addColumnIfNotExists(connection, 'users', 'authorized_devices', 
      "ADD COLUMN authorized_devices JSON AFTER supervisor_id");
    await addColumnIfNotExists(connection, 'users', 'last_check_in_location', 
      "ADD COLUMN last_check_in_location VARCHAR(500) AFTER authorized_devices");
    await addColumnIfNotExists(connection, 'users', 'created_by_type', 
      "ADD COLUMN created_by_type VARCHAR(20) AFTER last_check_in_location");
    await addColumnIfNotExists(connection, 'users', 'created_by_user_id', 
      "ADD COLUMN created_by_user_id CHAR(36) AFTER created_by_type");
    await addColumnIfNotExists(connection, 'users', 'is_temporary', 
      "ADD COLUMN is_temporary BOOLEAN DEFAULT FALSE AFTER created_by_user_id");
    await addColumnIfNotExists(connection, 'users', 'validated_by', 
      "ADD COLUMN validated_by CHAR(36) AFTER is_temporary");
    await addColumnIfNotExists(connection, 'users', 'validated_at', 
      "ADD COLUMN validated_at DATETIME AFTER validated_by");
    await addColumnIfNotExists(connection, 'users', 'last_liveness_check', 
      "ADD COLUMN last_liveness_check DATETIME AFTER validated_at");
    await addColumnIfNotExists(connection, 'users', 'fraud_score', 
      "ADD COLUMN fraud_score INT DEFAULT 0 AFTER last_liveness_check");
    await addColumnIfNotExists(connection, 'users', 'device_fingerprints', 
      "ADD COLUMN device_fingerprints JSON AFTER fraud_score");

    // ==================== EVENTS TABLE ====================
    console.log('\n📅 Ajout colonnes manquantes dans events...');
    
    await addColumnIfNotExists(connection, 'events', 'agent_creation_buffer', 
      "ADD COLUMN agent_creation_buffer INT DEFAULT 0 AFTER late_threshold");
    await addColumnIfNotExists(connection, 'events', 'priority', 
      "ADD COLUMN priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal' AFTER status");
    await addColumnIfNotExists(connection, 'events', 'color', 
      "ADD COLUMN color VARCHAR(20) AFTER priority");
    await addColumnIfNotExists(connection, 'events', 'recurrence_type', 
      "ADD COLUMN recurrence_type VARCHAR(50) AFTER recurrence");
    await addColumnIfNotExists(connection, 'events', 'recurrence_end_date', 
      "ADD COLUMN recurrence_end_date DATE AFTER recurrence_type");
    await addColumnIfNotExists(connection, 'events', 'contact_name', 
      "ADD COLUMN contact_name VARCHAR(255) AFTER recurrence_end_date");
    await addColumnIfNotExists(connection, 'events', 'contact_phone', 
      "ADD COLUMN contact_phone VARCHAR(20) AFTER contact_name");
    await addColumnIfNotExists(connection, 'events', 'supervisor_id', 
      "ADD COLUMN supervisor_id CHAR(36) AFTER created_by");

    // ==================== AJOUTER INDEX CIN ====================
    console.log('\n🔍 Ajout index sur cin...');
    try {
      const indexExists = await connection.query(`
        SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = 'railway'
        AND TABLE_NAME = 'users'
        AND INDEX_NAME = 'idx_cin'
      `);
      
      if (indexExists[0][0].count === 0) {
        await connection.query('CREATE INDEX idx_cin ON users(cin)');
        console.log('  ✅ Index idx_cin créé');
      } else {
        console.log('  ⏭️  Index idx_cin existe déjà');
      }
    } catch (err) {
      console.log(`  ⚠️  Index cin: ${err.message}`);
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
    const userColNames = userCols.map(c => c.COLUMN_NAME);
    const eventColNames = eventCols.map(c => c.COLUMN_NAME);
    
    console.log('\n🔍 Colonnes critiques:');
    console.log(`  cin (users): ${userColNames.includes('cin') ? '✅' : '❌'}`);
    console.log(`  agent_creation_buffer (events): ${eventColNames.includes('agent_creation_buffer') ? '✅' : '❌'}`);
    console.log(`  priority (events): ${eventColNames.includes('priority') ? '✅' : '❌'}`);

    console.log('\n✅ Migration terminée avec succès!');
    console.log('\n🚀 Railway va redémarrer automatiquement avec les nouvelles colonnes!');

  } catch (error) {
    console.error('❌ Erreur globale:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

addMissingColumns();
