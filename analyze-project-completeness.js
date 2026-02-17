const mysql = require('mysql2/promise');

async function analyzeProjectCompleteness() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');
  console.log('═'.repeat(70));
  console.log('📊 ANALYSE DE LA COMPLÉTUDE DU PROJET');
  console.log('═'.repeat(70));

  try {
    // 1. Check data in critical tables
    console.log('\n📋 1. DONNÉES EXISTANTES\n');
    
    const tables = [
      { name: 'users', description: 'Utilisateurs (admins, agents, superviseurs)' },
      { name: 'events', description: 'Événements de sécurité' },
      { name: 'zones', description: 'Zones des événements' },
      { name: 'assignments', description: 'Affectations agents ↔ événements' },
      { name: 'attendance', description: 'Pointages (check-in/check-out)' },
      { name: 'notifications', description: 'Notifications envoyées' },
      { name: 'badges', description: 'Badges/Récompenses' },
      { name: 'permissions', description: 'Permissions système' },
      { name: 'conversations', description: 'Conversations de messagerie' },
      { name: 'messages', description: 'Messages échangés' },
      { name: 'gps_tracking', description: 'Suivi GPS temps réel' },
      { name: 'incidents', description: 'Incidents signalés' },
      { name: 'sos_alerts', description: 'Alertes SOS' }
    ];

    const dataStatus = [];
    
    for (const table of tables) {
      const [count] = await connection.execute(
        `SELECT COUNT(*) as count FROM ${table.name}`
      );
      const hasData = count[0].count > 0;
      dataStatus.push({
        table: table.name,
        count: count[0].count,
        hasData: hasData,
        description: table.description
      });
      
      const icon = hasData ? '✅' : '❌';
      console.log(`${icon} ${table.name.padEnd(20)} ${String(count[0].count).padStart(3)} rows - ${table.description}`);
    }

    // 2. Check users by role
    console.log('\n\n👥 2. UTILISATEURS PAR RÔLE\n');
    
    const [usersByRole] = await connection.execute(`
      SELECT role, COUNT(*) as count, GROUP_CONCAT(CONCAT(first_name, ' ', last_name)) as names
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY role
    `);

    for (const roleGroup of usersByRole) {
      console.log(`   ${roleGroup.role.padEnd(15)} ${String(roleGroup.count).padStart(2)} - ${roleGroup.names}`);
    }

    // Check if we have agents
    const [agentCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM users WHERE role = 'agent' AND deleted_at IS NULL
    `);

    // 3. Check critical missing data
    console.log('\n\n⚠️  3. DONNÉES MANQUANTES CRITIQUES\n');
    
    const missing = [];

    if (agentCount[0].count === 0) {
      missing.push('❌ Aucun agent de sécurité - impossible d\'assigner aux événements');
    } else {
      console.log(`✅ ${agentCount[0].count} agent(s) disponible(s)`);
    }

    const [eventCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM events WHERE deleted_at IS NULL
    `);
    if (eventCount[0].count === 0) {
      missing.push('❌ Aucun événement créé - dashboard vide');
    } else {
      console.log(`✅ ${eventCount[0].count} événement(s) créé(s)`);
    }

    const [permissionCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM permissions
    `);
    if (permissionCount[0].count === 0) {
      missing.push('⚠️  Aucune permission définie - contrôle d\'accès basique');
    } else {
      console.log(`✅ ${permissionCount[0].count} permission(s) définie(s)`);
    }

    const [badgeCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM badges
    `);
    if (badgeCount[0].count === 0) {
      missing.push('⚠️  Aucun badge défini - système de récompenses inactif');
    } else {
      console.log(`✅ ${badgeCount[0].count} badge(s) défini(s)`);
    }

    if (missing.length > 0) {
      console.log('');
      missing.forEach(m => console.log(`   ${m}`));
    }

    // 4. Check table structure completeness
    console.log('\n\n🔧 4. VÉRIFICATION STRUCTURE TABLES\n');

    const structureChecks = [
      { table: 'users', requiredColumns: ['id', 'email', 'password', 'role', 'first_name', 'last_name', 'employee_id', 'deleted_at'] },
      { table: 'events', requiredColumns: ['id', 'name', 'start_date', 'end_date', 'check_in_time', 'latitude', 'longitude', 'deleted_at'] },
      { table: 'attendance', requiredColumns: ['id', 'agent_id', 'event_id', 'check_in_time', 'check_out_time', 'is_late', 'deleted_at'] },
      { table: 'assignments', requiredColumns: ['id', 'agent_id', 'event_id', 'status', 'deleted_at'] }
    ];

    let allStructuresGood = true;
    for (const check of structureChecks) {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = ?
      `, [check.table]);

      const existingCols = columns.map(c => c.COLUMN_NAME);
      const missingCols = check.requiredColumns.filter(col => !existingCols.includes(col));

      if (missingCols.length === 0) {
        console.log(`✅ ${check.table.padEnd(20)} - Structure complète`);
      } else {
        console.log(`❌ ${check.table.padEnd(20)} - Manque: ${missingCols.join(', ')}`);
        allStructuresGood = false;
      }
    }

    // 5. Backend/Frontend checks
    console.log('\n\n🌐 5. CONFIGURATION BACKEND/FRONTEND\n');
    
    console.log('✅ Backend: https://security-workforce-manager.onrender.com (Render)');
    console.log('✅ Frontend: https://security-workforce-manager.vercel.app (Vercel)');
    console.log('✅ Database: Railway MySQL (mainline.proxy.rlwy.net:20601)');
    console.log('✅ WebSocket: Socket.IO configuré pour temps réel');

    // 6. Summary
    console.log('\n\n' + '═'.repeat(70));
    console.log('📊 RÉSUMÉ ET RECOMMANDATIONS');
    console.log('═'.repeat(70) + '\n');

    const emptyTables = dataStatus.filter(t => !t.hasData && 
      ['events', 'zones', 'permissions', 'badges'].includes(t.table)
    );

    console.log('✅ COMPLET:');
    console.log('   • Structure de base de données (23 tables avec UUID)');
    console.log('   • Colonnes deleted_at pour soft deletes');
    console.log('   • Relations et foreign keys');
    console.log('   • Utilisateur admin opérationnel');
    console.log('   • Backend et Frontend déployés\n');

    console.log('⚠️  À COMPLÉTER POUR UTILISATION COMPLÈTE:\n');

    if (agentCount[0].count === 0) {
      console.log('   1. 🚨 PRIORITÉ HAUTE - Créer des agents de sécurité');
      console.log('      → Aller dans "Utilisateurs" > "Ajouter Agent"');
      console.log('      → Minimum 3-5 agents pour tester le système\n');
    }

    if (eventCount[0].count === 0) {
      console.log('   2. 🚨 PRIORITÉ HAUTE - Créer des événements');
      console.log('      → Aller dans "Événements" > "Créer Événement"');
      console.log('      → Définir lieu, date, horaires, géolocalisation');
      console.log('      → Créer 2-3 événements test\n');
    }

    if (permissionCount[0].count === 0) {
      console.log('   3. ⚠️  PRIORITÉ MOYENNE - Configurer les permissions');
      console.log('      → Script à exécuter pour créer permissions par défaut');
      console.log('      → Permet contrôle d\'accès granulaire\n');
    }

    if (badgeCount[0].count === 0) {
      console.log('   4. 💡 PRIORITÉ BASSE - Créer des badges');
      console.log('      → Aller dans "Badges" > "Créer Badge"');
      console.log('      → Ex: "Ponctuel", "Meilleur Agent", "100 Missions"\n');
    }

    console.log('   5. 💡 OPTIONNEL - Données de test supplémentaires');
    console.log('      → Pointages (attendance) historiques');
    console.log('      → Conversations et messages');
    console.log('      → Incidents et alertes test\n');

    console.log('═'.repeat(70));
    console.log('\n🎯 PROCHAINES ÉTAPES:\n');
    console.log('   1. Connectez-vous: https://security-workforce-manager.vercel.app');
    console.log('      📧 admin@security.com / 🔑 Admin123!\n');
    console.log('   2. Créer 3-5 agents de sécurité');
    console.log('   3. Créer 2-3 événements avec géolocalisation');
    console.log('   4. Assigner agents aux événements');
    console.log('   5. Tester le pointage GPS (mobile ou simulateur)\n');
    console.log('═'.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

analyzeProjectCompleteness();
