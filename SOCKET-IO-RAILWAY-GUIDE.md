# 🔌 TEST SOCKET.IO - RAILWAY

## ✅ Variables Socket.IO ajoutées

J'ai mis à jour les fichiers de configuration Railway avec **toutes les variables Socket.IO** :

### Variables ajoutées
```env
SOCKET_CORS_ORIGIN=https://security-guard-web.onrender.com
SOCKET_PATH=/socket.io/
SOCKET_TRANSPORTS=websocket,polling
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000
WEB_URL=https://security-guard-web.onrender.com
```

## 📝 FICHIERS MIS À JOUR

1. **[railway-variables.env](railway-variables.env)** - Toutes les variables (DB + Socket.IO)
2. **[CONFIGURE-RAILWAY-VARIABLES.md](CONFIGURE-RAILWAY-VARIABLES.md)** - Documentation complète
3. **[test-socket-railway.js](test-socket-railway.js)** - Script de test Socket.IO

## 🚀 PROCÉDURE DE CONFIGURATION

### ÉTAPE 1: Variables Railway
```bash
# Aller sur Railway Dashboard
# Service Backend → Variables → + New Variable

# Copier TOUTES ces lignes depuis railway-variables.env:
DB_HOST=mainline.proxy.rlwy.net
DB_PORT=20601
DB_NAME=railway
DB_USER=root
DB_PASSWORD=lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
DB_SSL=false
DB_DIALECT=mysql
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://security-guard-web.onrender.com
WEB_URL=https://security-guard-web.onrender.com
SOCKET_CORS_ORIGIN=https://security-guard-web.onrender.com
SOCKET_PATH=/socket.io/
SOCKET_TRANSPORTS=websocket,polling
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000
JWT_SECRET=railway-security-guard-jwt-2025-production-secret-key
REFRESH_TOKEN_SECRET=railway-security-guard-refresh-2025-production-secret-key
```

### ÉTAPE 2: Redéployer
1. Cliquer **"Deploy"** dans Railway
2. Attendre 2-3 minutes le redémarrage

### ÉTAPE 3: Tester Socket.IO
```bash
# Installer socket.io-client si nécessaire
npm install socket.io-client

# Lancer le test
node test-socket-railway.js
```

**Résultat attendu:**
```
✅ Authentification réussie
👤 Utilisateur: Admin System
🔑 Token JWT obtenu

🔌 Tentative de connexion Socket.IO...
✅ Socket.IO CONNECTÉ!
🆔 Socket ID: abc123xyz
🔗 Transport: websocket

📍 Test envoi position GPS...
```

## 🧪 TEST DEPUIS LE NAVIGATEUR

Une fois les variables configurées, ouvrir la console du frontend et tester:

```javascript
// 1. Se connecter
const token = localStorage.getItem('authToken');

// 2. Créer une connexion Socket.IO
const socket = io('https://security-guard-deploy-production.up.railway.app', {
  path: '/socket.io/',
  auth: { token }
});

socket.on('connect', () => {
  console.log('✅ Socket.IO connecté!', socket.id);
  
  // Envoyer position GPS
  socket.emit('location:update', {
    latitude: 33.5731,
    longitude: -7.5898,
    accuracy: 10
  });
});

socket.on('connect_error', (err) => {
  console.error('❌ Erreur Socket.IO:', err.message);
});
```

## 🔍 DEBUGGING

### Si Socket.IO ne se connecte pas:

1. **Vérifier les logs Railway:**
   ```
   Railway → Backend Service → Deployments → Logs
   ```
   Chercher: `Socket.IO`, `CORS`, `connection`

2. **Vérifier les variables:**
   ```
   Railway → Backend Service → Variables
   ```
   Toutes les `SOCKET_*` doivent être présentes

3. **Vérifier le CORS:**
   ```javascript
   // Dans server.js, Socket.IO doit autoriser:
   origin: [
     'https://security-guard-web.onrender.com',
     process.env.FRONTEND_URL
   ]
   ```

4. **Test manuel:**
   ```bash
   curl https://security-guard-deploy-production.up.railway.app/socket.io/
   ```
   Résultat attendu: `{"code":0,"message":"Transport unknown"}`

## 📊 MONITORING EN TEMPS RÉEL

Une fois connecté, Socket.IO permet:

- **GPS Tracking** - Position temps réel des agents
- **Check-in/Check-out** - Notifications instantanées
- **Alertes SOS** - Déclenchement immédiat
- **Messages** - Chat en temps réel
- **Incidents** - Rapports en direct

## ⚠️ NOTES IMPORTANTES

1. **Token JWT requis** - Socket.IO nécessite un token valide dans `auth`
2. **CORS configuré** - Frontend Render.com déjà autorisé
3. **Transports** - WebSocket préféré, fallback sur polling
4. **Ping/Pong** - Keepalive toutes les 25 secondes
5. **Reconnexion** - Automatique en cas de déconnexion

## 🔗 LIENS

- Backend Railway: https://security-guard-deploy-production.up.railway.app
- Frontend Render: https://security-guard-web.onrender.com
- Socket.IO Docs: https://socket.io/docs/v4/
