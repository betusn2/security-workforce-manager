const mysql = require('mysql2/promise');

async function testBackendQueries() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  // Test queries that the backend might be running
  const testQueries = [
    {
      name: 'Get Attendance with User Join',
      query: `
        SELECT a.*, 
               u.first_name, u.last_name, u.employee_id,
               e.name as event_name
        FROM attendance a
        LEFT JOIN users u ON a.agent_id = u.id
        LEFT JOIN events e ON a.event_id = e.id
        WHERE DATE(a.date) BETWEEN '2026-02-09' AND '2026-02-16'
        LIMIT 10
      `
    },
    {
      name: 'Get Assignments with Joins',
      query: `
        SELECT a.*,
               u.first_name, u.last_name, u.employee_id,
               e.name as event_name
        FROM assignments a
        LEFT JOIN users u ON a.agent_id = u.id
        LEFT JOIN events e ON a.event_id = e.id
        LIMIT 10
      `
    },
    {
      name: 'Get Today Events',
      query: `
        SELECT * FROM events
        WHERE DATE(start_date) <= CURDATE()
          AND DATE(end_date) >= CURDATE()
          AND status = 'active'
          AND deleted_at IS NULL
      `
    },
    {
      name: 'Get My Assignments',
      query: `
        SELECT a.*,
               e.name, e.location, e.start_date, e.check_in_time
        FROM assignments a
        INNER JOIN events e ON a.event_id = e.id
        WHERE a.agent_id = 'b6588a01-0828-11f1-8e41-a2aa9ee14d14'
          AND a.status = 'confirmed'
          AND DATE(e.start_date) = CURDATE()
          AND a.deleted_at IS NULL
          AND e.deleted_at IS NULL
      `
    },
    {
      name: 'Get Notifications',
      query: `
        SELECT * FROM notifications
        WHERE user_id = 'b6588a01-0828-11f1-8e41-a2aa9ee14d14'
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
      `
    },
    {
      name: 'Get Attendance Today Status',
      query: `
        SELECT * FROM attendance
        WHERE agent_id = 'b6588a01-0828-11f1-8e41-a2aa9ee14d14'
          AND DATE(date) = CURDATE()
          AND deleted_at IS NULL
      `
    },
    {
      name: 'Check attendance table structure',
      query: `DESCRIBE attendance`
    },
    {
      name: 'Check assignments table structure', 
      query: `DESCRIBE assignments`
    },
    {
      name: 'Check notifications table structure',
      query: `DESCRIBE notifications`
    }
  ];

  for (const test of testQueries) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 ${test.name}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Query: ${test.query.trim().substring(0, 100)}...`);
    
    try {
      const [rows] = await connection.execute(test.query);
      console.log(`✅ Success! Returned ${rows.length} rows`);
      
      if (rows.length > 0) {
        console.log('📄 First row keys:', Object.keys(rows[0]).join(', '));
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   SQL State: ${error.sqlState}`);
    }
  }

  await connection.end();
}

testBackendQueries();
