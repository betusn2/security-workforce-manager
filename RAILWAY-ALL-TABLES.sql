-- ============================================
-- SCRIPT SQL ULTRA-COMPLET - TOUTES LES TABLES
-- Security Workforce Manager Database
-- Railway MySQL - Version Complète
-- ============================================
-- 
-- Ce script contient TOUTES les 23 tables du projet:
-- 1. Core (Utilisateurs, Événements, Zones)
-- 2. Affectations et Pointages
-- 3. Tracking GPS Temps Réel
-- 4. Communication (Notifications, Messages)
-- 5. Sécurité et Audit
-- 6. Gamification et Permissions
-- ============================================

-- Désactiver les vérifications de clés étrangères temporairement
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- CATÉGORIE 1 : TABLES PRINCIPALES
-- ============================================

-- TABLE 1: USERS (Utilisateurs)
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
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
  `points` INT DEFAULT 0,
  `level` INT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME,
  INDEX `idx_email` (`email`),
  INDEX `idx_cin` (`cin`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 2: EVENTS (Événements)
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
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

-- TABLE 3: ZONES (Zones géographiques d'événements)
DROP TABLE IF EXISTS `zones`;
CREATE TABLE `zones` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `color` VARCHAR(20) DEFAULT '#3B82F6',
  `capacity` INT,
  `required_agents` INT DEFAULT 1,
  `required_supervisors` INT DEFAULT 0,
  `supervisors` JSON,
  `geo_fence` JSON,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `radius` INT DEFAULT 50,
  `priority` ENUM('low', 'normal', 'high', 'critical') DEFAULT 'normal',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `instructions` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME,
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATÉGORIE 2 : AFFECTATIONS ET POINTAGES
-- ============================================

-- TABLE 4: ASSIGNMENTS (Affectations agents/zones)
DROP TABLE IF EXISTS `assignments`;
CREATE TABLE `assignments` (
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

-- TABLE 5: ATTENDANCE (Pointages check-in/check-out)
DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
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
-- CATÉGORIE 3 : TRACKING GPS TEMPS RÉEL
-- ============================================

-- TABLE 6: GEO_TRACKING (Tracking GPS enrichi)
DROP TABLE IF EXISTS `geo_tracking`;
CREATE TABLE `geo_tracking` (
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

-- TABLE 7: GPS_TRACKING (Tracking GPS simple - legacy)
DROP TABLE IF EXISTS `gps_tracking`;
CREATE TABLE `gps_tracking` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agent_id` INT NOT NULL,
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
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_timestamp` (`timestamp`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 8: TRACKING_ALERTS (Alertes de tracking)
DROP TABLE IF EXISTS `tracking_alerts`;
CREATE TABLE `tracking_alerts` (
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

-- TABLE 9: SOS_ALERTS (Alertes SOS d'urgence)
DROP TABLE IF EXISTS `sos_alerts`;
CREATE TABLE `sos_alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `event_id` INT,
  `alert_type` ENUM('sos', 'medical', 'security', 'fire', 'other') DEFAULT 'sos',
  `status` ENUM('active', 'acknowledged', 'responding', 'resolved', 'false_alarm') DEFAULT 'active',
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `accuracy` DECIMAL(6, 2),
  `photo` TEXT,
  `voice_note_url` TEXT,
  `description` TEXT,
  `acknowledged_by` INT,
  `acknowledged_at` DATETIME,
  `responder_id` INT,
  `response_time` INT,
  `resolution_time` INT,
  `resolved_at` DATETIME,
  `resolution_notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_alert_type` (`alert_type`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATÉGORIE 4 : COMMUNICATION
-- ============================================

-- TABLE 10: NOTIFICATIONS
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
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

-- TABLE 11: CONVERSATIONS (Conversations/Threads)
DROP TABLE IF EXISTS `conversations`;
CREATE TABLE `conversations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255),
  `type` ENUM('direct', 'group', 'event', 'support') DEFAULT 'direct',
  `event_id` INT,
  `participants` JSON NOT NULL,
  `last_message_at` DATETIME,
  `created_by` INT,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_created_by` (`created_by`),
  INDEX `idx_last_message_at` (`last_message_at`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 12: MESSAGES (Messages dans conversations)
DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT NOT NULL,
  `sender_id` INT NOT NULL,
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
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATÉGORIE 5 : SÉCURITÉ ET AUDIT
-- ============================================

-- TABLE 13: FRAUD_ATTEMPTS (Tentatives de fraude)
DROP TABLE IF EXISTS `fraud_attempts`;
CREATE TABLE `fraud_attempts` (
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

-- TABLE 14: LIVENESS_LOGS (Logs de vérification de présence)
DROP TABLE IF EXISTS `liveness_logs`;
CREATE TABLE `liveness_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `event_id` INT,
  `test_type` ENUM('blink', 'smile', 'head_turn', 'passive') DEFAULT 'passive',
  `result` ENUM('passed', 'failed', 'inconclusive') NOT NULL,
  `confidence_score` DECIMAL(5, 4),
  `image_url` TEXT,
  `metadata` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_result` (`result`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 15: ACTIVITY_LOGS (Logs d'audit système)
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
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

-- TABLE 16: INCIDENTS (Incidents signalés)
DROP TABLE IF EXISTS `incidents`;
CREATE TABLE `incidents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT,
  `zone_id` INT,
  `reported_by` INT NOT NULL,
  `incident_type` ENUM('theft', 'violence', 'damage', 'medical', 'safety', 'other') NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `latitude` DECIMAL(10, 8),
  `longitude` DECIMAL(11, 8),
  `photos` JSON,
  `witnesses` JSON,
  `status` ENUM('reported', 'investigating', 'resolved', 'closed') DEFAULT 'reported',
  `assigned_to` INT,
  `resolution` TEXT,
  `resolved_at` DATETIME,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_event_id` (`event_id`),
  INDEX `idx_reported_by` (`reported_by`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATÉGORIE 6 : GAMIFICATION ET PERMISSIONS
-- ============================================

-- TABLE 17: BADGES (Badges de récompense)
DROP TABLE IF EXISTS `badges`;
CREATE TABLE `badges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) UNIQUE NOT NULL,
  `description` TEXT,
  `icon` VARCHAR(50),
  `color` VARCHAR(20) DEFAULT '#3B82F6',
  `category` ENUM('performance', 'attendance', 'experience', 'special', 'training') DEFAULT 'performance',
  `criteria` JSON,
  `points` INT DEFAULT 10,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 18: USER_BADGES (Badges obtenus par utilisateurs)
DROP TABLE IF EXISTS `user_badges`;
CREATE TABLE `user_badges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `badge_id` INT NOT NULL,
  `earned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `awarded_by` INT,
  `reason` TEXT,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_badge_id` (`badge_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 19: PERMISSIONS (Permissions système)
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) UNIQUE NOT NULL,
  `description` TEXT,
  `module` VARCHAR(50),
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_module` (`module`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 20: ROLE_PERMISSIONS (Permissions par rôle)
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role` ENUM('admin', 'supervisor', 'agent') NOT NULL,
  `permission_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_role` (`role`),
  INDEX `idx_permission_id` (`permission_id`),
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 21: USER_PERMISSIONS (Permissions spécifiques utilisateurs)
DROP TABLE IF EXISTS `user_permissions`;
CREATE TABLE `user_permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  `granted_by` INT,
  `granted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_permission_id` (`permission_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CATÉGORIE 7 : DOCUMENTS ET BACKUPS
-- ============================================

-- TABLE 22: USER_DOCUMENTS (Documents utilisateurs)
DROP TABLE IF EXISTS `user_documents`;
CREATE TABLE `user_documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
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
  `verified_by` INT,
  `verified_at` DATETIME,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_document_type` (`document_type`),
  INDEX `idx_expiry_date` (`expiry_date`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 23: SCHEDULED_BACKUPS (Backups planifiés)
DROP TABLE IF EXISTS `scheduled_backups`;
CREATE TABLE `scheduled_backups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `backup_type` ENUM('full', 'incremental', 'differential') DEFAULT 'full',
  `status` ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
  `file_path` VARCHAR(500),
  `file_size` BIGINT,
  `start_time` DATETIME,
  `end_time` DATETIME,
  `duration` INT,
  `error_message` TEXT,
  `metadata` JSON,
  `created_by` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_backup_type` (`backup_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Réactiver les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- INSERTION DONNÉES PAR DÉFAUT
-- ============================================

-- Admin principal (Email: admin@security.com / Password: Admin123!)
INSERT INTO `users` (`cin`, `name`, `email`, `password`, `role`, `phone`, `status`, `points`, `level`)
VALUES (
  'ADMIN001',
  'Administrateur Principal',
  'admin@security.com',
  '$2b$10$rKJ5PxWxmKQp7YvB5pZvLOzGKqN.mZo4MgGjCRpqH9qJKnZqYvB5W',
  'admin',
  '+212600000000',
  'active',
  0,
  1
) ON DUPLICATE KEY UPDATE `cin`=`cin`;

-- Permissions de base
INSERT INTO `permissions` (`name`, `description`, `module`) VALUES
('users.view', 'Voir les utilisateurs', 'users'),
('users.create', 'Créer des utilisateurs', 'users'),
('users.edit', 'Modifier les utilisateurs', 'users'),
('users.delete', 'Supprimer les utilisateurs', 'users'),
('events.view', 'Voir les événements', 'events'),
('events.create', 'Créer des événements', 'events'),
('events.edit', 'Modifier les événements', 'events'),
('events.delete', 'Supprimer les événements', 'events'),
('attendance.view', 'Voir les pointages', 'attendance'),
('attendance.manage', 'Gérer les pointages', 'attendance'),
('tracking.view', 'Voir le tracking GPS', 'tracking'),
('tracking.manage', 'Gérer le tracking GPS', 'tracking'),
('reports.view', 'Voir les rapports', 'reports'),
('reports.export', 'Exporter les rapports', 'reports')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Badges par défaut
INSERT INTO `badges` (`name`, `description`, `icon`, `color`, `category`, `points`) VALUES
('Ponctuel', 'Toujours à l\'heure', '⏰', '#10B981', 'attendance', 50),
('Pro', 'Performance exceptionnelle', '⭐', '#F59E0B', 'performance', 100),
('Vétéran', '1 an d\'expérience', '🏆', '#8B5CF6', 'experience', 200),
('Héros', 'Action héroïque', '🦸', '#EF4444', 'special', 500)
ON DUPLICATE KEY UPDATE `name`=`name`;

-- ============================================
-- STATISTIQUES ET VÉRIFICATION
-- ============================================

-- Compter les tables créées
SELECT 
  '✅ TOUTES LES TABLES CRÉÉES AVEC SUCCÈS!' AS Message,
  COUNT(*) AS Total_Tables
FROM information_schema.tables 
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE';

-- Afficher la liste des tables
SELECT 
  table_name AS Table_Name,
  table_rows AS Approximate_Rows,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS Size_MB
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Afficher l'admin créé
SELECT 
  `cin`, 
  `name`, 
  `email`, 
  `role`, 
  `status`,
  `points`,
  `level`,
  DATE_FORMAT(`created_at`, '%Y-%m-%d %H:%i') AS created
FROM `users` 
WHERE `role` = 'admin'
ORDER BY `created_at`;

-- Afficher les permissions
SELECT COUNT(*) AS Total_Permissions FROM `permissions`;

-- Afficher les badges
SELECT COUNT(*) AS Total_Badges FROM `badges`;

-- ============================================
-- FIN DU SCRIPT - 23 TABLES CRÉÉES
-- ============================================

/*
📊 RÉSUMÉ DES TABLES:

CORE (3):
1. users - Utilisateurs
2. events - Événements
3. zones - Zones géographiques

AFFECTATIONS (2):
4. assignments - Affectations
5. attendance - Pointages

TRACKING GPS (4):
6. geo_tracking - Tracking enrichi
7. gps_tracking - Tracking simple
8. tracking_alerts - Alertes tracking
9. sos_alerts - Alertes SOS

COMMUNICATION (3):
10. notifications - Notifications
11. conversations - Conversations
12. messages - Messages

SÉCURITÉ & AUDIT (4):
13. fraud_attempts - Fraudes
14. liveness_logs - Vérification présence
15. activity_logs - Logs audit
16. incidents - Incidents

GAMIFICATION (3):
17. badges - Badges
18. user_badges - Badges utilisateurs
19. permissions - Permissions

PERMISSIONS (2):
20. role_permissions - Permissions rôles
21. user_permissions - Permissions utilisateurs

DOCUMENTS (2):
22. user_documents - Documents
23. scheduled_backups - Backups

TOTAL: 23 TABLES
*/
