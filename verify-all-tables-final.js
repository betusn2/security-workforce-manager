const mysql = require('mysql2/promise');

async function verifyAllTables() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  try {
    // All 23 required tables
    const requiredTables = [
      'users', 'events', 'zones', 'assignments', 'attendance',
      'notifications', 'messages', 'conversations', 'badges',
      'permissions', 'user_badges', 'user_permissions', 'user_documents',
      'gps_tracking', 'geo_tracking', 'tracking_alerts', 'sos_alerts',
      'incidents', 'activity_logs', 'liveness_logs', 'fraud_attempts',
      'role_permissions', 'scheduled_backups'
    ];

    console.log('🔍 Vérification des 23 tables requises...\n');

    const [existingTables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_ROWS
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'railway'
      ORDER BY TABLE_NAME
    `);

    const existingTableNames = existingTables.map(t => t.TABLE_NAME);
    
    let allPresent = true;
    let presentCount = 0;

    for (const table of requiredTables) {
      const exists = existingTableNames.includes(table);
      if (exists) {
        const tableInfo = existingTables.find(t => t.TABLE_NAME === table);
        console.log(`✅ ${table.padEnd(25)} (${tableInfo.TABLE_ROWS} rows)`);
        presentCount++;
      } else {
        console.log(`❌ ${table.padEnd(25)} MANQUANTE!`);
        allPresent = false;
      }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 Résumé: ${presentCount}/${requiredTables.length} tables présentes`);
    console.log(`${'═'.repeat(60)}\n`);

    if (allPresent) {
      console.log('🎉 Toutes les tables requises sont présentes!\n');
      
      // Final verification - test critical queries
      console.log('🧪 Test des requêtes critiques...\n');

      const testQueries = [
        { name: 'GET /api/users', query: 'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL' },
        { name: 'GET /api/events', query: 'SELECT COUNT(*) as count FROM events WHERE deleted_at IS NULL' },
        { name: 'GET /api/attendance', query: 'SELECT COUNT(*) as count FROM attendance WHERE deleted_at IS NULL' },
        { name: 'GET /api/assignments', query: 'SELECT COUNT(*) as count FROM assignments WHERE deleted_at IS NULL' },
        { name: 'GET /api/notifications', query: 'SELECT COUNT(*) as count FROM notifications WHERE deleted_at IS NULL' },
        { name: 'LEFT JOIN users-events', query: 'SELECT e.id FROM events e LEFT JOIN users u ON e.created_by = u.id LIMIT 1' },
        { name: 'LEFT JOIN assignments-users', query: 'SELECT a.id FROM assignments a LEFT JOIN users u ON a.agent_id = u.id LIMIT 1' },
        { name: 'LEFT JOIN attendance-events', query: 'SELECT a.id FROM attendance a LEFT JOIN events e ON a.event_id = e.id LIMIT 1' },
      ];

      let allPassed = true;
      for (const test of testQueries) {
        try {
          await connection.execute(test.query);
          console.log(`✅ ${test.name}`);
        } catch (error) {
          console.log(`❌ ${test.name} - ${error.message}`);
          allPassed = false;
        }
      }

      console.log(`\n${'═'.repeat(60)}`);
      if (allPassed) {
        console.log('✅ TOUS LES TESTS PASSÉS - API OPÉRATIONNELLES! 🎉');
      } else {
        console.log('⚠️  Certains tests ont échoué - vérification nécessaire');
      }
      console.log(`${'═'.repeat(60)}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

verifyAllTables();
