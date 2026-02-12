-- ============================================
-- CRÉATION COMPLÈTE DES TABLES - RAILWAY MYSQL
-- Copiez tout ce fichier et exécutez-le dans:
-- Railway Dashboard → MySQL → Database → Query
-- ============================================

-- 1. Table USERS
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id VARCHAR(20) UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  whatsapp_number VARCHAR(20),
  role ENUM('agent', 'supervisor', 'admin') DEFAULT 'agent',
  profile_photo TEXT,
  facial_vector TEXT,
  facial_vector_updated_at DATETIME,
  address TEXT,
  date_of_birth DATE,
  hire_date DATE,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  last_login DATETIME,
  notification_preferences JSON,
  refresh_token TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  INDEX idx_email (email),
  INDEX idx_employee_id (employee_id),
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table EVENTS
CREATE TABLE IF NOT EXISTS events (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('regular', 'special', 'emergency') DEFAULT 'regular',
  location VARCHAR(500) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geo_radius INT DEFAULT 100,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  check_in_time TIME NOT NULL,
  check_out_time TIME NOT NULL,
  late_threshold INT DEFAULT 15,
  required_agents INT DEFAULT 1,
  status ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled') DEFAULT 'draft',
  recurrence JSON,
  created_by CHAR(36),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  INDEX idx_status (status),
  INDEX idx_start_date (start_date),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table ASSIGNMENTS
CREATE TABLE IF NOT EXISTS assignments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  agent_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  assigned_by CHAR(36),
  role ENUM('primary', 'backup', 'supervisor') DEFAULT 'primary',
  status ENUM('pending', 'confirmed', 'declined', 'cancelled') DEFAULT 'pending',
  confirmed_at DATETIME,
  notes TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  INDEX idx_agent_id (agent_id),
  INDEX idx_event_id (event_id),
  INDEX idx_status (status),
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  agent_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  date DATE NOT NULL,
  check_in_time DATETIME,
  check_out_time DATETIME,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8),
  check_in_photo TEXT,
  check_out_photo TEXT,
  check_in_method ENUM('facial', 'manual', 'qrcode') DEFAULT 'facial',
  check_out_method ENUM('facial', 'manual', 'qrcode'),
  facial_match_score DECIMAL(5, 4),
  status ENUM('present', 'late', 'absent', 'excused', 'early_departure') DEFAULT 'present',
  is_within_geofence BOOLEAN DEFAULT TRUE,
  distance_from_location INT,
  total_hours DECIMAL(5, 2),
  overtime_hours DECIMAL(5, 2) DEFAULT 0,
  notes TEXT,
  verified_by CHAR(36),
  verified_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agent_id (agent_id),
  INDEX idx_event_id (event_id),
  INDEX idx_date (date),
  INDEX idx_status (status),
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  type ENUM('assignment', 'reminder', 'attendance', 'late_alert', 'absence_alert', 'schedule_change', 'system', 'general') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  channel ENUM('email', 'sms', 'whatsapp', 'push', 'in_app') NOT NULL,
  status ENUM('pending', 'sent', 'delivered', 'failed', 'read') DEFAULT 'pending',
  sent_at DATETIME,
  delivered_at DATETIME,
  read_at DATETIME,
  failed_at DATETIME,
  failure_reason TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  metadata JSON,
  external_id VARCHAR(255),
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  scheduled_for DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_scheduled_for (scheduled_for),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Table ACTIVITY_LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id CHAR(36),
  description TEXT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_info JSON,
  location JSON,
  status ENUM('success', 'failure', 'warning') DEFAULT 'success',
  error_message TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_entity_type (entity_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERTION DES DONNÉES DE TEST
-- ============================================

-- Admin (mot de passe: admin123)
INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status)
VALUES ('ADMIN001', 'Admin', 'System', 'admin@security.com', 
        '$2b$10$YourHashedPasswordHere', '+212600000000', 'admin', 'active')
ON DUPLICATE KEY UPDATE email=email;

-- Superviseur (mot de passe: supervisor123)
INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status)
VALUES ('A303730', 'Mohamed', 'Tazi', 'tazi@security.com',
        '$2b$10$YourHashedPasswordHere', '+212661234567', 'supervisor', 'active')
ON DUPLICATE KEY UPDATE email=email;

-- Agent Youssef (mot de passe: agent123)
INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status, latitude, longitude)
VALUES ('BK517312', 'Youssef', 'El Alami', 'youssef@security.com',
        '$2b$10$YourHashedPasswordHere', '+212662345678', 'agent', 'active', 33.5731, -7.5898)
ON DUPLICATE KEY UPDATE email=email;

-- Agent Mohammed (mot de passe: agent123)
INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status, latitude, longitude)
VALUES ('AB123456', 'Mohammed', 'Bennani', 'mohammed@security.com',
        '$2b$10$YourHashedPasswordHere', '+212663456789', 'agent', 'active', 33.5731, -7.5898)
ON DUPLICATE KEY UPDATE email=email;

-- ============================================
-- VÉRIFICATION
-- ============================================

-- Afficher le nombre de tables créées
SELECT 'Tables créées avec succès!' AS Message;

-- Compter les utilisateurs
SELECT COUNT(*) as Total_Users FROM users;

-- Afficher tous les utilisateurs
SELECT employee_id, first_name, last_name, email, role, status FROM users ORDER BY role, first_name;
