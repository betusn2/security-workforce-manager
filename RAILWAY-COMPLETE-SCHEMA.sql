-- ============================================
-- SCRIPT SQL COMPLET - RAILWAY MYSQL
-- Security Workforce Manager Database Schema
-- ============================================

-- Supprimer les vues et tables existantes (si vous voulez recommencer à zéro)
-- ATTENTION: Décommenter seulement si vous voulez tout réinitialiser!
-- DROP TABLE IF EXISTS tracking_alerts;
-- DROP TABLE IF EXISTS geo_tracking;
-- DROP TABLE IF EXISTS fraud_attempts;
-- DROP TABLE IF EXISTS activity_logs;
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS attendance;
-- DROP TABLE IF EXISTS assignments;
-- DROP TABLE IF EXISTS zones;
-- DROP TABLE IF EXISTS events;
-- DROP TABLE IF EXISTS users;

-- ============================================
-- TABLE 1: USERS (Utilisateurs)
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cin` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'supervisor', 'agent') DEFAULT 'agent',
  `phone` VARCHAR(20),
  `photo` TEXT,
  `facial_descriptor` TEXT,
  `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `refresh_token` TEXT,
  `last_login` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME,
  INDEX `idx_email` (`email`),
  INDEX `idx_cin` (`cin`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 2: EVENTS (Événements)
-- ============================================
CREATE TABLE IF NOT EXISTS `events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `type` ENUM('regular', 'special', 'emergency') DEFAULT 'regular',
  `location` VARCHAR(500) NOT NULL,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `geo_radius` INT DEFAULT 100,
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `check_in_time` TIME NOT NULL,
  `check_out_time` TIME NOT NULL,
  `late_threshold` INT DEFAULT 15,
  `agent_creation_buffer` INT DEFAULT 3600,
  `required_agents` INT DEFAULT 1,
  `status` ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled', 'terminated') DEFAULT 'draft',
  `priority` ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  `color` VARCHAR(20),
  `recurrence_type` ENUM('none', 'daily', 'weekly', 'monthly') DEFAULT 'none',
  `recurrence_end_date` DATE,
  `contact_name` VARCHAR(255),
  `contact_phone` VARCHAR(20),
  `recurrence` JSON,
  `created_by` INT,
  `supervisor_id` INT,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME,
  INDEX `idx_status` (`status`),
  INDEX `idx_start_date` (`start_date`),
  INDEX `idx_created_by` (`created_by`),
  INDEX `idx_supervisor_id` (`supervisor_id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 3: ZONES
-- ============================================
CREATE TABLE IF NOT EXISTS `zones` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `geo_fence` JSON,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `radius` INT DEFAULT 50,
  `color` VARCHAR(20),
  `required_agents` INT DEFAULT 1,
  `priority` ENUM('low', 'normal', 'high', 'critical') DEFAULT 'normal',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `supervisor_id` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME,
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 4: ASSIGNMENTS (Affectations)
-- ============================================
CREATE TABLE IF NOT EXISTS `assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` INT NOT NULL,
  `event_id` INT NOT NULL,
  `zone_id` INT,
  `assigned_by` INT,
  `role` ENUM('primary', 'backup', 'supervisor') DEFAULT 'primary',
  `status` ENUM('pending', 'confirmed', 'declined', 'cancelled') DEFAULT 'pending',
  `confirmed_at` DATETIME,
  `notes` TEXT,
  `notification_sent` BOOLEAN DEFAULT FALSE,
  `notification_sent_at` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME,
  INDEX `idx_agent_id` (`agent_id`),
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_zone_id` (`zone_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 5: ATTENDANCE (Pointages)
-- ============================================
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` INT NOT NULL,
  `event_id` INT NOT NULL,
  `assignment_id` INT,
  `date` DATE NOT NULL,
  `check_in_time` DATETIME,
  `check_out_time` DATETIME,
  `check_in_latitude` DECIMAL(10, 8),
  `check_in_longitude` DECIMAL(11, 8),
  `check_out_latitude` DECIMAL(10, 8),
  `check_out_longitude` DECIMAL(11, 8),
  `check_in_photo` TEXT,
  `check_out_photo` TEXT,
  `check_in_method` ENUM('facial', 'manual', 'qrcode', 'nfc') DEFAULT 'facial',
  `check_out_method` ENUM('facial', 'manual', 'qrcode', 'nfc'),
  `facial_match_score` DECIMAL(5, 4),
  `status` ENUM('present', 'late', 'absent', 'excused', 'early_departure') DEFAULT 'present',
  `is_within_geofence` BOOLEAN DEFAULT TRUE,
  `distance_from_location` INT,
  `total_hours` DECIMAL(5, 2),
  `overtime_hours` DECIMAL(5, 2) DEFAULT 0,
  `notes` TEXT,
  `checked_in_by` INT,
  `checked_out_by` INT,
  `verified_by` INT,
  `verified_at` DATETIME,
  `device_info` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agent_id` (`agent_id`),
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_date` (`date`),
  INDEX `idx_status` (`status`),
  INDEX `idx_check_in_time` (`check_in_time`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 6: GEO_TRACKING (Tracking GPS temps réel)
-- ============================================
CREATE TABLE IF NOT EXISTS `geo_tracking` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` INT NOT NULL,
  `event_id` INT,
  `zone_id` INT,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `accuracy` DECIMAL(10, 2),
  `altitude` DECIMAL(10, 2),
  `speed` DECIMAL(10, 2),
  `heading` DECIMAL(5, 2),
  `battery_level` INT,
  `is_moving` BOOLEAN DEFAULT FALSE,
  `activity_type` VARCHAR(50),
  `device_id` VARCHAR(100),
  `network_type` VARCHAR(20),
  `provider` VARCHAR(50),
  `is_mock_location` BOOLEAN DEFAULT FALSE,
  `address` VARCHAR(500),
  `city` VARCHAR(100),
  `country` VARCHAR(100),
  `status` ENUM('active', 'inactive', 'paused') DEFAULT 'active',
  `timestamp` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_agent_id` (`agent_id`),
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_zone_id` (`zone_id`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 7: TRACKING_ALERTS (Alertes de tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS `tracking_alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tracking_id` INT NOT NULL,
  `agent_id` INT NOT NULL,
  `event_id` INT,
  `zone_id` INT,
  `alert_type` ENUM('zone_entry', 'zone_exit', 'geofence_violation', 'speed_alert', 'low_battery', 'signal_lost', 'mock_location') NOT NULL,
  `severity` ENUM('info', 'warning', 'critical') DEFAULT 'info',
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `metadata` JSON,
  `acknowledged` BOOLEAN DEFAULT FALSE,
  `acknowledged_by` INT,
  `acknowledged_at` DATETIME,
  `resolved` BOOLEAN DEFAULT FALSE,
  `resolved_by` INT,
  `resolved_at` DATETIME,
  `resolution_notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tracking_id` (`tracking_id`),
  INDEX `idx_agent_id` (`agent_id`),
  INDEX `idx_alert_type` (`alert_type`),
  INDEX `idx_severity` (`severity`),
  INDEX `idx_acknowledged` (`acknowledged`),
  FOREIGN KEY (`tracking_id`) REFERENCES `geo_tracking`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 8: NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `type` ENUM('assignment', 'reminder', 'attendance', 'late_alert', 'absence_alert', 'schedule_change', 'system', 'general', 'tracking_alert') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `channel` ENUM('email', 'sms', 'whatsapp', 'push', 'in_app') NOT NULL,
  `status` ENUM('pending', 'sent', 'delivered', 'failed', 'read') DEFAULT 'pending',
  `sent_at` DATETIME,
  `delivered_at` DATETIME,
  `read_at` DATETIME,
  `failed_at` DATETIME,
  `failure_reason` TEXT,
  `retry_count` INT DEFAULT 0,
  `max_retries` INT DEFAULT 3,
  `metadata` JSON,
  `external_id` VARCHAR(255),
  `priority` ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  `scheduled_for` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`),
  INDEX `idx_scheduled_for` (`scheduled_for`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 9: FRAUD_ATTEMPTS (Tentatives de fraude)
-- ============================================
CREATE TABLE IF NOT EXISTS `fraud_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` INT,
  `event_id` INT,
  `attempt_type` ENUM('wrong_person', 'fake_photo', 'location_spoof', 'time_manipulation', 'duplicate_checkin', 'suspicious_device', 'other') NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `description` TEXT,
  `evidence` JSON,
  `photo_url` TEXT,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `ip_address` VARCHAR(45),
  `device_info` JSON,
  `facial_match_score` DECIMAL(5, 4),
  `expected_location` VARCHAR(500),
  `actual_location` VARCHAR(500),
  `distance_discrepancy` INT,
  `detected_by` ENUM('system', 'supervisor', 'admin') DEFAULT 'system',
  `detected_by_user_id` INT,
  `status` ENUM('pending', 'investigating', 'confirmed', 'false_positive', 'resolved') DEFAULT 'pending',
  `investigated_by` INT,
  `investigated_at` DATETIME,
  `resolution` TEXT,
  `resolved_by` INT,
  `resolved_at` DATETIME,
  `action_taken` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agent_id` (`agent_id`),
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_attempt_type` (`attempt_type`),
  INDEX `idx_severity` (`severity`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE 10: ACTIVITY_LOGS (Logs d'activité)
-- ============================================
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT,
  `description` TEXT,
  `old_values` JSON,
  `new_values` JSON,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `device_info` JSON,
  `location` JSON,
  `status` ENUM('success', 'failure', 'warning') DEFAULT 'success',
  `error_message` TEXT,
  `metadata` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_entity_type` (`entity_type`),
  INDEX `idx_entity_id` (`entity_id`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERTION COMPTE ADMIN PAR DÉFAUT
-- ============================================

-- Admin (Email: admin@security.com / Password: Admin123!)
-- Mot de passe hashé avec bcrypt
INSERT INTO `users` (`cin`, `name`, `email`, `password`, `role`, `phone`, `status`)
VALUES (
  'ADMIN001',
  'Administrateur Principal',
  'admin@security.com',
  '$2b$10$rKJ5PxWxmKQp7YvB5pZvLOzGKqN.mZo4MgGjCRpqH9qJKnZqYvB5W',
  'admin',
  '+212600000000',
  'active'
) ON DUPLICATE KEY UPDATE `cin`=`cin`;

-- ============================================
-- VÉRIFICATION ET STATISTIQUES
-- ============================================

-- Afficher toutes les tables créées
SELECT 
  'Tables créées avec succès!' AS Message,
  COUNT(*) AS Total_Tables
FROM information_schema.tables 
WHERE table_schema = DATABASE();

-- Afficher les utilisateurs
SELECT 
  `cin`, 
  `name`, 
  `email`, 
  `role`, 
  `status`,
  DATE_FORMAT(`created_at`, '%Y-%m-%d %H:%i') AS created
FROM `users` 
ORDER BY `role`, `name`;

-- ============================================
-- FIN DU SCRIPT
-- ============================================
