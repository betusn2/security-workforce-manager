// Vérification détaillée de la table users
const mysql = require('mysql2/promise');

const config = {
  host: 'mainline.proxy.rlwy.net',
  port: 20601,
  user: 'root',
  password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
  database: 'railway'
};

async function checkUsers() {
  try {
    const connection = await mysql.createConnection(config);
    
    // Vérifier la structure de la table users
    console.log('📋 Structure de la table users:');
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM users`
    );
    console.log(`✅ ${columns.length} colonnes trouvées\n`);
    
    // Compter les utilisateurs
    console.log('👥 Nombre d\'utilisateurs:');
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM users`
    );
    console.log(`Total: ${countResult[0].total}\n`);
    
    if (countResult[0].total === 0) {
      console.log('⚠️  LA TABLE USERS EST VIDE!');
      console.log('❌ L\'admin n\'a pas été créé par le script SQL\n');
      
      console.log('🔧 Solution: Insérer manuellement l\'admin...');
      
      const insertQuery = `
        INSERT INTO users (cin, name, email, password, role, phone, status, points, level)
        VALUES (
          'ADMIN001',
          'Administrateur Principal',
          'admin@security.com',
          '$2b$10$rKJ5PxWxmKQp7YvB5pZvLOzGKqN.mZo4MgGjCRpqH9qJKnZqYvB5W',
          'admin',
          '+212600000000',
          'active',
          0,
          1
        )
      `;
      
      await connection.execute(insertQuery);
      console.log('✅ Admin créé avec succès!');
      console.log('   Email: admin@security.com');
      console.log('   Password: Admin123!\n');
      
      // Vérifier
      const [users] = await connection.execute(
        `SELECT id, cin, name, email, role FROM users WHERE role = 'admin'`
      );
      console.log('✅ Vérification:');
      console.log(users[0]);
    } else {
      console.log('✅ Utilisateurs existants:');
      const [users] = await connection.execute(
        `SELECT id, cin, name, email, role, status FROM users LIMIT 10`
      );
      users.forEach(user => {
        console.log(`   ${user.id}. ${user.name} (${user.email}) - ${user.role}`);
      });
    }
    
    await connection.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkUsers();
