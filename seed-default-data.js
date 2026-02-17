const mysql = require('mysql2/promise');

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function seedDefaultData() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');
  console.log('═'.repeat(70));
  console.log('🌱 INITIALISATION DES DONNÉES PAR DÉFAUT');
  console.log('═'.repeat(70) + '\n');

  try {
    // 1. Create default permissions
    console.log('📋 1. CRÉATION DES PERMISSIONS...\n');

    const permissions = [
      // User management
      { code: 'users.view', name: 'Voir utilisateurs', description: 'Voir les utilisateurs', category: 'users', module: 'users', action: 'view' },
      { code: 'users.create', name: 'Créer utilisateurs', description: 'Créer des utilisateurs', category: 'users', module: 'users', action: 'create' },
      { code: 'users.edit', name: 'Modifier utilisateurs', description: 'Modifier les utilisateurs', category: 'users', module: 'users', action: 'edit' },
      { code: 'users.delete', name: 'Supprimer utilisateurs', description: 'Supprimer les utilisateurs', category: 'users', module: 'users', action: 'delete' },
      
      // Event management
      { code: 'events.view', name: 'Voir événements', description: 'Voir les événements', category: 'events', module: 'events', action: 'view' },
      { code: 'events.create', name: 'Créer événements', description: 'Créer des événements', category: 'events', module: 'events', action: 'create' },
      { code: 'events.edit', name: 'Modifier événements', description: 'Modifier les événements', category: 'events', module: 'events', action: 'edit' },
      { code: 'events.delete', name: 'Supprimer événements', description: 'Supprimer les événements', category: 'events', module: 'events', action: 'delete' },
      
      // Assignment management
      { code: 'assignments.view', name: 'Voir affectations', description: 'Voir les affectations', category: 'assignments', module: 'assignments', action: 'view' },
      { code: 'assignments.create', name: 'Créer affectations', description: 'Créer des affectations', category: 'assignments', module: 'assignments', action: 'create' },
      { code: 'assignments.edit', name:'Modifier affectations', description: 'Modifier les affectations', category: 'assignments', module: 'assignments', action: 'edit' },
      { code: 'assignments.delete', name: 'Supprimer affectations', description: 'Supprimer les affectations', category: 'assignments', module: 'assignments', action: 'delete' },
      
      // Attendance management
      { code: 'attendance.view', name: 'Voir pointages', description: 'Voir les pointages', category: 'attendance', module: 'attendance', action: 'view' },
      { code: 'attendance.edit', name: 'Modifier pointages', description: 'Modifier les pointages', category: 'attendance', module: 'attendance', action: 'edit' },
      { code: 'attendance.checkin', name: 'Check-in', description: 'Effectuer un check-in', category: 'attendance', module: 'attendance', action: 'checkin' },
      { code: 'attendance.checkout', name: 'Check-out', description: 'Effectuer un check-out', category: 'attendance', module: 'attendance', action: 'checkout' },
      
      // Reports
      { code: 'reports.view', name: 'Voir rapports', description: 'Voir les rapports', category: 'reports', module: 'reports', action: 'view' },
      { code: 'reports.export', name: 'Exporter rapports', description: 'Exporter les rapports', category: 'reports', module: 'reports', action: 'export' },
      
      // GPS tracking
      { code: 'tracking.view', name: 'Voir suiv GPS', description: 'Voir le suivi GPS', category: 'tracking', module: 'tracking', action: 'view' },
      { code: 'tracking.realtime', name: 'Suivi temps réel', description: 'Accès suivi temps réel', category: 'tracking', module: 'tracking', action: 'realtime' },
      
      // Settings
      { code: 'settings.view', name: 'Voir paramètres', description: 'Voir les paramètres', category: 'settings', module: 'settings', action: 'view' },
      { code: 'settings.edit', name: 'Modifier paramètres', description: 'Modifier les paramètres', category: 'settings', module: 'settings', action: 'edit' },
    ];

    let permCreated = 0;
    for (const perm of permissions) {
      try {
        const permId = generateUUID();
        await connection.execute(`
          INSERT INTO permissions (id, code, name, description, category, module, action, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [permId, perm.code, perm.name, perm.description, perm.category, perm.module, perm.action, 1]);
        console.log(`   ✅ ${perm.code.padEnd(25)} - ${perm.description}`);
        permCreated++;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`   ⏭️  ${perm.code.padEnd(25)} - Déjà existe`);
        } else {
          console.log(`   ❌ ${perm.code.padEnd(25)} - ${error.message}`);
        }
      }
    }

    console.log(`\n   📊 ${permCreated} permissions créées\n`);

    // 2. Create default badges
    console.log('\n🏆 2. CRÉATION DES BADGES...\n');

    const badges = [
      {
        name: 'Ponctuel',
        description: 'Jamais en retard sur 10 pointages consécutifs',
        icon: '⏰',
        color: '#4CAF50',
        type: 'achievement',
        criteria: JSON.stringify({ type: 'punctuality', threshold: 10 })
      },
      {
        name: 'Vétéran',
        description: 'Plus de 100 missions complétées',
        icon: '🎖️',
        color: '#FF9800',
        type: 'achievement',
        criteria: JSON.stringify({ type: 'missions', threshold: 100 })
      },
      {
        name: 'Fiable',
        description: 'Taux de présence de 95% ou plus',
        icon: '⭐',
        color: '#2196F3',
        type: 'achievement',
        criteria: JSON.stringify({ type: 'attendance_rate', threshold: 95 })
      },
      {
        name: 'Agent du Mois',
        description: 'Meilleure performance du mois',
        icon: '🏅',
        color: '#FFD700',
        type: 'monthly',
        criteria: JSON.stringify({ type: 'monthly_performance' })
      },
      {
        name: 'Réactif',
        description: 'Temps de réponse moyen < 5 minutes',
        icon: '⚡',
        color: '#9C27B0',
        type: 'achievement',
        criteria: JSON.stringify({ type: 'response_time', threshold: 5 })
      },
      {
        name: 'Premiere Mission',
        description: 'Première mission complétée avec succès',
        icon: '🎯',
        color: '#00BCD4',
        type: 'milestone',
        criteria: JSON.stringify({ type: 'first_mission' })
      }
    ];

    let badgeCreated = 0;
    for (const badge of badges) {
      try {
        const badgeId = generateUUID();
        await connection.execute(`
          INSERT INTO badges (id, name, description, icon, color, type, criteria, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [badgeId, badge.name, badge.description, badge.icon, badge.color, badge.type, badge.criteria]);
        console.log(`   ✅ ${badge.icon} ${badge.name.padEnd(20)} - ${badge.description}`);
        badgeCreated++;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`   ⏭️  ${badge.icon} ${badge.name.padEnd(20)} - Déjà existe`);
        } else {
          console.log(`   ❌ ${badge.icon} ${badge.name.padEnd(20)} - ${error.message}`);
        }
      }
    }

    console.log(`\n   📊 ${badgeCreated} badges créés\n`);

    // 3. Verify data
    console.log('\n✅ 3. VÉRIFICATION...\n');

    const [permCount] = await connection.execute('SELECT COUNT(*) as count FROM permissions');
    const [badgeCount] = await connection.execute('SELECT COUNT(*) as count FROM badges');

    console.log(`   📋 Permissions: ${permCount[0].count}`);
    console.log(`   🏆 Badges: ${badgeCount[0].count}`);

    console.log('\n' + '═'.repeat(70));
    console.log('✅ DONNÉES PAR DÉFAUT INITIALISÉES!');
    console.log('═'.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

seedDefaultData();
