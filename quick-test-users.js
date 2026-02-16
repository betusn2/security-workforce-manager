const axios = require('axios');

async function quickTestUsers() {
  const baseURL = 'https://security-guard-deploy-production.up.railway.app';
  
  console.log('🧪 Test rapide /api/users avec include supervisor...');
  
  // Attendre 1 minute seulement
  console.log('⏳ Attente 1 minute pour redéploiement...');
  for (let i = 60; i > 0; i--) {
    process.stdout.write(`\r   ${i}s`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  try {
    // Login
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@securityguard.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.data.accessToken;
    
    // Test users
    const usersResponse = await axios.get(`${baseURL}/api/users?limit=3`, {
      headers: { 'Authorization': `Bearer ${token}` },
      validateStatus: () => true
    });
    
    console.log(`\n   Status: ${usersResponse.status}`);
    
    if (usersResponse.status === 200) {
      console.log('   ✅ SUCCESS avec include supervisor!');
      console.log(`   Utilisateurs: ${usersResponse.data?.data?.users?.length || 0}`);
      
      if (usersResponse.data?.data?.users?.length > 0) {
        const user = usersResponse.data.data.users[0];
        console.log(`   Test user: ${user.email}`);
        console.log(`   Supervisor: ${user.supervisor ? user.supervisor.firstName + ' ' + user.supervisor.lastName : 'Aucun'}`);
      }
    } else {
      console.log('   ❌ Erreur avec supervisor include');
      if (usersResponse.data?.debug) {
        console.log(`   Error: ${usersResponse.data.debug.error}`);
      }
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

quickTestUsers();