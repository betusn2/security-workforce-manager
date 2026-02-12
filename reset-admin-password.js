const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function resetAdminPassword() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL\n');

  // Vérifier l'utilisateur admin actuel
  const [users] = await connection.query(
    'SELECT id, email, role, status, password FROM users WHERE email IN (?, ?) AND deleted_at IS NULL',
    ['admin@securityguard.com', 'admin@security.com']
  );

  console.log('📋 UTILISATEUR ADMIN ACTUEL:');
  users.forEach(u => {
    console.log(`  Email: ${u.email}`);
    console.log(`  Role: ${u.role}`);
    console.log(`  Status: ${u.status}`);
    console.log(`  Password hash: ${u.password ? u.password.substring(0, 30) + '...' : 'NULL'}`);
    console.log('');
  });

  if (users.length === 0) {
    console.log('❌ Aucun admin trouvé! Création...');
    
    // Créer un nouvel admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await connection.query(`
      INSERT INTO users (
        email, password, first_name, last_name, role, status, 
        employee_id, phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      'admin@securityguard.com',
      hashedPassword,
      'Admin',
      'System',
      'admin',
      'active',
      'ADM001',
      '+212600000000'
    ]);
    console.log('✅ Admin créé avec succès!');
  } else {
    // Réinitialiser le mot de passe
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log(`🔐 Réinitialisation du mot de passe admin...`);
    console.log(`   Nouveau mot de passe: ${newPassword}`);
    console.log(`   Hash bcrypt: ${hashedPassword.substring(0, 30)}...\n`);

    await connection.query(
      'UPDATE users SET password = ?, status = ?, updated_at = NOW() WHERE email IN (?, ?) AND deleted_at IS NULL',
      [hashedPassword, 'active', 'admin@securityguard.com', 'admin@security.com']
    );

    console.log('✅ Mot de passe réinitialisé!');
  }

  // Vérification finale
  const [final] = await connection.query(
    'SELECT email, first_name, last_name, role, status FROM users WHERE email = ? AND deleted_at IS NULL',
    ['admin@securityguard.com']
  );

  if (final.length > 0) {
    const admin = final[0];
    console.log('\n🎉 ADMIN PRÊT:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Nom: ${admin.first_name} ${admin.last_name}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Status: ${admin.status}`);
    console.log(`   Mot de passe: admin123`);
  }

  await connection.end();
}

resetAdminPassword().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
