-- PARTIE 1/3 - CRÉATION DES TABLES PRINCIPALES
-- Copiez et exécutez dans Railway Dashboard → MySQL → Data

-- Table USERS
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

-- Table EVENTS
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

SELECT 'Partie 1/3 terminée - Tables users et events créées!' AS Status;
