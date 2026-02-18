-- ============================================
-- CRÉATION COMPLÈTE DE TOUTES LES 23 TABLES
-- Compatible Railway MySQL / MySQL 8.x
-- Généré à partir des modèles Sequelize
-- ============================================
-- Copiez tout ce fichier et exécutez-le dans:
-- Railway Dashboard → MySQL → Database → Query
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- SUPPRESSION DES TABLES EXISTANTES
-- (ordre inverse des dépendances)
-- ============================================
DROP TABLE IF EXISTS `scheduled_backups`;
DROP TABLE IF EXISTS `sos_alerts`;
DROP TABLE IF EXISTS `fraud_attempts`;
DROP TABLE IF EXISTS `liveness_logs`;
DROP TABLE IF EXISTS `tracking_alerts`;
DROP TABLE IF EXISTS `gps_tracking`;
DROP TABLE IF EXISTS `geo_tracking`;
DROP TABLE IF EXISTS `user_permissions`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `conversations`;
DROP TABLE IF EXISTS `user_documents`;
DROP TABLE IF EXISTS `user_badges`;
DROP TABLE IF EXISTS `badges`;
DROP TABLE IF EXISTS `incidents`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `attendance`;
DROP TABLE IF EXISTS `assignments`;
DROP TABLE IF EXISTS `zones`;
DROP TABLE IF EXISTS `events`;
DROP TABLE IF EXISTS `users`;

