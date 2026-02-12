// ============================================
// TEST SOCKET.IO - RAILWAY BACKEND
// ============================================
// Test de connexion Socket.IO au backend Railway
// Usage: node test-socket-railway.js
// ============================================

const io = require('socket.io-client');

const BACKEND_URL = 'https://security-guard-deploy-production.up.railway.app';

// Fonction pour obtenir un token JWT
async function getAuthToken() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@security.com',
        password: 'admin123'
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Authentification réussie');
      console.log('👤 Utilisateur:', data.data.user.firstName, data.data.user.lastName);
      console.log('🔑 Token JWT obtenu\n');
      return data.data.accessToken;
    } else {
      console.error('❌ Erreur authentification:', data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Erreur connexion API:', error.message);
    return null;
  }
}

// Test de connexion Socket.IO
async function testSocketConnection() {
  console.log('🧪 TEST SOCKET.IO - RAILWAY BACKEND');
  console.log('=====================================\n');

  const token = await getAuthToken();
  if (!token) {
    console.error('❌ Impossible de continuer sans token JWT');
    return;
  }

  console.log('🔌 Tentative de connexion Socket.IO...');
  console.log('📡 URL:', BACKEND_URL);
  console.log('🛤️  Path: /socket.io/');
  console.log('🚀 Transports: websocket, polling\n');

  const socket = io(BACKEND_URL, {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    auth: {
      token: token
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
  });

  // Événements de connexion
  socket.on('connect', () => {
    console.log('✅ Socket.IO CONNECTÉ!');
    console.log('🆔 Socket ID:', socket.id);
    console.log('🔗 Transport:', socket.io.engine.transport.name);
    
    // Test d'envoi de position GPS
    console.log('\n📍 Test envoi position GPS...');
    socket.emit('location:update', {
      latitude: 33.5731,
      longitude: -7.5898,
      accuracy: 10,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Erreur de connexion Socket.IO:', error.message);
    console.log('\n🔧 Vérifications:');
    console.log('   1. Variables SOCKET_* configurées dans Railway?');
    console.log('   2. Backend redéployé après ajout des variables?');
    console.log('   3. FRONTEND_URL correcte dans les variables?');
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.IO déconnecté:', reason);
  });

  socket.on('agent:location', (data) => {
    console.log('📍 Position reçue du serveur:', data);
  });

  socket.on('error', (error) => {
    console.error('❌ Erreur Socket.IO:', error);
  });

  // Écouter les messages du serveur
  socket.on('notification', (data) => {
    console.log('🔔 Notification reçue:', data);
  });

  // Garder le test actif pendant 30 secondes
  setTimeout(() => {
    console.log('\n⏱️  Test terminé après 30 secondes');
    socket.close();
    process.exit(0);
  }, 30000);
}

// Lancer le test
testSocketConnection().catch(console.error);
