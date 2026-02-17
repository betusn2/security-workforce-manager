const mysql = require('mysql2/promise');

async function diagnoseAllTables() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  try {
    // Required columns for each critical table based on Sequelize models
    const requiredSchema = {
      attendance: [
        'id', 'agent_id', 'event_id', 'date', 'check_in_time', 'check_out_time',
        'check_in_latitude', 'check_in_longitude', 'check_out_latitude', 'check_out_longitude',
        'check_in_location', 'check_out_location', 'status', 'is_late', 'late_duration',
        'early_departure', 'notes', 'facial_verification_check_in', 'facial_verification_check_out',
        'check_in_photo', 'check_out_photo', 'device_info', 'ip_address', 'worked_hours',
        'created_at', 'updated_at', 'deleted_at'
      ],
      assignments: [
        'id', 'agent_id', 'event_id', 'assigned_by', 'role', 'status',
        'confirmed_at', 'notes', 'notification_sent', 'notification_sent_at',
        'created_at', 'updated_at', 'deleted_at'
      ],
      notifications: [
        'id', 'user_id', 'type', 'title', 'message', 'channel', 'status',
        'sent_at', 'delivered_at', 'read_at', 'event_id', 'assignment_id',
        'priority', 'data', 'retry_count', 'error_message', 'whatsapp_message_id',
        'email_message_id', 'push_message_id', 'created_at', 'updated_at', 'deleted_at'
      ],
      events: [
        'id', 'name', 'description', 'type', 'location', 'latitude', 'longitude',
        'geo_radius', 'start_date', 'end_date', 'check_in_time', 'check_out_time',
        'late_threshold', 'agent_creation_buffer', 'required_agents', 'status',
        'priority', 'color', 'recurrence_type', 'recurrence_end_date', 'contact_name',
        'contact_phone', 'recurrence', 'created_by', 'supervisor_id', 'notes',
        'created_at', 'updated_at', 'deleted_at'
      ],
      zones: [
        'id', 'event_id', 'name', 'description', 'color', 'capacity',
        'required_agents', 'required_supervisors', 'supervisors', 'priority',
        'coordinates', 'geo_type', 'geo_radius', 'floor_level', 'building',
        'access_points', 'equipment', 'status', 'created_at', 'updated_at', 'deleted_at'
      ],
      user_badges: [
        'id', 'user_id', 'badge_id', 'assigned_at', 'assigned_by',
        'created_at', 'updated_at'
      ],
      badges: [
        'id', 'name', 'description', 'icon', 'color', 'type', 'criteria',
        'created_at', 'updated_at', 'deleted_at'
      ]
    };

    const fixes = [];

    for (const [tableName, requiredColumns] of Object.entries(requiredSchema)) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📋 Checking ${tableName}`);
      console.log(`${'═'.repeat(60)}`);

      // Check if table exists
      const [tableExists] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = ?
      `, [tableName]);

      if (tableExists.length === 0) {
        console.log(`❌ Table ${tableName} does not exist!`);
        fixes.push({
          table: tableName,
          issue: 'Table missing',
          fix: 'Need to create table'
        });
        continue;
      }

      // Get existing columns
      const [existingColumns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [tableName]);

      const existingColNames = existingColumns.map(c => c.COLUMN_NAME);
      const missingColumns = requiredColumns.filter(col => !existingColNames.includes(col));

      if (missingColumns.length > 0) {
        console.log(`⚠️  Missing ${missingColumns.length} columns:`);
        missingColumns.forEach(col => {
          console.log(`   - ${col}`);
          fixes.push({
            table: tableName,
            column: col,
            issue: 'Column missing',
            fix: `ALTER TABLE ${tableName} ADD COLUMN ${col}`
          });
        });
      } else {
        console.log(`✅ All required columns present (${existingColNames.length} columns)`);
      }

      // Check for row count
      const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`📦 Rows: ${count[0].count}`);
    }

    // Check for missing tables
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log(`📊 Summary of Issues`);
    console.log(`${'═'.repeat(60)}\n`);

    const tableIssues = fixes.filter(f => f.issue === 'Table missing');
    const columnIssues = fixes.filter(f => f.issue === 'Column missing');

    console.log(`❌ Missing tables: ${tableIssues.length}`);
    console.log(`⚠️  Missing columns: ${columnIssues.length}`);

    if (columnIssues.length > 0) {
      console.log(`\n🔧 Fixing missing columns...\n`);
      
      for (const fix of columnIssues) {
        const columnType = getColumnType(fix.column);
        const alterQuery = `ALTER TABLE ${fix.table} ADD COLUMN ${fix.column} ${columnType}`;
        
        try {
          await connection.execute(alterQuery);
          console.log(`✅ Added ${fix.table}.${fix.column} (${columnType})`);
        } catch (error) {
          console.log(`❌ Failed to add ${fix.table}.${fix.column}: ${error.message}`);
        }
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ Database diagnosis and fixes completed!`);
    console.log(`${'═'.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

function getColumnType(columnName) {
  // UUID columns
  if (columnName.endsWith('_id') || columnName === 'id') {
    return 'CHAR(36) NULL';
  }
  
  // Datetime columns
  if (columnName.endsWith('_at') || columnName === 'date') {
    return 'DATETIME NULL';
  }
  
  // Time columns
  if (columnName.endsWith('_time')) {
    return 'TIME NULL';
  }
  
  // Boolean columns
  if (columnName.startsWith('is_') || columnName === 'notification_sent') {
    return 'BOOLEAN DEFAULT FALSE';
  }
  
  // JSON columns
  if (['data', 'device_info', 'recurrence', 'coordinates', 'supervisors', 
       'access_points', 'equipment', 'criteria'].includes(columnName)) {
    return 'JSON NULL';
  }
  
  // Decimal columns
  if (columnName.includes('latitude') || columnName.includes('longitude')) {
    return 'DECIMAL(10, 8) NULL';
  }
  
  if (columnName === 'geo_radius') {
    return 'DECIMAL(10, 2) DEFAULT 100.00';
  }
  
  // Integer columns
  if (['retry_count', 'late_duration', 'early_departure', 'worked_hours',
       'capacity', 'required_agents', 'required_supervisors', 'floor_level',
       'agent_creation_buffer'].includes(columnName)) {
    return 'INT NULL';
  }
  
  // Enum columns
  if (columnName === 'status') {
    return 'VARCHAR(50) DEFAULT "pending"';
  }
  
  if (columnName === 'type') {
    return 'VARCHAR(50) NULL';
  }
  
  if (columnName === 'channel') {
    return 'VARCHAR(50) NULL';
  }
  
  if (columnName === 'priority') {
    return 'VARCHAR(20) DEFAULT "medium"';
  }
  
  if (columnName === 'role') {
    return 'VARCHAR(50) NULL';
  }
  
  if (columnName === 'geo_type') {
    return 'VARCHAR(20) DEFAULT "circle"';
  }
  
  if (columnName === 'recurrence_type') {
    return 'VARCHAR(20) NULL';
  }
  
  // Text columns
  if (['description', 'notes', 'error_message'].includes(columnName)) {
    return 'TEXT NULL';
  }
  
  if (columnName === 'message') {
    return 'TEXT NOT NULL';
  }
  
  // Photo/file columns
  if (columnName.endsWith('_photo')) {
    return 'VARCHAR(500) NULL';
  }
  
  // Default VARCHAR
  return 'VARCHAR(255) NULL';
}

diagnoseAllTables();
