const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway',
  connectTimeout: 30000
};

async function createMissingTables() {
  let connection;
  
  try {
    console.log('🔗 Connexion à Railway MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connecté!\n');

    // ==================== TABLE 1: INCIDENTS ====================
    console.log('📋 Création table: incidents');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        eventId VARCHAR(36),
        reportedBy VARCHAR(36) NOT NULL,
        assignedTo VARCHAR(36),
        type ENUM(
          'security_breach',
          'medical_emergency',
          'fire_alarm',
          'theft',
          'vandalism',
          'trespassing',
          'suspicious_activity',
          'equipment_failure',
          'access_issue',
          'violence',
          'other'
        ) NOT NULL,
        severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        status ENUM('reported', 'investigating', 'resolved', 'escalated', 'closed') DEFAULT 'reported',
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        location VARCHAR(500),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        photos JSON COMMENT 'Array of photo URLs/base64',
        witnesses JSON COMMENT 'Array of witness info',
        actionsTaken TEXT,
        policeReport VARCHAR(100) COMMENT 'Police report number if applicable',
        resolvedAt DATETIME,
        resolvedBy VARCHAR(36),
        resolution TEXT,
        followUpRequired BOOLEAN DEFAULT FALSE,
        followUpDate DATE,
        followUpNotes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE SET NULL,
        FOREIGN KEY (reportedBy) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assignedTo) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (resolvedBy) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table incidents créée\n');

    // ==================== TABLE 2: GPS_TRACKING ====================
    console.log('📍 Création table: gps_tracking');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS gps_tracking (
        id VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        userId VARCHAR(36) NOT NULL,
        eventId VARCHAR(36),
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy FLOAT COMMENT 'Precision en metres',
        altitude FLOAT,
        speed FLOAT COMMENT 'Vitesse en m/s',
        heading FLOAT COMMENT 'Direction en degres',
        batteryLevel INT CHECK (batteryLevel >= 0 AND batteryLevel <= 100),
        isCharging BOOLEAN DEFAULT FALSE,
        deviceInfo JSON COMMENT 'Infos appareil: nom, modele, OS, etc.',
        ipAddress VARCHAR(45),
        macAddress VARCHAR(17),
        isInsideGeofence BOOLEAN DEFAULT FALSE,
        distanceFromEvent FLOAT COMMENT 'Distance en metres de evenement',
        trackingType ENUM('auto', 'manual', 'background', 'checkin', 'checkout') DEFAULT 'auto',
        isActive BOOLEAN DEFAULT TRUE COMMENT 'Agent toujours actif sur le terrain',
        metadata JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE SET NULL,
        INDEX idx_userId (userId),
        INDEX idx_eventId (eventId),
        INDEX idx_createdAt (createdAt),
        INDEX idx_isActive (isActive),
        INDEX idx_userId_eventId_createdAt (userId, eventId, createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table gps_tracking créée\n');

    // ==================== TABLE 3: GEO_TRACKING ====================
    console.log('🌍 Création table: geo_tracking');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS geo_tracking (
        id VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36) NOT NULL,
        event_id VARCHAR(36),
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy DECIMAL(6, 2),
        altitude DECIMAL(8, 2),
        speed DECIMAL(6, 2),
        heading DECIMAL(5, 2),
        
        battery_level INT,
        battery_charging BOOLEAN,
        battery_charging_time INT,
        battery_discharging_time INT,
        battery_status VARCHAR(20),
        battery_estimated_time VARCHAR(50),
        
        network_type VARCHAR(20),
        network_downlink DECIMAL(8, 2),
        network_rtt INT,
        network_save_data BOOLEAN,
        network_online BOOLEAN,
        network_status VARCHAR(20),
        
        device_os VARCHAR(50),
        device_browser VARCHAR(50),
        device_type VARCHAR(20),
        device_platform VARCHAR(50),
        device_language VARCHAR(10),
        device_cpu_cores INT,
        device_memory INT,
        device_screen_resolution VARCHAR(20),
        device_screen_on BOOLEAN,
        
        is_mock_location BOOLEAN DEFAULT FALSE,
        cell_tower_info JSON,
        
        is_within_geofence BOOLEAN DEFAULT TRUE,
        distance_from_event DECIMAL(10, 2),
        
        recorded_at DATETIME NOT NULL,
        is_moving BOOLEAN,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
        INDEX idx_user_event (user_id, event_id),
        INDEX idx_recorded_at (recorded_at),
        INDEX idx_user_recorded (user_id, recorded_at),
        INDEX idx_battery_level (battery_level),
        INDEX idx_network_status (network_status),
        INDEX idx_device_screen_on (device_screen_on)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table geo_tracking créée\n');

    // ==================== VERIFICATION ====================
    console.log('🔍 Vérification des tables...');
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n✅ TOTAL: ${tables.length} tables dans Railway MySQL:`);
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${Object.values(table)[0]}`);
    });

    console.log('\n✅ Les 3 tables manquantes ont été ajoutées avec succès!');

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

createMissingTables();
