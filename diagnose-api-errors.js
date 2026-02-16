const mysql = require('mysql2/promise');

async function diagnoseAPIErrors() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL');
  console.log('🔍 Diagnostic des erreurs API 500\n');
  console.log('═'.repeat(80));

  try {
    // Test 1: Check role_permissions table and data
    console.log('\n📌 TEST 1: /api/permissions/roles');
    console.log('─'.repeat(80));
    
    const [rolePermTable] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'role_permissions'`
    );
    
    if (rolePermTable.length === 0) {
      console.log('❌ Table role_permissions n\'existe pas!');
      console.log('   Cette table est requise pour /api/permissions/roles');
    } else {
      console.log('✅ Table role_permissions existe');
      
      // Check structure
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'role_permissions'
         ORDER BY ORDINAL_POSITION`
      );
      
      console.log('\n   Colonnes:');
      columns.forEach(col => {
        const key = col.COLUMN_KEY === 'PRI' ? ' (PK)' : col.COLUMN_KEY === 'MUL' ? ' (FK)' : '';
        console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${key}`);
      });
      
      // Check if permissionId column exists
      const hasPermissionId = columns.some(c => c.COLUMN_NAME === 'permissionId');
      if (!hasPermissionId) {
        console.log('\n   ⚠️ Colonne permissionId manquante! (devrait être permission_id en snake_case)');
      }
      
      // Count data
      const [count] = await connection.execute('SELECT COUNT(*) as total FROM role_permissions');
      console.log(`\n   Données: ${count[0].total} lignes`);
      
      if (count[0].total === 0) {
        console.log('   ⚠️ Aucune donnée dans role_permissions!');
      } else {
        const [sample] = await connection.execute('SELECT role, permission_id FROM role_permissions LIMIT 5');
        console.log('\n   Échantillon:');
        sample.forEach(row => console.log(`   - ${row.role} => permission_id: ${row.permission_id}`));
      }
    }

    // Test 2: Check permissions table
    console.log('\n\n📌 TEST 2: Table permissions');
    console.log('─'.repeat(80));
    
    const [permTable] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'permissions'`
    );
    
    if (permTable.length === 0) {
      console.log('❌ Table permissions n\'existe pas!');
    } else {
      console.log('✅ Table permissions existe');
      
      const [permCount] = await connection.execute('SELECT COUNT(*) as total FROM permissions');
      console.log(`   Données: ${permCount[0].total} permissions`);
      
      if (permCount[0].total > 0) {
        const [permSample] = await connection.execute('SELECT id, code, module, action FROM permissions LIMIT 5');
        console.log('\n   Échantillon:');
        permSample.forEach(p => console.log(`   - ${p.code}: ${p.module}.${p.action} (id: ${p.id})`));
      }
    }

    // Test 3: Check zones table
    console.log('\n\n📌 TEST 3: /api/zones/event/:eventId');
    console.log('─'.repeat(80));
    
    const [zonesTable] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'zones'`
    );
    
    if (zonesTable.length === 0) {
      console.log('❌ Table zones n\'existe pas!');
    } else {
      console.log('✅ Table zones existe');
      
      // Check required columns
      const [zoneColumns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'zones'`
      );
      
      const requiredCols = ['id', 'event_id', 'name', 'required_agents', 'required_supervisors', 'deleted_at'];
      console.log('\n   Colonnes requises:');
      requiredCols.forEach(col => {
        const exists = zoneColumns.some(c => c.COLUMN_NAME === col);
        console.log(`   ${exists ? '✅' : '❌'} ${col}`);
      });
      
      const [zoneCount] = await connection.execute('SELECT COUNT(*) as total FROM zones WHERE deleted_at IS NULL');
      console.log(`\n   Données: ${zoneCount[0].total} zones actives`);
      
      if (zoneCount[0].total > 0) {
        const [zoneSample] = await connection.execute(
          'SELECT id, name, event_id FROM zones WHERE deleted_at IS NULL LIMIT 3'
        );
        console.log('\n   Échantillon:');
        zoneSample.forEach(z => console.log(`   - ${z.name} (event: ${z.event_id})`));
      }
    }

    // Test 4: Check assignments table
    console.log('\n\n📌 TEST 4: /api/assignments');
    console.log('─'.repeat(80));
    
    const [assignTable] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'assignments'`
    );
    
    if (assignTable.length === 0) {
      console.log('❌ Table assignments n\'existe pas!');
    } else {
      console.log('✅ Table assignments existe');
      
      // Check required columns
      const [assignColumns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'assignments'`
      );
      
      const requiredAssignCols = ['id', 'agent_id', 'event_id', 'zone_id', 'status', 'assigned_by', 'deleted_at'];
      console.log('\n   Colonnes requises:');
      requiredAssignCols.forEach(col => {
        const exists = assignColumns.some(c => c.COLUMN_NAME === col);
        console.log(`   ${exists ? '✅' : '❌'} ${col}`);
      });
      
      const [assignCount] = await connection.execute('SELECT COUNT(*) as total FROM assignments WHERE deleted_at IS NULL');
      console.log(`\n   Données: ${assignCount[0].total} affectations actives`);
      
      if (assignCount[0].total > 0) {
        const [assignSample] = await connection.execute(
          'SELECT id, agent_id, event_id, zone_id, status FROM assignments WHERE deleted_at IS NULL LIMIT 3'
        );
        console.log('\n   Échantillon:');
        assignSample.forEach(a => console.log(`   - Agent ${a.agent_id} => Event ${a.event_id} (${a.status})`));
      }
    }

    // Test 5: Check creation_history requirement
    console.log('\n\n📌 TEST 5: /api/creation-history/agents');
    console.log('─'.repeat(80));
    console.log('ℹ️  Cet endpoint utilise la table users avec ces colonnes:');
    console.log('   - created_by_type (VARCHAR)');
    console.log('   - created_by_user_id (CHAR(36))');
    console.log('   - is_temporary (BOOLEAN)');
    console.log('   - validated_by (CHAR(36))');
    
    const [userColumns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('created_by_type', 'created_by_user_id', 'is_temporary', 'validated_by', 'supervisor_id')`
    );
    
    console.log('\n   Colonnes présentes:');
    const requiredUserCols = ['created_by_type', 'created_by_user_id', 'is_temporary', 'validated_by', 'supervisor_id'];
    requiredUserCols.forEach(col => {
      const found = userColumns.find(c => c.COLUMN_NAME === col);
      if (found) {
        console.log(`   ✅ ${col} (${found.DATA_TYPE})`);
      } else {
        console.log(`   ❌ ${col} - MANQUANT!`);
      }
    });

    // Test 6: Check foreign key constraints
    console.log('\n\n📌 TEST 6: Contraintes de clés étrangères');
    console.log('─'.repeat(80));
    
    const [fks] = await connection.execute(
      `SELECT 
        TABLE_NAME, 
        COLUMN_NAME, 
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = 'railway' 
       AND REFERENCED_TABLE_NAME IN ('users', 'events', 'permissions', 'zones')
       AND TABLE_NAME IN ('role_permissions', 'assignments', 'zones')
       ORDER BY TABLE_NAME, COLUMN_NAME`
    );
    
    if (fks.length > 0) {
      console.log('\n   Clés étrangères trouvées:');
      fks.forEach(fk => {
        console.log(`   ✅ ${fk.TABLE_NAME}.${fk.COLUMN_NAME} => ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    } else {
      console.log('\n   ⚠️ Aucune contrainte FK trouvée (peut être normal si non définies)');
    }

    // Test 7: Test a real query like the API would do
    console.log('\n\n📌 TEST 7: Simulation requête API (RolePermission avec Permission)');
    console.log('─'.repeat(80));
    
    try {
      const [testQuery] = await connection.execute(`
        SELECT 
          rp.id,
          rp.role,
          rp.permission_id,
          rp.is_active,
          p.id as perm_id,
          p.code,
          p.module,
          p.action
        FROM role_permissions rp
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role = 'admin' AND rp.is_active = 1
        LIMIT 5
      `);
      
      if (testQuery.length > 0) {
        console.log('✅ Requête JOIN réussie!');
        console.log(`\n   ${testQuery.length} permissions trouvées pour admin:`);
        testQuery.forEach(row => {
          if (row.code) {
            console.log(`   ✅ ${row.code} (${row.module}.${row.action})`);
          } else {
            console.log(`   ⚠️ permission_id ${row.permission_id} n'a pas de correspondance dans permissions!`);
          }
        });
      } else {
        console.log('⚠️ Requête réussie mais aucune permission trouvée pour admin');
      }
    } catch (err) {
      console.log('❌ Erreur lors du test de requête:');
      console.log(`   ${err.message}`);
    }

    // Summary
    console.log('\n\n');
    console.log('═'.repeat(80));
    console.log('📊 RÉSUMÉ DU DIAGNOSTIC');
    console.log('═'.repeat(80));
    console.log('\nEndpoints à problème identifiés:');
    console.log('1. /api/permissions/roles - Vérifier role_permissions + association Sequelize');
    console.log('2. /api/zones/event/:eventId - Vérifier deleted_at et associations');
    console.log('3. /api/assignments - Vérifier colonnes et deleted_at');
    console.log('4. /api/creation-history/agents - Vérifier colonnes creation tracking dans users');
    console.log('\n✅ Exécutez les corrections suggérées ci-dessus');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await connection.end();
    console.log('\n✅ Connexion fermée');
  }
}

diagnoseAPIErrors().catch(console.error);
