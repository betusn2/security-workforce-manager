-- ============================================
-- IMPORT COMPLET POUR RAILWAY MYSQL
-- Copiez-collez ce fichier dans Railway Dashboard → MySQL → Database → Query
-- ============================================

-- 1. Créer les tables si elles n'existent pas
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'supervisor', 'agent') DEFAULT 'agent',
    cin VARCHAR(50) UNIQUE,
    phone VARCHAR(20),
    department VARCHAR(100),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    coordinates JSON,
    radius INT DEFAULT 100,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(500),
    startDate DATETIME,
    endDate DATETIME,
    status ENUM('planned', 'active', 'completed', 'cancelled') DEFAULT 'planned',
    agentsRequired INT DEFAULT 1,
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agentId INT NOT NULL,
    eventId INT NOT NULL,
    status ENUM('pending', 'confirmed', 'declined') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agentId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agentId INT NOT NULL,
    eventId INT NOT NULL,
    checkInTime DATETIME,
    checkOutTime DATETIME,
    checkInLatitude DECIMAL(10, 8),
    checkInLongitude DECIMAL(11, 8),
    checkOutLatitude DECIMAL(10, 8),
    checkOutLongitude DECIMAL(11, 8),
    status ENUM('present', 'late', 'absent') DEFAULT 'present',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agentId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Insérer les données de test
INSERT INTO users (firstName, lastName, email, password, role, cin, phone, department, status, latitude, longitude) VALUES
('Admin', 'System', 'admin@security.com', '$2b$10$YourHashedPasswordHere', 'admin', 'ADMIN001', '+212600000000', 'Administration', 'active', 33.5731, -7.5898),
('Mohamed', 'Tazi', 'tazi@security.com', '$2b$10$YourHashedPasswordHere', 'supervisor', 'A303730', '+212661234567', 'Supervision', 'active', 33.5731, -7.5898),
('Youssef', 'El Alami', 'youssef@security.com', '$2b$10$YourHashedPasswordHere', 'agent', 'BK517312', '+212662345678', 'Gardiennage', 'active', 33.5731, -7.5898),
('Mohammed', 'Bennani', 'mohammed@security.com', '$2b$10$YourHashedPasswordHere', 'agent', 'AB123456', '+212663456789', 'Gardiennage', 'active', 33.5731, -7.5898)
ON DUPLICATE KEY UPDATE email=email;

INSERT INTO zones (name, address, city, coordinates, radius, isActive) VALUES
('Zone Centre Ville', 'Avenue Hassan II', 'Casablanca', JSON_OBJECT('lat', 33.5731, 'lng', -7.5898), 500, true)
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO events (title, location, startDate, endDate, status, agentsRequired, description) VALUES
('Surveillance Nocturne', 'Centre Commercial Morocco Mall', DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), 'planned', 5, 'Mission de surveillance nocturne au Morocco Mall')
ON DUPLICATE KEY UPDATE title=title;

-- 3. Vérifier l'import
SELECT 'Tables créées et données importées avec succès!' AS Message;
SELECT COUNT(*) as TotalUsers FROM users;
SELECT COUNT(*) as TotalZones FROM zones;
SELECT COUNT(*) as TotalEvents FROM events;
