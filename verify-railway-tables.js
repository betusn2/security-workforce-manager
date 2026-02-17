// Script de vérification des tables Railway
const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway'
};

async function verifyDatabase() {
  try {
    console.log('🔄 Connexion à Railway MySQL...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connecté avec succès!\n');

    // Lister toutes les tables
    console.log('📋 Liste des tables:');
    const [tables] = await connection.execute(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'railway' 
       ORDER BY table_name`
    );
    
    if (tables.length === 0) {
      console.log('❌ AUCUNE TABLE TROUVÉE!');
      console.log('⚠️  Vous devez exécuter RAILWAY-ALL-TABLES.sql dans MySQL Workbench!');
    } else {
      console.log(`✅ ${tables.length} tables trouvées:\n`);
      tables.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name || row.TABLE_NAME}`);
      });
    }

    // Vérifier l'utilisateur admin
    console.log('\n🔐 Vérification de l\'admin:');
    try {
      const [users] = await connection.execute(
        `SELECT cin, name, email, role, status FROM users WHERE role = 'admin'`
      );
      
      if (users.length === 0) {
        console.log('❌ ADMIN NON TROUVÉ!');
      } else {
        console.log('✅ Admin trouvé:');
        users.forEach(user => {
          console.log(`   CIN: ${user.cin}`);
          console.log(`   Nom: ${user.name}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Rôle: ${user.role}`);
          console.log(`   Statut: ${user.status}`);
        });
      }
    } catch (error) {
      console.log('❌ Erreur: La table users n\'existe pas!');
      console.log('⚠️  Exécutez RAILWAY-ALL-TABLES.sql d\'abord!');
    }

    await connection.end();
    console.log('\n✅ Vérification terminée.');

  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    console.error('⚠️  Vérifiez les credentials Railway!');
  }
}

verifyDatabase();