-- ============================================
-- 1. TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `employee_id` VARCHAR(20) UNIQUE NOT NULL,
  `cin` VARCHAR(20) NULL DEFAULT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NULL DEFAULT NULL,
  `whatsapp_number` VARCHAR(20) NULL DEFAULT NULL,
  `role` ENUM('agent', 'supervisor', 'admin', 'user') NOT NULL DEFAULT 'agent',
  `profile_photo` LONGTEXT NULL DEFAULT NULL,
  `facial_vector` LONGTEXT NULL DEFAULT NULL,
  `facial_descriptor` LONGTEXT NULL DEFAULT NULL,
  `facial_vector_updated_at` DATETIME NULL DEFAULT NULL,
  `address` TEXT NULL DEFAULT NULL,
  `date_of_birth` DATE NULL DEFAULT NULL,
  `hire_date` DATE NULL DEFAULT NULL,
  `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  `last_login` DATETIME NULL DEFAULT NULL,
  `notification_preferences` JSON NULL DEFAULT NULL,
  `refresh_token` TEXT NULL DEFAULT NULL,
  `height` INT NULL DEFAULT NULL,
  `weight` INT NULL DEFAULT NULL,
  `diploma` VARCHAR(255) NULL DEFAULT NULL,
  `diploma_level` ENUM('cap', 'bac', 'bac+2', 'bac+3', 'bac+5', 'autre') NULL DEFAULT NULL,
  `security_card` VARCHAR(100) NULL DEFAULT NULL,
  `security_card_expiry` DATE NULL DEFAULT NULL,
  `experience_years` INT DEFAULT 0,
  `specializations` JSON NULL DEFAULT NULL,
  `languages` JSON NULL DEFAULT NULL,
  `current_latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `current_longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `last_location_update` DATETIME NULL DEFAULT NULL,
  `rating` DECIMAL(3, 2) DEFAULT 0,
  `total_ratings` INT DEFAULT 0,
  `punctuality_score` INT DEFAULT 100,
  `reliability_score` INT DEFAULT 100,
  `professionalism_score` INT DEFAULT 100,
  `overall_score` INT DEFAULT 0,
  `emergency_contact` VARCHAR(100) NULL DEFAULT NULL,
  `emergency_phone` VARCHAR(20) NULL DEFAULT NULL,
  `id_card_number` VARCHAR(50) NULL DEFAULT NULL,
  `social_security_number` VARCHAR(50) NULL DEFAULT NULL,
  `bank_details` JSON NULL DEFAULT NULL,
  `supervisor_id` CHAR(36) NULL DEFAULT NULL,
  `authorized_devices` JSON NULL DEFAULT NULL,
  `last_check_in_location` JSON NULL DEFAULT NULL,
  `created_by_type` ENUM('admin', 'supervisor', 'self_registration') NULL DEFAULT 'admin',
  `created_by_user_id` CHAR(36) NULL DEFAULT NULL,
  `is_temporary` BOOLEAN DEFAULT FALSE,
  `validated_by` CHAR(36) NULL DEFAULT NULL,
  `validated_at` DATETIME NULL DEFAULT NULL,
  `last_liveness_check` DATETIME NULL DEFAULT NULL,
  `fraud_score` INT DEFAULT 0,
  `device_fingerprints` JSON NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_employee_id` (`employee_id`),
  INDEX `idx_users_cin` (`cin`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`),
  FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. TABLE: events
-- ============================================
CREATE TABLE IF NOT EXISTS `events` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `type` ENUM('regular', 'special', 'emergency') NOT NULL DEFAULT 'regular',
  `location` VARCHAR(500) NOT NULL,
  `latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `geo_radius` INT DEFAULT 100,
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `check_in_time` TIME NOT NULL,
  `check_out_time` TIME NOT NULL,
  `late_threshold` INT DEFAULT 15,
  `agent_creation_buffer` INT DEFAULT 120,
  `required_agents` INT DEFAULT 1,
  `status` ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
  `priority` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  `color` VARCHAR(7) DEFAULT '#3B82F6',
  `recurrence_type` ENUM('none', 'daily', 'weekly', 'biweekly', 'monthly') NOT NULL DEFAULT 'none',
  `recurrence_end_date` DATETIME NULL DEFAULT NULL,
  `contact_name` VARCHAR(100) NULL DEFAULT NULL,
  `contact_phone` VARCHAR(20) NULL DEFAULT NULL,
  `recurrence` JSON NULL DEFAULT NULL,
  `created_by` CHAR(36) NULL DEFAULT NULL,
  `supervisor_id` CHAR(36) NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_events_status` (`status`),
  INDEX `idx_events_start_date` (`start_date`),
  INDEX `idx_events_created_by` (`created_by`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. TABLE: zones
-- ============================================
CREATE TABLE IF NOT EXISTS `zones` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `event_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `color` VARCHAR(20) DEFAULT '#3B82F6',
  `capacity` INT NULL DEFAULT NULL,
  `required_agents` INT DEFAULT 1,
  `required_supervisors` INT DEFAULT 0,
  `supervisors` JSON NULL DEFAULT NULL,
  `priority` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `geo_radius` INT DEFAULT 50,
  `instructions` TEXT NULL DEFAULT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_zones_event_id` (`event_id`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. TABLE: assignments
-- ============================================
CREATE TABLE IF NOT EXISTS `assignments` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `agent_id` CHAR(36) NOT NULL,
  `event_id` CHAR(36) NOT NULL,
  `assigned_by` CHAR(36) NULL DEFAULT NULL,
  `zone_id` CHAR(36) NULL DEFAULT NULL,
  `role` ENUM('primary', 'backup', 'supervisor') DEFAULT 'primary',
  `status` ENUM('pending', 'confirmed', 'declined', 'cancelled') DEFAULT 'pending',
  `confirmed_at` DATETIME NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `notification_sent` BOOLEAN DEFAULT FALSE,
  `notification_sent_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_assignments_agent_id` (`agent_id`),
  INDEX `idx_assignments_event_id` (`event_id`),
  INDEX `idx_assignments_status` (`status`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`zone_id`) REFERENCES `zones`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. TABLE: attendance
-- ============================================
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `agent_id` CHAR(36) NOT NULL,
  `event_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `check_in_time` DATETIME NULL DEFAULT NULL,
  `check_out_time` DATETIME NULL DEFAULT NULL,
  `check_in_latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `check_in_longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `check_out_latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `check_out_longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `check_in_photo` LONGTEXT NULL DEFAULT NULL,
  `check_out_photo` LONGTEXT NULL DEFAULT NULL,
  `check_in_method` ENUM('facial', 'manual', 'qrcode') DEFAULT 'facial',
  `check_out_method` ENUM('facial', 'manual', 'qrcode') NULL DEFAULT NULL,
  `check_in_device_name` VARCHAR(255) NULL DEFAULT NULL,
  `check_in_device_ip` VARCHAR(45) NULL DEFAULT NULL,
  `check_in_device_mac` VARCHAR(17) NULL DEFAULT NULL,
  `checked_in_by` CHAR(36) NULL DEFAULT NULL,
  `check_out_device_name` VARCHAR(255) NULL DEFAULT NULL,
  `check_out_device_ip` VARCHAR(45) NULL DEFAULT NULL,
  `check_out_device_mac` VARCHAR(17) NULL DEFAULT NULL,
  `facial_match_score` DECIMAL(5, 4) NULL DEFAULT NULL,
  `facial_verified` BOOLEAN DEFAULT FALSE,
  `facial_verified_at` DATETIME NULL DEFAULT NULL,
  `status` ENUM('present', 'late', 'absent', 'excused', 'early_departure') DEFAULT 'present',
  `is_within_geofence` BOOLEAN DEFAULT TRUE,
  `distance_from_location` INT NULL DEFAULT NULL,
  `total_hours` DECIMAL(5, 2) NULL DEFAULT NULL,
  `overtime_hours` DECIMAL(5, 2) DEFAULT 0,
  `notes` TEXT NULL DEFAULT NULL,
  `verified_by` CHAR(36) NULL DEFAULT NULL,
  `verified_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_attendance_agent_id` (`agent_id`),
  INDEX `idx_attendance_event_id` (`event_id`),
  INDEX `idx_attendance_date` (`date`),
  INDEX `idx_attendance_status` (`status`),
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`checked_in_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. TABLE: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `type` ENUM('assignment', 'reminder', 'attendance', 'late_alert', 'absence_alert', 'schedule_change', 'system', 'general') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `channel` ENUM('email', 'sms', 'whatsapp', 'push', 'in_app') NOT NULL,
  `status` ENUM('pending', 'sent', 'delivered', 'failed', 'read') DEFAULT 'pending',
  `sent_at` DATETIME NULL DEFAULT NULL,
  `delivered_at` DATETIME NULL DEFAULT NULL,
  `read_at` DATETIME NULL DEFAULT NULL,
  `failed_at` DATETIME NULL DEFAULT NULL,
  `failure_reason` TEXT NULL DEFAULT NULL,
  `retry_count` INT DEFAULT 0,
  `max_retries` INT DEFAULT 3,
  `metadata` JSON NULL DEFAULT NULL,
  `external_id` VARCHAR(255) NULL DEFAULT NULL,
  `priority` ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  `scheduled_for` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_notifications_user_id` (`user_id`),
  INDEX `idx_notifications_status` (`status`),
  INDEX `idx_notifications_type` (`type`),
  INDEX `idx_notifications_scheduled_for` (`scheduled_for`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. TABLE: activity_logs (pas de updated_at)
-- ============================================
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NULL DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` CHAR(36) NULL DEFAULT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `old_values` JSON NULL DEFAULT NULL,
  `new_values` JSON NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `user_agent` TEXT NULL DEFAULT NULL,
  `device_info` JSON NULL DEFAULT NULL,
  `location` JSON NULL DEFAULT NULL,
  `status` ENUM('success', 'failure', 'warning') DEFAULT 'success',
  `error_message` TEXT NULL DEFAULT NULL,
  `metadata` JSON NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_activity_logs_user_id` (`user_id`),
  INDEX `idx_activity_logs_action` (`action`),
  INDEX `idx_activity_logs_entity_type` (`entity_type`),
  INDEX `idx_activity_logs_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. TABLE: incidents
-- ============================================
CREATE TABLE IF NOT EXISTS `incidents` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `event_id` CHAR(36) NULL DEFAULT NULL,
  `reported_by` CHAR(36) NOT NULL,
  `assigned_to` CHAR(36) NULL DEFAULT NULL,
  `type` ENUM('security_breach', 'medical_emergency', 'fire_alarm', 'theft', 'vandalism', 'trespassing', 'suspicious_activity', 'equipment_failure', 'access_issue', 'violence', 'other') NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `status` ENUM('reported', 'investigating', 'resolved', 'escalated', 'closed') DEFAULT 'reported',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `location` VARCHAR(500) NULL DEFAULT NULL,
  `latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `photos` JSON NULL DEFAULT NULL,
  `witnesses` JSON NULL DEFAULT NULL,
  `actions_taken` TEXT NULL DEFAULT NULL,
  `police_report` VARCHAR(100) NULL DEFAULT NULL,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `resolved_by` CHAR(36) NULL DEFAULT NULL,
  `resolution` TEXT NULL DEFAULT NULL,
  `follow_up_required` BOOLEAN DEFAULT FALSE,
  `follow_up_date` DATE NULL DEFAULT NULL,
  `follow_up_notes` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_incidents_event_id` (`event_id`),
  INDEX `idx_incidents_status` (`status`),
  INDEX `idx_incidents_severity` (`severity`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. TABLE: badges
-- ============================================
CREATE TABLE IF NOT EXISTS `badges` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL DEFAULT NULL,
  `icon` VARCHAR(50) NULL DEFAULT NULL,
  `color` VARCHAR(20) DEFAULT '#3B82F6',
  `category` ENUM('performance', 'attendance', 'experience', 'special', 'training') DEFAULT 'performance',
  `criteria` JSON NULL DEFAULT NULL,
  `points` INT DEFAULT 10,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. TABLE: user_badges
-- ============================================
CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `badge_id` CHAR(36) NOT NULL,
  `awarded_by` CHAR(36) NULL DEFAULT NULL,
  `awarded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `reason` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`awarded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. TABLE: user_documents
-- ============================================
CREATE TABLE IF NOT EXISTS `user_documents` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `document_type` ENUM('cin_recto', 'cin_verso', 'photo', 'cv', 'fiche_anthropometrique', 'permis', 'diplome', 'autre') NOT NULL,
  `custom_name` VARCHAR(255) NULL DEFAULT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `stored_filename` VARCHAR(255) NOT NULL,
  `file_path` TEXT NOT NULL,
  `file_size` INT NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_extension` VARCHAR(10) NOT NULL,
  `file_content` LONGTEXT NULL DEFAULT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `is_required` BOOLEAN DEFAULT FALSE,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `verified_by` CHAR(36) NULL DEFAULT NULL,
  `verified_at` DATETIME NULL DEFAULT NULL,
  `expiry_date` DATE NULL DEFAULT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `rejection_reason` TEXT NULL DEFAULT NULL,
  `uploaded_by` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_user_documents_user_id` (`user_id`),
  INDEX `idx_user_documents_document_type` (`document_type`),
  INDEX `idx_user_documents_status` (`status`),
  INDEX `idx_user_documents_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 12. TABLE: conversations
-- ============================================
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `event_id` CHAR(36) NULL DEFAULT NULL,
  `type` ENUM('direct', 'group', 'event_broadcast') NOT NULL DEFAULT 'direct',
  `name` VARCHAR(255) NULL DEFAULT NULL,
  `created_by` CHAR(36) NOT NULL,
  `participants` JSON NULL DEFAULT NULL,
  `last_message_id` CHAR(36) NULL DEFAULT NULL,
  `last_message_at` DATETIME NULL DEFAULT NULL,
  `is_archived` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_conversations_event_id` (`event_id`),
  INDEX `idx_conversations_created_by` (`created_by`),
  INDEX `idx_conversations_last_message_at` (`last_message_at`),
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 13. TABLE: messages
-- ============================================
CREATE TABLE IF NOT EXISTS `messages` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `conversation_id` CHAR(36) NOT NULL,
  `sender_id` CHAR(36) NOT NULL,
  `recipient_id` CHAR(36) NULL DEFAULT NULL,
  `event_id` CHAR(36) NULL DEFAULT NULL,
  `message_type` ENUM('text', 'image', 'file', 'location', 'voice', 'system') NOT NULL DEFAULT 'text',
  `content` TEXT NULL DEFAULT NULL,
  `file_url` TEXT NULL DEFAULT NULL,
  `file_name` VARCHAR(255) NULL DEFAULT NULL,
  `file_size` INT NULL DEFAULT NULL,
  `file_mime_type` VARCHAR(100) NULL DEFAULT NULL,
  `latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `delivered_at` DATETIME NULL DEFAULT NULL,
  `read_at` DATETIME NULL DEFAULT NULL,
  `is_broadcast` BOOLEAN DEFAULT FALSE,
  `is_urgent` BOOLEAN DEFAULT FALSE,
  `reply_to_id` CHAR(36) NULL DEFAULT NULL,
  `metadata` JSON NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_messages_conversation_id` (`conversation_id`),
  INDEX `idx_messages_sender_id` (`sender_id`),
  INDEX `idx_messages_recipient_id` (`recipient_id`),
  INDEX `idx_messages_event_id` (`event_id`),
  INDEX `idx_messages_created_at` (`created_at`),
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 14. TABLE: permissions
-- ============================================
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `code` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `module` VARCHAR(50) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 15. TABLE: role_permissions
-- ============================================
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `role` ENUM('agent', 'supervisor', 'admin', 'user') NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  `granted_by` CHAR(36) NULL DEFAULT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_role_permissions_role` (`role`),
  INDEX `idx_role_permissions_permission_id` (`permission_id`),
  UNIQUE KEY `unique_role_permission` (`role`, `permission_id`),
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 16. TABLE: user_permissions
-- ============================================
CREATE TABLE IF NOT EXISTS `user_permissions` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  `granted` BOOLEAN DEFAULT TRUE,
  `granted_by` CHAR(36) NULL DEFAULT NULL,
  `expires_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_user_permissions_user_id` (`user_id`),
  INDEX `idx_user_permissions_permission_id` (`permission_id`),
  UNIQUE KEY `unique_user_permission` (`user_id`, `permission_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 17. TABLE: geo_tracking (pas de updated_at)
-- ============================================
CREATE TABLE IF NOT EXISTS `geo_tracking` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `event_id` CHAR(36) NULL DEFAULT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `accuracy` DECIMAL(6, 2) NULL DEFAULT NULL,
  `altitude` DECIMAL(8, 2) NULL DEFAULT NULL,
  `speed` DECIMAL(6, 2) NULL DEFAULT NULL,
  `heading` DECIMAL(5, 2) NULL DEFAULT NULL,
  `battery_level` INT NULL DEFAULT NULL,
  `battery_charging` BOOLEAN NULL DEFAULT NULL,
  `battery_charging_time` INT NULL DEFAULT NULL,
  `battery_discharging_time` INT NULL DEFAULT NULL,
  `battery_status` VARCHAR(20) NULL DEFAULT NULL,
  `battery_estimated_time` VARCHAR(50) NULL DEFAULT NULL,
  `network_type` VARCHAR(20) NULL DEFAULT NULL,
  `network_downlink` DECIMAL(8, 2) NULL DEFAULT NULL,
  `network_rtt` INT NULL DEFAULT NULL,
  `network_save_data` BOOLEAN NULL DEFAULT NULL,
  `network_online` BOOLEAN NULL DEFAULT NULL,
  `network_status` VARCHAR(20) NULL DEFAULT NULL,
  `device_o_s` VARCHAR(50) NULL DEFAULT NULL,
  `device_browser` VARCHAR(50) NULL DEFAULT NULL,
  `device_type` VARCHAR(20) NULL DEFAULT NULL,
  `device_platform` VARCHAR(50) NULL DEFAULT NULL,
  `device_language` VARCHAR(10) NULL DEFAULT NULL,
  `device_c_p_u_cores` INT NULL DEFAULT NULL,
  `device_memory` INT NULL DEFAULT NULL,
  `device_screen_resolution` VARCHAR(20) NULL DEFAULT NULL,
  `device_screen_on` BOOLEAN NULL DEFAULT NULL,
  `is_mock_location` BOOLEAN DEFAULT FALSE,
  `cell_tower_info` JSON NULL DEFAULT NULL,
  `is_within_geofence` BOOLEAN DEFAULT TRUE,
  `distance_from_event` DECIMAL(10, 2) NULL DEFAULT NULL,
  `recorded_at` DATETIME NOT NULL,
  `is_moving` BOOLEAN NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_geo_tracking_user_event` (`user_id`, `event_id`),
  INDEX `idx_geo_tracking_recorded_at` (`recorded_at`),
  INDEX `idx_geo_tracking_user_recorded` (`user_id`, `recorded_at`),
  INDEX `idx_geo_tracking_battery_level` (`battery_level`),
  INDEX `idx_geo_tracking_network_status` (`network_status`),
  INDEX `idx_geo_tracking_device_screen_on` (`device_screen_on`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 18. TABLE: gps_tracking (standalone - camelCase)
-- NOTE: Ce modèle n'utilise PAS underscored:true
-- Les colonnes restent en camelCase
-- ============================================
CREATE TABLE IF NOT EXISTS `gps_tracking` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `userId` CHAR(36) NOT NULL,
  `eventId` CHAR(36) NULL DEFAULT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `accuracy` FLOAT NULL DEFAULT NULL,
  `altitude` FLOAT NULL DEFAULT NULL,
  `speed` FLOAT NULL DEFAULT NULL,
  `heading` FLOAT NULL DEFAULT NULL,
  `batteryLevel` INT NULL DEFAULT NULL,
  `isCharging` BOOLEAN DEFAULT FALSE,
  `deviceInfo` JSON NULL DEFAULT NULL,
  `ipAddress` VARCHAR(45) NULL DEFAULT NULL,
  `macAddress` VARCHAR(17) NULL DEFAULT NULL,
  `isInsideGeofence` BOOLEAN DEFAULT FALSE,
  `distanceFromEvent` FLOAT NULL DEFAULT NULL,
  `trackingType` ENUM('auto', 'manual', 'background', 'checkin', 'checkout') DEFAULT 'auto',
  `isActive` BOOLEAN DEFAULT TRUE,
  `metadata` JSON NULL DEFAULT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` DATETIME NULL DEFAULT NULL,
  INDEX `idx_gps_tracking_userId` (`userId`),
  INDEX `idx_gps_tracking_eventId` (`eventId`),
  INDEX `idx_gps_tracking_createdAt` (`createdAt`),
  INDEX `idx_gps_tracking_isActive` (`isActive`),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 19. TABLE: tracking_alerts (standalone - camelCase)
-- NOTE: Ce modèle n'utilise PAS underscored:true
-- Les colonnes restent en camelCase
-- ============================================
CREATE TABLE IF NOT EXISTS `tracking_alerts` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `userId` CHAR(36) NOT NULL,
  `eventId` CHAR(36) NULL DEFAULT NULL,
  `alertType` ENUM('exit_zone', 'late_arrival', 'low_battery', 'connection_lost', 'no_movement', 'high_speed', 'device_changed') NOT NULL,
  `severity` ENUM('critical', 'warning', 'info') DEFAULT 'info',
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `distanceFromZone` FLOAT NULL DEFAULT NULL,
  `batteryLevel` INT NULL DEFAULT NULL,
  `isResolved` BOOLEAN DEFAULT FALSE,
  `resolvedAt` DATETIME NULL DEFAULT NULL,
  `resolvedBy` CHAR(36) NULL DEFAULT NULL,
  `resolution` TEXT NULL DEFAULT NULL,
  `notificationSent` BOOLEAN DEFAULT FALSE,
  `metadata` JSON NULL DEFAULT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` DATETIME NULL DEFAULT NULL,
  INDEX `idx_tracking_alerts_userId` (`userId`),
  INDEX `idx_tracking_alerts_eventId` (`eventId`),
  INDEX `idx_tracking_alerts_alertType` (`alertType`),
  INDEX `idx_tracking_alerts_severity` (`severity`),
  INDEX `idx_tracking_alerts_isResolved` (`isResolved`),
  INDEX `idx_tracking_alerts_createdAt` (`createdAt`),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 20. TABLE: liveness_logs (pas de updated_at)
-- ============================================
CREATE TABLE IF NOT EXISTS `liveness_logs` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `check_type` ENUM('facial', 'document', 'combined') NOT NULL,
  `session_id` VARCHAR(100) NULL DEFAULT NULL,
  `result` ENUM('passed', 'failed', 'inconclusive', 'timeout') NOT NULL,
  `confidence_score` DECIMAL(5, 4) NULL DEFAULT NULL,
  `checks_performed` JSON NULL DEFAULT NULL,
  `failure_reasons` JSON NULL DEFAULT NULL,
  `frames_analyzed` INT NULL DEFAULT NULL,
  `device_info` JSON NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `duration_ms` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_liveness_logs_user_id` (`user_id`),
  INDEX `idx_liveness_logs_created_at` (`created_at`),
  INDEX `idx_liveness_logs_result` (`result`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 21. TABLE: fraud_attempts (pas de updated_at)
-- ============================================
CREATE TABLE IF NOT EXISTS `fraud_attempts` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NULL DEFAULT NULL,
  `event_id` CHAR(36) NULL DEFAULT NULL,
  `attempt_type` ENUM('gps_spoofing', 'photo_spoofing', 'video_spoofing', 'screen_spoofing', 'document_forgery', 'multiple_device', 'out_of_zone', 'time_manipulation', 'identity_mismatch', 'root_device', 'vpn_detected', 'other') NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  `description` TEXT NULL DEFAULT NULL,
  `details` JSON NULL DEFAULT NULL,
  `evidence_photo` LONGTEXT NULL DEFAULT NULL,
  `latitude` DECIMAL(10, 8) NULL DEFAULT NULL,
  `longitude` DECIMAL(11, 8) NULL DEFAULT NULL,
  `device_fingerprint` VARCHAR(255) NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `user_agent` TEXT NULL DEFAULT NULL,
  `action_taken` ENUM('blocked', 'warned', 'logged', 'escalated', 'ignored') DEFAULT 'logged',
  `blocked_until` DATETIME NULL DEFAULT NULL,
  `reviewed_by` CHAR(36) NULL DEFAULT NULL,
  `reviewed_at` DATETIME NULL DEFAULT NULL,
  `review_notes` TEXT NULL DEFAULT NULL,
  `is_resolved` BOOLEAN DEFAULT FALSE,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `resolved_by` CHAR(36) NULL DEFAULT NULL,
  `resolution` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_fraud_attempts_user_id` (`user_id`),
  INDEX `idx_fraud_attempts_event_id` (`event_id`),
  INDEX `idx_fraud_attempts_attempt_type` (`attempt_type`),
  INDEX `idx_fraud_attempts_severity` (`severity`),
  INDEX `idx_fraud_attempts_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 22. TABLE: sos_alerts (pas de updated_at)
-- ============================================
CREATE TABLE IF NOT EXISTS `sos_alerts` (
  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `event_id` CHAR(36) NULL DEFAULT NULL,
  `alert_type` ENUM('sos', 'medical', 'security', 'fire', 'other') NOT NULL DEFAULT 'sos',
  `status` ENUM('active', 'acknowledged', 'responding', 'resolved', 'false_alarm') NOT NULL DEFAULT 'active',
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `accuracy` DECIMAL(6, 2) NULL DEFAULT NULL,
  `photo` TEXT NULL DEFAULT NULL,
  `voice_note_url` TEXT NULL DEFAULT NULL,
  `description` TEXT NULL DEFAULT NULL,
  `acknowledged_by` CHAR(36) NULL DEFAULT NULL,
  `acknowledged_at` DATETIME NULL DEFAULT NULL,
  `resolved_by` CHAR(36) NULL DEFAULT NULL,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `resolution_notes` TEXT NULL DEFAULT NULL,
  `response_time_seconds` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_sos_alerts_user_id` (`user_id`),
  INDEX `idx_sos_alerts_event_id` (`event_id`),
  INDEX `idx_sos_alerts_status` (`status`),
  INDEX `idx_sos_alerts_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 23. TABLE: scheduled_backups
-- ============================================
CREATE TABLE IF NOT EXISTS `scheduled_backups` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `interval_days` INT NOT NULL DEFAULT 7,
  `backup_type` ENUM('full', 'structure') NOT NULL DEFAULT 'full',
  `retention_count` INT NOT NULL DEFAULT 3,
  `last_run_at` DATETIME NULL DEFAULT NULL,
  `next_run_at` DATETIME NULL DEFAULT NULL,
  `created_by` CHAR(36) NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  INDEX `idx_scheduled_backups_enabled` (`enabled`),
  INDEX `idx_scheduled_backups_next_run_at` (`next_run_at`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- DONNÉES DE TEST
-- ============================================

-- Admin par défaut (mot de passe: Admin123!)
INSERT INTO `users` (
  `id`, `employee_id`, `first_name`, `last_name`, `email`, `password`,
  `role`, `status`, `created_at`, `updated_at`
) VALUES (
  UUID(), 'EMP-ADMIN-001', 'Super', 'Admin',
  'admin@security.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin123!
  'admin', 'active', NOW(), NOW()
) ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- Événement de test
INSERT INTO `events` (
  `id`, `name`, `description`, `type`, `location`,
  `latitude`, `longitude`, `geo_radius`,
  `start_date`, `end_date`, `check_in_time`, `check_out_time`,
  `late_threshold`, `required_agents`,
  `status`, `priority`, `recurrence_type`,
  `created_by`,
  `created_at`, `updated_at`
) VALUES (
  UUID(),
  'Événement de sécurité - Test',
  'Événement de test pour vérifier le bon fonctionnement du système',
  'regular',
  'Casablanca, Maroc',
  33.5731, -7.5898, 200,
  DATE_ADD(NOW(), INTERVAL 1 DAY),
  DATE_ADD(NOW(), INTERVAL 2 DAY),
  '08:00:00',
  '18:00:00',
  15, 2,
  'scheduled', 'medium', 'none',
  (SELECT `id` FROM `users` WHERE `email` = 'admin@security.com' LIMIT 1),
  NOW(), NOW()
);

-- ============================================
-- VÉRIFICATION FINALE
-- ============================================
SELECT CONCAT(COUNT(*), ' / 23 tables créées avec succès') AS Resultat
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'users', 'events', 'zones', 'assignments', 'attendance',
    'notifications', 'activity_logs', 'incidents', 'badges', 'user_badges',
    'user_documents', 'conversations', 'messages', 'permissions',
    'role_permissions', 'user_permissions', 'geo_tracking', 'gps_tracking',
    'tracking_alerts', 'liveness_logs', 'fraud_attempts', 'sos_alerts',
    'scheduled_backups'
  );
