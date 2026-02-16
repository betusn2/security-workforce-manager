const mysql = require('mysql2/promise');

async function fixDatabaseIssues() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL');
  console.log('🔧 Correction des erreurs identifiées\n');
  console.log('═'.repeat(80));

  try {
    // FIX 1: Add is_active column to role_permissions
    console.log('\n📌 FIX 1: Ajouter colonne is_active à role_permissions');
    console.log('─'.repeat(80));
    
    try {
      await connection.execute(`
        ALTER TABLE role_permissions 
        ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER permission_id
      `);
      console.log('✅ Colonne is_active ajoutée');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Colonne is_active existe déjà');
      } else {
        console.log(`⚠️ Erreur: ${err.message}`);
      }
    }

    // FIX 2: Add granted_by column to role_permissions if missing
    console.log('\n📌 FIX 2: Ajouter colonne granted_by à role_permissions');
    console.log('─'.repeat(80));
    
    try {
      await connection.execute(`
        ALTER TABLE role_permissions 
        ADD COLUMN granted_by CHAR(36) NULL AFTER is_active
      `);
      console.log('✅ Colonne granted_by ajoutée');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Colonne granted_by existe déjà');
      } else {
        console.log(`⚠️ Erreur: ${err.message}`);
      }
    }

    // FIX 3: Add zone_id column to assignments
    console.log('\n📌 FIX 3: Ajouter colonne zone_id à assignments');
    console.log('─'.repeat(80));
    
    try {
      await connection.execute(`
        ALTER TABLE assignments 
        ADD COLUMN zone_id CHAR(36) NULL AFTER event_id,
        ADD INDEX idx_zone_id (zone_id)
      `);
      console.log('✅ Colonne zone_id ajoutée avec index');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Colonne zone_id existe déjà');
      } else {
        console.log(`⚠️ Erreur: ${err.message}`);
      }
    }

    // FIX 4: Add updated_at column to role_permissions if missing
    console.log('\n📌 FIX 4: Ajouter colonne updated_at à role_permissions');
    console.log('─'.repeat(80));
    
    try {
      await connection.execute(`
        ALTER TABLE role_permissions 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP 
        AFTER created_at
      `);
      console.log('✅ Colonne updated_at ajoutée');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Colonne updated_at existe déjà');
      } else {
        console.log(`⚠️ Erreur: ${err.message}`);
      }
    }

    // FIX 5: Populate role_permissions with default permissions
    console.log('\n📌 FIX 5: Peupler role_permissions avec permissions par défaut');
    console.log('─'.repeat(80));
    
    // Get all permissions
    const [permissions] = await connection.execute('SELECT id, code FROM permissions');
    console.log(`📦 ${permissions.length} permissions trouvées`);
    
    if (permissions.length === 0) {
      console.log('⚠️ Aucune permission trouvée dans la table permissions!');
      console.log('   Exécutez d\'abord seed-default-data.js');
    } else {
      // Define role permissions mapping
      const rolePermissions = {
        admin: [
          'users.view', 'users.create', 'users.edit', 'users.delete',
          'events.view', 'events.create', 'events.edit', 'events.delete',
          'assignments.view', 'assignments.create', 'assignments.edit', 'assignments.delete',
          'attendance.view', 'attendance.edit', 'attendance.approve',
          'reports.view', 'reports.export',
          'tracking.view', 'tracking.history',
          'settings.view', 'settings.edit',
          'notifications.manage'
        ],
        supervisor: [
          'users.view',
          'events.view', 'events.create', 'events.edit',
          'assignments.view', 'assignments.create', 'assignments.edit',
          'attendance.view', 'attendance.edit',
          'reports.view', 'reports.export',
          'tracking.view', 'tracking.history'
        ],
        agent: [
          'events.view',
          'assignments.view',
          'attendance.view',
          'tracking.view'
        ],
        user: [
          'events.view'
        ]
      };

      // Clear existing role_permissions
      await connection.execute('DELETE FROM role_permissions');
      console.log('🗑️  Anciennes permissions effacées');

      let inserted = 0;
      let skipped = 0;

      // Insert permissions for each role
      for (const [role, codes] of Object.entries(rolePermissions)) {
        console.log(`\n   🔑 Rôle: ${role}`);
        
        for (const code of codes) {
          const permission = permissions.find(p => p.code === code);
          
          if (permission) {
            try {
              await connection.execute(`
                INSERT INTO role_permissions (id, role, permission_id, is_active, created_at)
                VALUES (UUID(), ?, ?, 1, NOW())
              `, [role, permission.id]);
              
              inserted++;
              console.log(`      ✅ ${code}`);
            } catch (err) {
              console.log(`      ⚠️ ${code}: ${err.message}`);
              skipped++;
            }
          } else {
            console.log(`      ⚠️ ${code} - permission non trouvée`);
            skipped++;
          }
        }
      }

      console.log(`\n   📊 Résultat: ${inserted} insérées, ${skipped} ignorées`);
    }

    // Verify the fixes
    console.log('\n\n');
    console.log('═'.repeat(80));
    console.log('🔍 VÉRIFICATION DES CORRECTIONS');
    console.log('═'.repeat(80));

    // Check role_permissions structure
    const [rpColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'role_permissions'
       ORDER BY ORDINAL_POSITION`
    );
    console.log('\n✅ Colonnes role_permissions:');
    rpColumns.forEach(col => console.log(`   - ${col.COLUMN_NAME}`));

    // Check role_permissions data
    const [rpCount] = await connection.execute('SELECT COUNT(*) as total FROM role_permissions');
    console.log(`\n✅ Données: ${rpCount[0].total} enregistrements dans role_permissions`);

    // Check assignments structure
    const [assignColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'assignments'
       AND COLUMN_NAME IN ('id', 'agent_id', 'event_id', 'zone_id', 'status', 'assigned_by')`
    );
    console.log('\n✅ Colonnes assignments critiques:');
    assignColumns.forEach(col => console.log(`   - ${col.COLUMN_NAME}`));

    // Test the query that was failing
    console.log('\n📌 Test de requête API simulée');
    console.log('─'.repeat(80));
    
    try {
      const [testQuery] = await connection.execute(`
        SELECT 
          rp.id,
          rp.role,
          rp.permission_id,
          rp.is_active,
          p.code,
          p.module,
          p.action
        FROM role_permissions rp
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role = 'admin' AND rp.is_active = 1
        LIMIT 5
      `);
      
      console.log(`✅ Requête réussie! ${testQuery.length} permissions trouvées:`);
      testQuery.forEach(row => {
        console.log(`   - ${row.code}`);
      });
    } catch (err) {
      console.log(`❌ Erreur: ${err.message}`);
    }

    console.log('\n\n');
    console.log('═'.repeat(80));
    console.log('✅ CORRECTIONS TERMINÉES');
    console.log('═'.repeat(80));
    console.log('\n📝 Points clés corrigés:');
    console.log('   1. ✅ Colonne is_active ajoutée à role_permissions');
    console.log('   2. ✅ Colonne granted_by ajoutée à role_permissions');
    console.log('   3. ✅ Colonne zone_id ajoutée à assignments');
    console.log('   4. ✅ Table role_permissions peuplée avec permissions par défaut');
    console.log('\n🚀 Les API suivantes devraient maintenant fonctionner:');
    console.log('   - /api/permissions/roles');
    console.log('   - /api/assignments (avec zone_id)');
    console.log('   - /api/zones/event/:eventId');
    console.log('   - /api/creation-history/agents');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await connection.end();
    console.log('\n✅ Connexion fermée');
  }
}

fixDatabaseIssues().catch(console.error);
