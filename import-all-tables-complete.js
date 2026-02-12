// ============================================
// Import TOUTES les tables du projet vers Railway
// ============================================

const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  database: 'railway',
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createAllTables() {
  console.log('🚀 Création de TOUTES les tables du projet...\n');
  
  let connection;
  
  try {
    console.log('🔗 Connexion à Railway MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connecté!\n');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS=0');
    
    // Tables déjà créées (on les garde)
    console.log('✅ Tables principales déjà existantes:');
    console.log('   - users, events, assignments, attendance');
    console.log('   - notifications, activity_logs\n');
    
    // 7. ZONES
    console.log('📋 Création table ZONES...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS zones (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        event_id CHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#3B82F6',
        capacity INT,
        required_agents INT DEFAULT 1,
        required_supervisors INT DEFAULT 0,
        supervisors JSON,
        priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        geo_radius INT DEFAULT 50,
        instructions TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        \`order\` INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        INDEX idx_event_id (event_id),
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table zones');
    
    // 8. CONVERSATIONS
    console.log('📋 Création table CONVERSATIONS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        event_id CHAR(36),
        type ENUM('direct', 'group', 'event_broadcast') NOT NULL DEFAULT 'direct',
        name VARCHAR(255),
        created_by CHAR(36) NOT NULL,
        participants JSON,
        last_message_id CHAR(36),
        last_message_at DATETIME,
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_event_id (event_id),
        INDEX idx_created_by (created_by),
        INDEX idx_last_message_at (last_message_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table conversations');
    
    // 9. MESSAGES
    console.log('📋 Création table MESSAGES...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        conversation_id CHAR(36) NOT NULL,
        sender_id CHAR(36) NOT NULL,
        recipient_id CHAR(36),
        event_id CHAR(36),
        message_type ENUM('text', 'image', 'file', 'location', 'voice', 'system') DEFAULT 'text',
        content TEXT,
        file_url TEXT,
        file_name VARCHAR(255),
        file_size INT,
        file_mime_type VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        delivered_at DATETIME,
        read_at DATETIME,
        is_broadcast BOOLEAN DEFAULT FALSE,
        is_urgent BOOLEAN DEFAULT FALSE,
        reply_to_id CHAR(36),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_sender_id (sender_id),
        INDEX idx_recipient_id (recipient_id),
        INDEX idx_event_id (event_id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table messages');
    
    // 10. FRAUD_ATTEMPTS
    console.log('📋 Création table FRAUD_ATTEMPTS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS fraud_attempts (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36),
        event_id CHAR(36),
        attempt_type ENUM('gps_spoofing', 'photo_spoofing', 'video_spoofing', 'screen_spoofing', 
                          'document_forgery', 'multiple_device', 'out_of_zone', 'time_manipulation',
                          'identity_mismatch', 'root_device', 'vpn_detected', 'other') NOT NULL,
        severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
        description TEXT,
        details JSON,
        evidence_photo LONGTEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        device_fingerprint VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent TEXT,
        action_taken ENUM('blocked', 'warned', 'logged', 'escalated', 'ignored') DEFAULT 'logged',
        blocked_until DATETIME,
        reviewed_by CHAR(36),
        reviewed_at DATETIME,
        review_notes TEXT,
        resolution ENUM('confirmed', 'false_positive', 'pending') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_event_id (event_id),
        INDEX idx_attempt_type (attempt_type),
        INDEX idx_severity (severity),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table fraud_attempts');
    
    // 11. SOS_ALERTS
    console.log('📋 Création table SOS_ALERTS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sos_alerts (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        event_id CHAR(36),
        alert_type ENUM('sos', 'medical', 'security', 'fire', 'other') NOT NULL DEFAULT 'sos',
        status ENUM('active', 'acknowledged', 'responding', 'resolved', 'false_alarm') NOT NULL DEFAULT 'active',
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy DECIMAL(6, 2),
        photo TEXT,
        voice_note_url TEXT,
        description TEXT,
        acknowledged_by CHAR(36),
        acknowledged_at DATETIME,
        resolved_by CHAR(36),
        resolved_at DATETIME,
        resolution_notes TEXT,
        response_time_seconds INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_event_id (event_id),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table sos_alerts');
    
    // 12. PERMISSIONS
    console.log('📋 Création table PERMISSIONS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS permissions (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_module (module),
        INDEX idx_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table permissions');
    
    // 13. ROLE_PERMISSIONS
    console.log('📋 Création table ROLE_PERMISSIONS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        role ENUM('admin', 'supervisor', 'agent') NOT NULL,
        permission_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_role (role),
        INDEX idx_permission_id (permission_id),
        UNIQUE KEY unique_role_permission (role, permission_id),
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table role_permissions');
    
    // 14. USER_PERMISSIONS
    console.log('📋 Création table USER_PERMISSIONS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        permission_id CHAR(36) NOT NULL,
        granted_by CHAR(36),
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_permission_id (permission_id),
        UNIQUE KEY unique_user_permission (user_id, permission_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table user_permissions');
    
    // 15. USER_DOCUMENTS
    console.log('📋 Création table USER_DOCUMENTS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_documents (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        document_type ENUM('cin_recto', 'cin_verso', 'photo', 'cv', 'fiche_anthropometrique', 
                           'permis', 'diplome', 'autre') NOT NULL,
        custom_name VARCHAR(255),
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_extension VARCHAR(10) NOT NULL,
        file_content LONGTEXT,
        description TEXT,
        is_required BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        verified_by CHAR(36),
        verified_at DATETIME,
        expiration_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        INDEX idx_user_id (user_id),
        INDEX idx_document_type (document_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table user_documents');
    
    // 16. BADGES (accomplissements)
    console.log('📋 Création table BADGES...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS badges (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        badge_type ENUM('punctuality', 'attendance', 'performance', 'safety', 'teamwork', 
                        'leadership', 'training', 'years_service', 'special') NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(255),
        color VARCHAR(20),
        level ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
        points INT DEFAULT 0,
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_badge_type (badge_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table badges');
    
    // 17. TRACKING_ALERTS
    console.log('📋 Création table TRACKING_ALERTS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tracking_alerts (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        event_id CHAR(36),
        alert_type ENUM('stopped', 'out_of_zone', 'low_battery', 'signal_lost', 'unusual_movement') NOT NULL,
        severity ENUM('info', 'warning', 'critical') DEFAULT 'warning',
        message TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        battery_level INT,
        acknowledged BOOLEAN DEFAULT FALSE,
        acknowledged_by CHAR(36),
        acknowledged_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_event_id (event_id),
        INDEX idx_alert_type (alert_type),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table tracking_alerts');
    
    // 18. LIVENESS_LOGS
    console.log('📋 Création table LIVENESS_LOGS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS liveness_logs (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        event_id CHAR(36),
        success BOOLEAN NOT NULL,
        confidence_score DECIMAL(5, 4),
        liveness_type ENUM('blink', 'smile', 'head_turn', 'passive', 'active') DEFAULT 'passive',
        video_url TEXT,
        failure_reason VARCHAR(255),
        device_info JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_event_id (event_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table liveness_logs');
    
    // 19. SCHEDULED_BACKUPS
    console.log('📋 Création table SCHEDULED_BACKUPS...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_backups (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        backup_type ENUM('full', 'incremental', 'data_only', 'schema_only') NOT NULL DEFAULT 'full',
        status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
        file_path TEXT,
        file_size BIGINT,
        started_at DATETIME,
        completed_at DATETIME,
        error_message TEXT,
        triggered_by CHAR(36),
        is_automatic BOOLEAN DEFAULT TRUE,
        retention_days INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Table scheduled_backups');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS=1');
    
    // Vérification finale
    console.log('\n🔍 Vérification finale...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`\n✅ TOTAL: ${tables.length} tables créées dans Railway MySQL:`);
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${Object.values(table)[0]}`);
    });
    
    console.log('\n🎉 TOUTES LES TABLES DU PROJET SONT MAINTENANT DANS RAILWAY!');
    console.log('\n📊 Prochaine étape:');
    console.log('   Configurez les variables d\'environnement du backend Railway');
    console.log('   avec les valeurs du fichier RAILWAY-BACKEND-VARIABLES.txt');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Déconnecté de Railway');
    }
  }
}

createAllTables();
