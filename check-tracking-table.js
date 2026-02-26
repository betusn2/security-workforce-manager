const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway',
  connectTimeout: 30000
};

async function check() {
  const c = await mysql.createConnection(config);
  
  const [tables] = await c.query('SHOW TABLES');
  console.log('All tables:', tables.map(t => Object.values(t)[0]));
  
  // Check if geo_trackings exists
  const [geoTables] = await c.query("SHOW TABLES LIKE 'geo_trackings'");
  console.log('\ngeo_trackings exists:', geoTables.length > 0);
  
  if (geoTables.length > 0) {
    const [cols] = await c.query('DESCRIBE geo_trackings');
    console.log('Columns:', cols.map(c => c.Field));
    const [count] = await c.query('SELECT COUNT(*) as n FROM geo_trackings');
    console.log('Row count:', count[0].n);
  } else {
    console.log('\n❌ Table geo_trackings MANQUANTE - need to create it');
    // Show GeoTracking model structure
    console.log('\nCreating geo_trackings table...');
    await c.query(`
      CREATE TABLE IF NOT EXISTS geo_trackings (
        id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        user_id CHAR(36) NOT NULL,
        event_id CHAR(36),
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        accuracy FLOAT,
        altitude FLOAT,
        speed FLOAT,
        heading FLOAT,
        battery_level INT,
        is_moving BOOLEAN DEFAULT FALSE,
        is_mock_location BOOLEAN DEFAULT FALSE,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_event_id (event_id),
        INDEX idx_recorded_at (recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Table geo_trackings créée!');
  }
  
  await c.end();
}

check().catch(e => console.error('Error:', e.message));
