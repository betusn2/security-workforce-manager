const axios = require('axios');

async function testUsersFixedVersion() {
  const baseURL = 'https://security-guard-deploy-production.up.railway.app';
  
  console.log('🧪 Test de la version debug de /api/users...\n');

  console.log('⏳ Attendre 3 minutes pour le redéploiement Railway...');
  
  // Attendre 3 minutes (180 secondes)
  for (let i = 180; i > 0; i--) {
    process.stdout.write(`\r   Temps restant: ${i}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n🔍 Test endpoint après redéploiement:');

  try {
    // 1. Login
    console.log('1. 🔐 Login admin...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@securityguard.com',
      password: 'admin123'
    });
    
    if (loginResponse.status === 200) {
      const token = loginResponse.data.data.accessToken;
      console.log('   ✅ Login réussi\n');

      // 2. Test users endpoint
      console.log('2. 📡 GET /api/users (version debug)...');
      const usersResponse = await axios.get(`${baseURL}/api/users?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` },
        validateStatus: () => true // Accepter tous status codes
      });
      
      console.log(`   Status: ${usersResponse.status}`);
      
      if (usersResponse.status === 200) {
        console.log('   ✅ SUCCESS! Les utilisateurs se chargent maintenant!');
        console.log(`   Utilisateurs trouvés: ${usersResponse.data?.data?.users?.length || 0}`);
        console.log(`   Pagination: ${JSON.stringify(usersResponse.data?.data?.pagination || {})}`);
        
        if (usersResponse.data?.data?.users?.length > 0) {
          console.log('   Premier utilisateur:');
          const firstUser = usersResponse.data.data.users[0];
          console.log(`     - Email: ${firstUser.email}`);
          console.log(`     - Nom: ${firstUser.firstName} ${firstUser.lastName}`);
          console.log(`     - Role: ${firstUser.role}`);
        }
      } else {
        console.log('   ❌ Erreur persiste');
        console.log(`   Message: ${usersResponse.data?.message}`);
        if (usersResponse.data?.debug) {
          console.log(`   Debug error: ${usersResponse.data.debug.error}`);
          console.log(`   Error name: ${usersResponse.data.debug.name}`);
        }
      }

    } else {
      console.log('   ❌ Login échoué');
    }

  } catch (error) {
    console.error('❌ Erreur de test:', error.message);
  }
}

testUsersFixedVersion();