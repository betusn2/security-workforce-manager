const mysql = require('mysql2/promise');

async function debugUsersQuery() {
  const connection = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 20601,
    user: 'root',
    password: 'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',
    database: 'railway'
  });

  console.log('🔍 Debugging query problématique...\n');

  try {
    // Test 1: Requête simple sur users
    console.log('📡 Test 1: SELECT basique sur users');
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL');
    console.log(`   Utilisateurs actifs: ${users[0].count}`);
    
    // Test 2: Vérifier les colonnes supervisor_id
    console.log('\n📡 Test 2: Vérification colonne supervisor_id');
    const [supervisors] = await connection.query('SELECT COUNT(*) as count FROM users WHERE supervisor_id IS NOT NULL AND deleted_at IS NULL');
    console.log(`   Utilisateurs avec superviseur: ${supervisors[0].count}`);
    
    // Test 3: Vérifier les colonnes created_by_user_id  
    console.log('\n📡 Test 3: Vérification colonne created_by_user_id');
    const [creators] = await connection.query('SELECT COUNT(*) as count FROM users WHERE created_by_user_id IS NOT NULL AND deleted_at IS NULL');
    console.log(`   Utilisateurs avec créateur: ${creators[0].count}`);
    
    // Test 4: Vérifier table user_documents
    console.log('\n📡 Test 4: Vérification table user_documents');
    try {
      const [documents] = await connection.query('SELECT COUNT(*) as count FROM user_documents WHERE deleted_at IS NULL');
      console.log(`   Documents utilisateur: ${documents[0].count}`);
    } catch (docError) {
      console.log(`   ❌ Erreur table user_documents: ${docError.message}`);
    }
    
    // Test 5: Test de JOIN manuel
    console.log('\n📡 Test 5: Test JOIN avec supervisor (mimique Sequelize)');
    try {
      const [joinTest] = await connection.query(`
        SELECT 
          u.id, u.email, u.first_name, u.last_name,
          s.id as supervisor_id, s.first_name as supervisor_firstname
        FROM users u
        LEFT JOIN users s ON u.supervisor_id = s.id
        WHERE u.deleted_at IS NULL
        LIMIT 5
      `);
      console.log(`   Résultats JOIN: ${joinTest.length} utilisateurs`);
      joinTest.forEach(user => {
        console.log(`     - ${user.email} (supervisor: ${user.supervisor_firstname || 'Aucun'})`);
      });
    } catch (joinError) {
      console.log(`   ❌ Erreur JOIN: ${joinError.message}`);
    }

    // Test 6: Chercher des valeurs invalides
    console.log('\n📡 Test 6: Recherche de valeurs problématiques');
    const [invalidUsers] = await connection.query(`
      SELECT id, email, supervisor_id, created_by_user_id 
      FROM users 
      WHERE deleted_at IS NULL 
        AND (supervisor_id IS NOT NULL OR created_by_user_id IS NOT NULL)
      LIMIT 10
    `);
    
    for (const user of invalidUsers) {
      // Vérifier si le superviseur existe
      if (user.supervisor_id) {
        const [supCheck] = await connection.query('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [user.supervisor_id]);
        if (supCheck.length === 0) {
          console.log(`   ⚠️  ${user.email}: supervisor_id ${user.supervisor_id} n'existe pas!`);
        }
      }
      
      // Vérifier si le créateur existe  
      if (user.created_by_user_id) {
        const [creatorCheck] = await connection.query('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [user.created_by_user_id]);
        if (creatorCheck.length === 0) {
          console.log(`   ⚠️  ${user.email}: created_by_user_id ${user.created_by_user_id} n'existe pas!`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  await connection.end();
}

debugUsersQuery();