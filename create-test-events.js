const mysql = require('mysql2/promise');

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createTestEvents() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');
  console.log('═'.repeat(70));
  console.log('🎪 CRÉATION D\'ÉVÉNEMENTS DE TEST');
  console.log('═'.repeat(70) + '\n');

  try {
    // Get admin user ID
    const [admin] = await connection.execute(
      'SELECT id FROM users WHERE role = "admin" LIMIT 1'
    );

    if (admin.length === 0) {
      console.log('❌ Aucun admin trouvé!');
      return;
    }

    const adminId = admin[0].id;
    console.log(`👤 Admin ID: ${adminId}\n`);

    // Test events with real Moroccan locations
    const events = [
      {
        name: 'Sécurité Centre Commercial Morocco Mall',
        description: 'Surveillance générale du centre commercial pendant le weekend',
        type: 'regular',
        location: 'Morocco Mall, Casablanca',
        latitude: 33.5415,
        longitude: -7.6825,
        geo_radius: 150,
        start_date: '2026-02-20',
        end_date: '2026-02-22',
        check_in_time: '09:00:00',
        check_out_time: '18:00:00',
        late_threshold: 15,
        required_agents: 3,
        status: 'scheduled',
        priority: 'high',
        color: '#FF5722',
        contact_name: 'Directeur Mall',
        contact_phone: '+212 522-952-000'
      },
      {
        name: 'Concert OLM Souissi - Mohamed Hamaki',
        description: 'Sécurité et contrôle d\'accès pour concert live',
        type: 'special',
        location: 'OLM Souissi, Rabat',
        latitude: 33.9716,
        longitude: -6.8498,
        geo_radius: 200,
        start_date: '2026-02-17',
        end_date: '2026-02-17',
        check_in_time: '18:00:00',
        check_out_time: '23:30:00',
        late_threshold: 10,
        required_agents: 8,
        status: 'active',
        priority: 'urgent',
        color: '#E91E63',
        contact_name: 'Organisateur',
        contact_phone: '+212 537-123-456'
      },
      {
        name: 'Patrouille Quartier Maarif',
        description: 'Patrouille de nuit dans le quartier résidentiel',
        type: 'regular',
        location: 'Maarif, Casablanca',
        latitude: 33.5731,
        longitude: -7.6298,
        geo_radius: 300,
        start_date: '2026-02-16',
        end_date: '2026-02-16',
        check_in_time: '22:00:00',
        check_out_time: '06:00:00',
        late_threshold: 5,
        required_agents: 2,
        status: 'active',
        priority: 'normal',
        color: '#3F51B5',
        contact_name: 'Association Quartier',
        contact_phone: '+212 522-345-678'
      },
      {
        name: 'Sécurité Banque CIH Anfa',
        description: 'Protection des installations bancaires - Service régulier',
        type: 'regular',
        location: 'Boulevard d\'Anfa, Casablanca',
        latitude: 33.5886,
        longitude: -7.6310,
        geo_radius: 50,
        start_date: '2026-02-17',
        end_date: '2026-03-17',
        check_in_time: '08:00:00',
        check_out_time: '17:00:00',
        late_threshold: 10,
        required_agents: 2,
        status: 'scheduled',
        priority: 'high',
        color: '#4CAF50',
        contact_name: 'Responsable Sécurité CIH',
        contact_phone: '+212 522-200-200',
        recurrence_type: 'daily'
      },
      {
        name: 'Mariage Hôtel Kenzi Tower',
        description: 'Sécurité pour réception de mariage - 300 invités',
        type: 'special',
        location: 'Kenzi Tower Hotel, Casablanca',
        latitude: 33.5950,
        longitude: -7.6196,
        geo_radius: 100,
        start_date: '2026-02-21',
        end_date: '2026-02-21',
        check_in_time: '14:00:00',
        check_out_time: '02:00:00',
        late_threshold: 15,
        required_agents: 5,
        status: 'scheduled',
        priority: 'normal',
        color: '#9C27B0',
        contact_name: 'Organisateur Mariage',
        contact_phone: '+212 661-234-567'
      }
    ];

    console.log('📅 Création des événements...\n');

    let created = 0;
    const createdEventIds = [];

    for (const event of events) {
      try {
        const eventId = generateUUID();
        
        await connection.execute(`
          INSERT INTO events (
            id, name, description, type, location, latitude, longitude,
            geo_radius, start_date, end_date, check_in_time, check_out_time,
            late_threshold, required_agents, status, priority, color,
            contact_name, contact_phone, recurrence_type, created_by,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          eventId, event.name, event.description, event.type, event.location,
          event.latitude, event.longitude, event.geo_radius,
          event.start_date, event.end_date, event.check_in_time, event.check_out_time,
          event.late_threshold, event.required_agents, event.status, event.priority,
          event.color, event.contact_name, event.contact_phone, event.recurrence_type || null,
          adminId
        ]);

        createdEventIds.push(eventId);
        console.log(`   ✅ ${event.name}`);
        console.log(`      📍 ${event.location}`);
        console.log(`      📅 ${event.start_date} | ⏰ ${event.check_in_time} - ${event.check_out_time}`);
        console.log(`      👥 ${event.required_agents} agents | 🎯 ${event.status}\n`);
        created++;

      } catch (error) {
        console.log(`   ❌ ${event.name} - ${error.message}\n`);
      }
    }

    console.log(`\n📊 ${created} événements créés\n`);

    // Get agents to create sample assignments for active events
    const [agents] = await connection.execute(
      'SELECT id, first_name, last_name FROM users WHERE role = "agent" AND deleted_at IS NULL'
    );

    if (agents.length > 0 && created > 0) {
      console.log('\n👥 CRÉATION D\'AFFECTATIONS TEST...\n');

      // Get active events
      const [activeEvents] = await connection.execute(
        'SELECT id, name FROM events WHERE status = "active" AND id IN (?)',
        [createdEventIds]
      );

      let assignmentsCreated = 0;
      for (const event of activeEvents) {
        // Assign first 2 agents to each active event
        const agentsToAssign = agents.slice(0, Math.min(2, agents.length));
        
        for (const agent of agentsToAssign) {
          try {
            const assignmentId = generateUUID();
            await connection.execute(`
              INSERT INTO assignments (
                id, agent_id, event_id, assigned_by, role, status,
                notification_sent, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
              assignmentId, agent.id, event.id, adminId,
              'security_agent', 'confirmed', true
            ]);
            
            console.log(`   ✅ ${agent.first_name} ${agent.last_name} → ${event.name.substring(0, 40)}...`);
            assignmentsCreated++;
          } catch (error) {
            if (error.code !== 'ER_DUP_ENTRY') {
              console.log(`   ❌ Erreur affectation: ${error.message}`);
            }
          }
        }
      }
      console.log(`\n   📊 ${assignmentsCreated} affectations créées\n`);
    }

    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('✅ VÉRIFICATION FINALE\n');

    const [eventCount] = await connection.execute('SELECT COUNT(*) as count FROM events');
    const [assignCount] = await connection.execute('SELECT COUNT(*) as count FROM assignments');
    const [eventsByStatus] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM events 
      WHERE deleted_at IS NULL 
      GROUP BY status
    `);

    console.log(`   📅 Total événements: ${eventCount[0].count}`);
    console.log(`   👥 Total affectations: ${assignCount[0].count}\n`);
    
    console.log('   📊 Par statut:');
    eventsByStatus.forEach(s => {
      console.log(`      ${s.status.padEnd(15)}: ${s.count}`);
    });

    console.log('\n' + '═'.repeat(70));
    console.log('🎉 ÉVÉNEMENTS DE TEST CRÉÉS AVEC SUCCÈS!');
    console.log('═'.repeat(70));
    console.log('\n💡 Connectez-vous au dashboard pour voir les événements:\n');
    console.log('   🌐 https://security-workforce-manager.vercel.app');
    console.log('   📧 admin@security.com / 🔑 Admin123!\n');
    console.log('═'.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

createTestEvents();
