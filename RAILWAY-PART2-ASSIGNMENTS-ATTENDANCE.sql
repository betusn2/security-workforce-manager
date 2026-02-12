-- PARTIE 2/3 - TABLES ASSIGNMENTS, ATTENDANCE, NOTIFICATIONS
-- Copiez et exécutez dans Railway Dashboard → MySQL → Data

-- Table ASSIGNMENTS
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

-- Table ATTENDANCE
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

-- Table NOTIFICATIONS
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

SELECT 'Partie 2/3 terminée - Tables assignments, attendance, notifications créées!' AS Status;
