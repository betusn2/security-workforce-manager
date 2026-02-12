const mysql = require('mysql2/promise');

async function fixAdminEmail() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('✅ Connecté à Railway MySQL');

  // Vérifier si admin@securityguard.com existe
  const [existing] = await connection.query(
    'SELECT id, email FROM users WHERE email = ? AND deleted_at IS NULL',
    ['admin@securityguard.com']
  );

  if (existing.length > 0) {
    console.log('✅ admin@securityguard.com existe déjà!');
    await connection.end();
    return;
  }

  console.log('📧 admin@securityguard.com n\'existe pas, mise à jour...');

  // Mettre à jour admin@security.com vers admin@securityguard.com
  const [result] = await connection.query(
    'UPDATE users SET email = ? WHERE email = ? AND deleted_at IS NULL',
    ['admin@securityguard.com', 'admin@security.com']
  );

  if (result.affectedRows > 0) {
    console.log('✅ Email mis à jour: admin@security.com → admin@securityguard.com');
  } else {
    console.log('⚠️ Aucun utilisateur admin@security.com trouvé');
  }

  // Vérification finale
  const [users] = await connection.query(
    'SELECT email, first_name, last_name, role FROM users WHERE deleted_at IS NULL ORDER BY role DESC'
  );

  console.log('\n📋 UTILISATEURS DANS LA BASE:');
  users.forEach(u => {
    console.log(`  - ${u.email} (${u.first_name} ${u.last_name}) - ${u.role}`);
  });

  await connection.end();
  console.log('\n🎉 Correction terminée!');
}

fixAdminEmail().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
