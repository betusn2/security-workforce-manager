// ============================================
// Import Sample Data to Railway MySQL Database
// ============================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configuration Railway MySQL
const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  database: 'railway',
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

async function importData() {
  console.log('🚀 Import des données vers Railway MySQL...');
  
  let connection;
  
  try {
    // Test de connexion
    console.log('🔗 Connexion à Railway MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connexion Railway réussie');
    
    // Lire le fichier SQL
    console.log('📖 Lecture du fichier SQL...');
    const sqlFile = path.join(__dirname, 'import-data-railway.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Diviser les requêtes
    const queries = sqlContent
      .split(';')
      .filter(query => query.trim() && !query.trim().startsWith('--'))
      .map(query => query.trim());
    
    console.log(`📊 Exécution de ${queries.length} requêtes...`);
    
    // Exécuter chaque requête
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      if (query) {
        try {
          await connection.execute(query);
          console.log(`✅ Requête ${i + 1}/${queries.length} exécutée`);
        } catch (error) {
          if (!error.message.includes('Duplicate entry')) {
            console.log(`⚠️  Requête ${i + 1} ignorée: ${error.message}`);
          }
        }
      }
    }
    
    // Vérification des données
    console.log('🔍 Vérification des données importées...');
    
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [zones] = await connection.execute('SELECT COUNT(*) as count FROM zones');  
    const [events] = await connection.execute('SELECT COUNT(*) as count FROM events');
    
    console.log(`✅ Utilisateurs: ${users[0].count}`);
    console.log(`✅ Zones: ${zones[0].count}`); 
    console.log(`✅ Événements: ${events[0].count}`);
    
    // Afficher les utilisateurs créés
    console.log('\n📋 Utilisateurs importés:');
    const [userList] = await connection.execute(
      'SELECT firstName, lastName, role, cin, email FROM users ORDER BY role, firstName'
    );
    
    userList.forEach(user => {
      console.log(`   ${user.role.toUpperCase()}: ${user.firstName} ${user.lastName} (${user.cin}) - ${user.email}`);
    });
    
    console.log('\n🎉 Import Railway terminé avec succès!');
    console.log('\n🌐 Testez votre application:');
    console.log('   Frontend: https://security-guard-web.onrender.com');
    console.log('   Backend: https://security-guard-backend.onrender.com');
    
  } catch (error) {
    console.error('❌ Erreur d\'import:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('🔧 Vérifiez l\'adresse du serveur MySQL');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('🔧 Vérifiez les identifiants MySQL dans Railway Dashboard');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔧 Vérifiez que le service MySQL est actif sur Railway');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Exécuter l'import
importData().catch(console.error);