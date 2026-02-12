const mysql = require('mysql2/promise');

async function fixColumnMismatch() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('🔧 Correction des colonnes manquantes/problématiques...\n');

  try {
    // 1. Obtenir la structure actuelle
    const [currentColumns] = await connection.query('DESCRIBE users');
    const currentColumnNames = currentColumns.map(col => col.Field);
    
    console.log('📋 Colonnes actuelles dans la table users:');
    currentColumnNames.forEach(col => console.log(`   - ${col}`));
    
    // 2. Colonnes attendues par Sequelize (selon les logs d'erreur et le modèle)
    const expectedColumns = [
      'id', 'employee_id', 'cin', 'first_name', 'last_name', 'email', 'password',
      'phone', 'whatsapp_number', 'role', 'profile_photo', 'facial_vector',
      'facial_descriptor', 'facial_vector_updated_at', 'address', 'date_of_birth',
      'hire_date', 'status', 'last_login', 'notification_preferences', 'refresh_token',
      'height', 'weight', 'diploma', 'diploma_level', 'security_card',
      'security_card_expiry', 'experience_years', 'specializations', 'languages',
      'current_latitude', 'current_longitude', 'last_location_update',
      'rating', 'total_ratings', 'punctuality_score', 'reliability_score',
      'professionalism_score', 'overall_score', 'emergency_contact', 'emergency_phone',
      'id_card_number', 'social_security_number', 'bank_details', 'supervisor_id',
      'authorized_devices', 'last_check_in_location', 'created_by_type',
      'created_by_user_id', 'is_temporary', 'validated_by', 'validated_at',
      'last_liveness_check', 'fraud_score', 'device_fingerprints',
      'created_at', 'updated_at', 'deleted_at'
    ];

    // 3. Trouver les colonnes manquantes
    const missingColumns = expectedColumns.filter(col => !currentColumnNames.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('\n✅ Toutes les colonnes attendues sont présentes!');
      
      // 4. Tester une requête Sequelize simple via API directe
      console.log('\n🧪 Test requête simple via API...');
      const axios = require('axios');
      
      // Login first
      const loginRes = await axios.post('https://security-guard-deploy-production.up.railway.app/api/auth/login', {
        email: 'admin@securityguard.com',
        password: 'admin123'
      });
      
      if (loginRes.status === 200) {
        const token = loginRes.data.data.accessToken;
        
        // Test simple users endpoint avec limit=1 pour débugger
        console.log('   Tentative GET /api/users avec limit=1...');
        const usersRes = await axios.get('https://security-guard-deploy-production.up.railway.app/api/users?limit=1', {
          headers: { 'Authorization': `Bearer ${token}` },
          validateStatus: () => true
        });
        
        console.log(`   Status: ${usersRes.status}`);
        if (usersRes.status !== 200) {
          console.log(`   Erreur: ${usersRes.data?.message}`);
          console.log(`   Détails: ${JSON.stringify(usersRes.data, null, 2)}`);
        } else {
          console.log('   ✅ API users fonctionne maintenant!');
        }
      }
      
    } else {
      console.log(`\n⚠️  Colonnes manquantes: ${missingColumns.join(', ')}`);
      
      // Ajouter les colonnes manquantes
      for (const col of missingColumns) {
        let ddl = '';
        switch(col) {
          case 'latitude':
          case 'longitude':
            ddl = `ALTER TABLE users ADD COLUMN ${col} DECIMAL(10,8) NULL`;
            break;
          default:
            console.log(`     Ignorer colonne inconnue: ${col}`);
            continue;
        }
        
        try {
          await connection.query(ddl);
          console.log(`   ✅ Ajouté: ${col}`);
        } catch (err) {
          if (err.message.includes('Duplicate column')) {
            console.log(`   ⚠️  ${col} existe déjà`);
          } else {
            console.log(`   ❌ Erreur ajout ${col}: ${err.message}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  await connection.end();
}

fixColumnMismatch();