/**
 * Import Sample Users to Railway MySQL Database
 * Connects to Railway MySQL and creates admin, supervisor, and agents
 */

const mysql = require('mysql2/promise');

// Railway MySQL Connection
const DB_CONFIG = {
  host: 'centerbeam.proxy.rlwy.net',
  port: 13158,
  user: 'root',
  password: 'qiKrxloVWBcLjxmnUpStvvNTqLyyPHWQ',
  database: 'railway',
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

async function importUsers() {
  let connection;
  
  try {
    console.log('🔄 Connecting to Railway MySQL...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected successfully!\n');

    // Admin user
    console.log('👤 Creating Admin user...');
    await connection.execute(`
      INSERT INTO users (
        id, employeeId, firstName, lastName, email, password, role, cin, phone,
        status, createdAt, updatedAt
      ) VALUES (
        UUID(), 'EMP001', 'Admin', 'System', 'admin@security.com',
        '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
        'admin', 'ADMIN001', '+212600000000',
        'active', NOW(), NOW()
      ) ON DUPLICATE KEY UPDATE email=email
    `);
    console.log('  ✅ Admin created (email: admin@security.com, password: admin123)');

    // Supervisor - Mohamed Tazi
    console.log('👤 Creating Supervisor (Mohamed Tazi)...');
    await connection.execute(`
      INSERT INTO users (
        id, employeeId, firstName, lastName, email, password, role, cin, phone,
        status, createdAt, updatedAt
      ) VALUES (
        UUID(), 'EMP002', 'Mohamed', 'Tazi', 'tazi@security.com',
        '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
        'supervisor', 'A303730', '+212661234567',
        'active', NOW(), NOW()
      ) ON DUPLICATE KEY UPDATE email=email
    `);
    console.log('  ✅ Supervisor created (CIN: A303730, password: admin123)');

    // Agent - Youssef
    console.log('👤 Creating Agent (Youssef El Alami)...');
    await connection.execute(`
      INSERT INTO users (
        id, employeeId, firstName, lastName, email, password, role, cin, phone,
        status, currentLatitude, currentLongitude, lastLocationUpdate, createdAt, updatedAt
      ) VALUES (
        UUID(), 'EMP003', 'Youssef', 'El Alami', 'youssef@security.com',
        '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
        'agent', 'BK517312', '+212662345678',
        'active', 33.5731, -7.5898, NOW(), NOW(), NOW()
      ) ON DUPLICATE KEY UPDATE email=email
    `);
    console.log('  ✅ Agent created (CIN: BK517312, password: admin123)');

    // Agent - Mohammed
    console.log('👤 Creating Agent (Mohamed Bennani)...');
    await connection.execute(`
      INSERT INTO users (
        id, employeeId, firstName, lastName, email, password, role, cin, phone,
        status, currentLatitude, currentLongitude, lastLocationUpdate, createdAt, updatedAt
      ) VALUES (
        UUID(), 'EMP004', 'Mohammed', 'Bennani', 'mohammed@security.com',
        '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
        'agent', 'AB123456', '+212663456789',
        'active', 33.5731, -7.5898, NOW(), NOW(), NOW()
      ) ON DUPLICATE KEY UPDATE email=email
    `);
    console.log('  ✅ Agent created (CIN: AB123456, password: admin123)');

    // Get admin user ID for createdBy field
    const [adminRows] = await connection.execute(`
      SELECT id FROM users WHERE email = 'admin@security.com' LIMIT 1
    `);
    const adminId = adminRows[0].id;

    // Create sample event
    console.log('\n📅 Creating Sample Event...');
    const [eventResult] = await connection.execute(`
      INSERT INTO events (
        id, name, description, location, latitude, longitude,
        startDate, endDate, checkInTime, checkOutTime,
        status, requiredAgents, priority, createdBy, createdAt, updatedAt
      ) VALUES (
        UUID(), 'Surveillance Morocco Mall', 
        'Mission de surveillance nocturne au Morocco Mall',
        'Morocco Mall, Boulevard de la Corniche, Casablanca',
        33.5731, -7.5898,
        DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY),
        '20:00:00', '06:00:00',
        'scheduled', 5, 'high', ?, NOW(), NOW()
      )
    `, [adminId]);
    console.log('  ✅ Event created (Surveillance Morocco Mall)');

    // Get the event ID
    const [eventRows] = await connection.execute(`
      SELECT id FROM events WHERE name = 'Surveillance Morocco Mall' LIMIT 1
    `);
    const eventId = eventRows[0].id;

    // Create sample zones for the event
    console.log('\n🗺️  Creating Security Zones...');
    await connection.execute(`
      INSERT INTO zones (
        id, eventId, name, description, latitude, longitude, geoRadius,
        requiredAgents, priority, isActive, createdAt, updatedAt
      ) VALUES (
        UUID(), ?, 'Zone Entrée Principale', 'Contrôle accès principal',
        33.5731, -7.5898, 50, 2, 'high', true, NOW(), NOW()
      )
    `, [eventId]);
    console.log('  ✅ Zone created (Zone Entrée Principale)');
    
    await connection.execute(`
      INSERT INTO zones (
        id, eventId, name, description, latitude, longitude, geoRadius,
        requiredAgents, priority, isActive, createdAt, updatedAt
      ) VALUES (
        UUID(), ?, 'Zone Parking', 'Surveillance parking visiteurs',
        33.5735, -7.5900, 100, 2, 'medium', true, NOW(), NOW()
      )
    `, [eventId]);
    console.log('  ✅ Zone created (Zone Parking)');

    // Verify import
    console.log('\n📊 Verifying import...');
    const [users] = await connection.execute(`
      SELECT id, firstName, lastName, role, cin, status FROM users ORDER BY id
    `);
    const [events] = await connection.execute(`
      SELECT id, name, status, requiredAgents FROM events
    `);
    const [zones] = await connection.execute(`
      SELECT id, name, requiredAgents FROM zones
    `);

    console.log('\n✅ IMPORT SUCCESSFUL!\n');
    console.log('Users created:');
    users.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName} (${user.role}) - CIN: ${user.cin}`);
    });
    
    console.log('\nEvents created:');
    events.forEach(event => {
      console.log(`  - ${event.name} (${event.status}) - ${event.requiredAgents} agents required`);
    });
    
    console.log('\nZones created:');
    zones.forEach(zone => {
      console.log(`  - ${zone.name} (${zone.requiredAgents} agents required)`);
    });

    console.log('\n🔐 Login credentials:');
    console.log('  Email: admin@security.com');
    console.log('  Password: admin123');
    console.log('  Or use CIN: ADMIN001\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('\n⚠️  Connection timeout. Railway MySQL might be restarting.');
      console.error('Try again in a few seconds.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed');
    }
  }
}

// Run import
importUsers();
