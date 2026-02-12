-- ============================================
-- Import Data to Railway MySQL Database
-- ============================================
-- Database: railway
-- Execute via Railway Dashboard → MySQL → Query tab
-- ============================================

-- 1. Create Admin User
INSERT INTO users (
    firstName, 
    lastName, 
    email, 
    password, 
    role, 
    cin, 
    phone, 
    department,
    status,
    createdAt, 
    updatedAt
) VALUES (
    'Admin', 
    'System', 
    'admin@security.com', 
    '$2b$10$YourHashedPasswordHere', 
    'admin', 
    'ADMIN001', 
    '+212600000000',
    'Administration',
    'active',
    NOW(), 
    NOW()
) 
ON DUPLICATE KEY UPDATE email=email;

-- 2. Create Sample Supervisor
INSERT INTO users (
    firstName, 
    lastName, 
    email, 
    password, 
    role, 
    cin, 
    phone, 
    department,
    status,
    createdAt, 
    updatedAt
) VALUES (
    'Mohamed', 
    'Tazi', 
    'tazi@security.com', 
    '$2b$10$YourHashedPasswordHere', 
    'supervisor', 
    'A303730', 
    '+212661234567',
    'Supervision',
    'active',
    NOW(), 
    NOW()
) 
ON DUPLICATE KEY UPDATE email=email;

-- 3. Create Sample Agents
INSERT INTO users (
    firstName, 
    lastName, 
    email, 
    password, 
    role, 
    cin, 
    phone, 
    department,
    status,
    latitude,
    longitude,
    createdAt, 
    updatedAt
) VALUES 
(
    'Youssef', 
    'El Alami', 
    'youssef@security.com', 
    '$2b$10$YourHashedPasswordHere', 
    'agent', 
    'BK517312', 
    '+212662345678',
    'Gardiennage',
    'active',
    33.5731,
    -7.5898,
    NOW(), 
    NOW()
),
(
    'Mohammed', 
    'Bennani', 
    'mohammed@security.com', 
    '$2b$10$YourHashedPasswordHere', 
    'agent', 
    'AB123456', 
    '+212663456789',
    'Gardiennage',
    'active',
    33.5731,
    -7.5898,
    NOW(), 
    NOW()
)
ON DUPLICATE KEY UPDATE email=email;

-- 4. Create Sample Security Zone
INSERT INTO zones (
    name,
    address,
    city,
    coordinates,
    radius,
    isActive,
    createdAt,
    updatedAt
) VALUES (
    'Zone Centre Ville',
    'Avenue Hassan II',
    'Casablanca',
    JSON_OBJECT('lat', 33.5731, 'lng', -7.5898),
    500,
    true,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE name=name;

-- 5. Create Sample Event
INSERT INTO events (
    title,
    location,
    startDate,
    endDate,
    status,
    agentsRequired,
    description,
    createdAt,
    updatedAt
) VALUES (
    'Surveillance Nocturne',
    'Centre Commercial Morocco Mall',
    DATE_ADD(NOW(), INTERVAL 1 DAY),
    DATE_ADD(NOW(), INTERVAL 2 DAY),
    'planned',
    5,
    'Mission de surveillance nocturne au Morocco Mall',
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE title=title;

-- ============================================
-- Verify Import
-- ============================================

-- Check users
SELECT id, firstName, lastName, role, cin, status FROM users;

-- Check zones
SELECT id, name, city, isActive FROM zones;

-- Check events
SELECT id, title, status, agentsRequired FROM events;
