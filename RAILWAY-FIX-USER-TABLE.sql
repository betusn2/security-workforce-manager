-- ============================================
-- FIX TABLE USERS - Correspondance exacte avec le modèle backend
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- Supprimer l'ancienne table users
DROP TABLE IF EXISTS `user_permissions`;
DROP TABLE IF EXISTS `user_badges`;
DROP TABLE IF EXISTS `user_documents`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `fraud_attempts`;
DROP TABLE IF EXISTS `liveness_logs`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `tracking_alerts`;
DROP TABLE IF EXISTS `sos_alerts`;
DROP TABLE IF EXISTS `incidents`;
DROP TABLE IF EXISTS `gps_tracking`;
DROP TABLE IF EXISTS `geo_tracking`;
DROP TABLE IF EXISTS `attendance`;
DROP TABLE IF EXISTS `assignments`;
DROP TABLE IF EXISTS `conversations`;
DROP TABLE IF EXISTS `events`;
DROP TABLE IF EXISTS `zones`;
DROP TABLE IF EXISTS `badges`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `users`;

-- Recréer TABLE USERS avec la bonne structure
CREATE TABLE `users` (
  `id` CHAR(36) PRIMARY KEY,
  `employee_id` VARCHAR(20) UNIQUE NOT NULL,
  `cin` VARCHAR(20),
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20),
  `whatsapp_number` VARCHAR(20),
  `role` ENUM('agent', 'supervisor', 'admin', 'user') DEFAULT 'agent',
  `profile_photo` TEXT,
  `facial_vector` TEXT,
  `facial_descriptor` TEXT,
  `facial_vector_updated_at` DATETIME,
  `address` TEXT,
  `date_of_birth` DATE,
  `hire_date` DATE,
  `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  `last_login` DATETIME,
  `notification_preferences` JSON,
  `refresh_token` TEXT,
  `height` INT COMMENT 'Taille en cm',
  `weight` INT COMMENT 'Poids en kg',
  `diploma` VARCHAR(255),
  `diploma_level` ENUM('cap', 'bac', 'bac+2', 'bac+3', 'bac+5', 'autre'),
  `security_card` VARCHAR(100),
  `security_card_expiry` DATE,
  `experience_years` INT DEFAULT 0,
  `specializations` JSON,
  `languages` JSON,
  `current_latitude` DECIMAL(10, 8),
  `current_longitude` DECIMAL(11, 8),
  `last_location_update` DATETIME,
  `rating` DECIMAL(3, 2) DEFAULT 0,
  `total_ratings` INT DEFAULT 0,
  `punctuality_score` INT DEFAULT 100,
  `reliability_score` INT DEFAULT 100,
  `professionalism_score` INT DEFAULT 100,
  `overall_score` INT DEFAULT 0,
  `emergency_contact` VARCHAR(100),
  `emergency_phone` VARCHAR(20),
  `id_card_number` VARCHAR(50),
  `social_security_number` VARCHAR(50),
  `bank_details` JSON,
  `supervisor_id` CHAR(36),
  `authorized_devices` JSON,
  `last_check_in_location` JSON,
  `created_by_type` ENUM('admin', 'supervisor', 'self_registration') DEFAULT 'admin',
  `created_by_user_id` CHAR(36),
  `is_temporary` BOOLEAN DEFAULT FALSE,
  `validated_by` CHAR(36),
  `validated_at` DATETIME,
  `last_liveness_check` DATETIME,
  `fraud_score` INT DEFAULT 0,
  `device_fingerprints` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME,
  INDEX `idx_email` (`email`),
  INDEX `idx_cin` (`cin`),
  INDEX `idx_employee_id` (`employee_id`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recréer les tables dépendantes
CREATE TABLE `assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` CHAR(36) NOT NULL,
  `event_id` INT NOT NULL,
  `zone_id` INT,
  `assigned_by` CHAR(36),
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
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` CHAR(36) NOT NULL,
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
  `checked_in_by` CHAR(36),
  `checked_out_by` CHAR(36),
  `verified_by` CHAR(36),
  `verified_at` DATETIME,
  `device_info` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agent_id` (`agent_id`),
  INDEX `idx_event_id` (`event_id`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `geo_tracking` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` CHAR(36) NOT NULL,
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
  INDEX `idx_timestamp` (`timestamp`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `gps_tracking` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` CHAR(36) NOT NULL,
  `event_id` INT,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `accuracy` DECIMAL(10, 2),
  `speed` DECIMAL(10, 2),
  `heading` DECIMAL(5, 2),
  `altitude` DECIMAL(10, 2),
  `battery_level` INT,
  `is_moving` BOOLEAN DEFAULT FALSE,
  `timestamp` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_agent_id` (`agent_id`),
  INDEX `idx_timestamp` (`timestamp`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tracking_alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tracking_id` INT NOT NULL,
  `agent_id` CHAR(36) NOT NULL,
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
  `acknowledged_by` CHAR(36),
  `acknowledged_at` DATETIME,
  `resolved` BOOLEAN DEFAULT FALSE,
  `resolved_by` CHAR(36),
  `resolved_at` DATETIME,
  `resolution_notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_agent_id` (`agent_id`),
  FOREIGN KEY (`tracking_id`) REFERENCES `geo_tracking`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sos_alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `event_id` INT,
  `alert_type` ENUM('sos', 'medical', 'security', 'fire', 'other') DEFAULT 'sos',
  `status` ENUM('active', 'acknowledged', 'responding', 'resolved', 'false_alarm') DEFAULT 'active',
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `accuracy` DECIMAL(6, 2),
  `photo` TEXT,
  `voice_note_url` TEXT,
  `description` TEXT,
  `acknowledged_by` CHAR(36),
  `acknowledged_at` DATETIME,
  `responder_id` CHAR(36),
  `response_time` INT,
  `resolution_time` INT,
  `resolved_at` DATETIME,
  `resolution_notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
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
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `type` ENUM('text', 'image', 'voice', 'video', 'file', 'location', 'system') DEFAULT 'text',
  `attachments` JSON,
  `metadata` JSON,
  `read_by` JSON,
  `delivered_to` JSON,
  `is_edited` BOOLEAN DEFAULT FALSE,
  `edited_at` DATETIME,
  `is_deleted` BOOLEAN DEFAULT FALSE,
  `deleted_at` DATETIME,
  `reply_to_id` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_conversation_id` (`conversation_id`),
  INDEX `idx_sender_id` (`sender_id`),
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fraud_attempts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` CHAR(36),
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
  `detected_by_user_id` CHAR(36),
  `status` ENUM('pending', 'investigating', 'confirmed', 'false_positive', 'resolved') DEFAULT 'pending',
  `investigated_by` CHAR(36),
  `investigated_at` DATETIME,
  `resolution` TEXT,
  `resolved_by` CHAR(36),
  `resolved_at` DATETIME,
  `action_taken` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agent_id` (`agent_id`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `liveness_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `event_id` INT,
  `test_type` ENUM('blink', 'smile', 'head_turn', 'passive') DEFAULT 'passive',
  `result` ENUM('passed', 'failed', 'inconclusive') NOT NULL,
  `confidence_score` DECIMAL(5, 4),
  `image_url` TEXT,
  `metadata` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36),
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
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `incidents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT,
  `zone_id` INT,
  `reported_by` CHAR(36) NOT NULL,
  `incident_type` ENUM('theft', 'violence', 'damage', 'medical', 'safety', 'other') NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `photos` JSON,
  `witnesses` JSON,
  `status` ENUM('reported', 'investigating', 'resolved', 'closed') DEFAULT 'reported',
  `assigned_to` CHAR(36),
  `resolution` TEXT,
  `resolved_at` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_reported_by` (`reported_by`),
  FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_badges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `badge_id` INT NOT NULL,
  `earned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `awarded_by` CHAR(36),
  `reason` TEXT,
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `permission_id` INT NOT NULL,
  `granted_by` CHAR(36),
  `granted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `document_type` ENUM('id_card', 'passport', 'contract', 'certificate', 'training', 'medical', 'other') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `file_url` TEXT NOT NULL,
  `file_name` VARCHAR(255),
  `file_size` INT,
  `file_type` VARCHAR(50),
  `description` TEXT,
  `issue_date` DATE,
  `expiry_date` DATE,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `verified_by` CHAR(36),
  `verified_at` DATETIME,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Insérer l'admin avec UUID
INSERT INTO `users` (
  `id`,
  `employee_id`,
  `cin`,
  `first_name`,
  `last_name`,
  `email`,
  `password`,
  `role`,
  `phone`,
  `status`,
  `punctuality_score`,
  `reliability_score`,
  `professionalism_score`
) VALUES (
  UUID(),
  'ADMIN001',
  'ADMIN001',
  'Administrateur',
  'Principal',
  'admin@security.com',
  '$2b$10$rKJ5PxWxmKQp7YvB5pZvLOzGKqN.mZo4MgGjCRpqH9qJKnZqYvB5W',
  'admin',
  '+212600000000',
  'active',
  100,
  100,
  100
);

-- Vérifier
SELECT 
  SUBSTRING(id, 1, 8) as id_short,
  employee_id,
  first_name,
  last_name,
  email,
  role,
  status
FROM users 
WHERE role = 'admin';

SELECT '✅ Table users recréée avec la bonne structure (UUID + 60 colonnes)!' as Status;
