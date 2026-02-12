const axios = require('axios');

async function testUsersEndpoint() {
  const baseURL = 'https://security-guard-deploy-production.up.railway.app';
  
  console.log('🔍 Test endpoint /api/users...\n');

  try {
    // Test sans authentification
    console.log('📡 Test 1: GET /api/users (sans auth)');
    const response1 = await axios.get(`${baseURL}/api/users`, {
      validateStatus: () => true // Accepter tous les status codes
    });
    console.log(`   Status: ${response1.status}`);
    console.log(`   Message: ${response1.data?.message || 'N/A'}`);
    console.log(`   Success: ${response1.data?.success || false}`);
    if (response1.data?.error) {
      console.log(`   Error: ${response1.data.error.message || response1.data.error}`);
    }
    console.log('');

    // Essayer de se connecter d'abord pour obtenir un token
    console.log('🔐 Test 2: Login admin pour obtenir un token');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@securityguard.com',
      password: 'admin123'
    }, {
      validateStatus: () => true
    });
    
    console.log(`   Login Status: ${loginResponse.status}`);
    console.log(`   Login Response:`, JSON.stringify(loginResponse.data, null, 2));
    
    if (loginResponse.status === 200 && loginResponse.data?.success) {
      const token = loginResponse.data.data?.accessToken;
      if (token) {
        console.log(`   Token obtenu: ${token.substring(0, 20)}...`);
        console.log('');

        // Test avec authentification
        console.log('📡 Test 3: GET /api/users (avec auth)');
      const response2 = await axios.get(`${baseURL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        validateStatus: () => true
      });
      
      console.log(`   Status: ${response2.status}`);
      console.log(`   Message: ${response2.data?.message || 'N/A'}`);
      console.log(`   Success: ${response2.data?.success || false}`);
      if (response2.data?.error) {
        console.log(`   Error détaillé: ${JSON.stringify(response2.data.error, null, 2)}`);
      }
      console.log(`   Réponse complète: ${JSON.stringify(response2.data, null, 2)}`);
      if (response2.data?.data) {
        console.log(`   Nombre d'utilisateurs: ${response2.data.data.length || 'N/A'}`);
      }
      } else {
        console.log('   ❌ Token manquant dans la réponse');
      }
    } else {
      console.log(`   ❌ Login échoué: ${loginResponse.data?.message || 'Erreur inconnue'}`);
    }

  } catch (error) {
    console.error('❌ Erreur de test:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testUsersEndpoint();