-- PARTIE 3/3 - ACTIVITY_LOGS + DONNÉES
-- Copiez et exécutez dans Railway Dashboard → MySQL → Data

-- Table ACTIVITY_LOGS
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

-- INSERTION DES UTILISATEURS
INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status)
VALUES ('ADMIN001', 'Admin', 'System', 'admin@security.com', 
        '$2b$10$YourHashedPasswordHere', '+212600000000', 'admin', 'active')
ON DUPLICATE KEY UPDATE email=email;

INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status)
VALUES ('A303730', 'Mohamed', 'Tazi', 'tazi@security.com',
        '$2b$10$YourHashedPasswordHere', '+212661234567', 'supervisor', 'active')
ON DUPLICATE KEY UPDATE email=email;

INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status, latitude, longitude)
VALUES ('BK517312', 'Youssef', 'El Alami', 'youssef@security.com',
        '$2b$10$YourHashedPasswordHere', '+212662345678', 'agent', 'active', 33.5731, -7.5898)
ON DUPLICATE KEY UPDATE email=email;

INSERT INTO users (employee_id, first_name, last_name, email, password, phone, role, status, latitude, longitude)
VALUES ('AB123456', 'Mohammed', 'Bennani', 'mohammed@security.com',
        '$2b$10$YourHashedPasswordHere', '+212663456789', 'agent', 'active', 33.5731, -7.5898)
ON DUPLICATE KEY UPDATE email=email;

-- VÉRIFICATION
SELECT 'IMPORT TERMINÉ!' AS Message;
SELECT COUNT(*) as Total_Users FROM users;
SELECT employee_id, first_name, last_name, role FROM users ORDER BY role;
