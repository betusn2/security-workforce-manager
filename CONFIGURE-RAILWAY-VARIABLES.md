# 🔧 CONFIGURER LES VARIABLES RAILWAY - URGENCE

## ❌ Problème actuel
```
Error 500 sur /api/auth/login
→ Backend Railway ne peut pas se connecter à MySQL
→ Variables d'environnement manquantes
```

## ✅ SOLUTION EN 3 ÉTAPES

### ÉTAPE 1: Aller sur Railway Dashboard
1. Ouvrir: https://railway.app/dashboard
2. Sélectionner votre projet **security-guard-deploy**
3. Cliquer sur le service **BACKEND** (pas MySQL)

### ÉTAPE 2: Ajouter les variables
1. Dans le service Backend, cliquer sur l'onglet **"Variables"**
2. Cliquer sur **"+ New Variable"**
3. Copier-coller **chaque ligne ci-dessous** :

```bash
# === BASE DE DONNÉES RAILWAY MYSQL ===
DB_HOST=mainline.proxy.rlwy.net
DB_PORT=20601
DB_NAME=railway
DB_USER=root
DB_PASSWORD=lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
DB_SSL=false
DB_DIALECT=mysql

# === NODE ENVIRONMENT ===
NODE_ENV=production
PORT=5000

# === FRONTEND URL ===
FRONTEND_URL=https://security-guard-web.onrender.com
WEB_URL=https://security-guard-web.onrender.com

# === SOCKET.IO CONFIGURATION ===
SOCKET_CORS_ORIGIN=https://security-guard-web.onrender.com
SOCKET_PATH=/socket.io/
SOCKET_TRANSPORTS=websocket,polling
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000

# === JWT SECRETS ===
JWT_SECRET=railway-security-guard-jwt-2025-production-secret-key
REFRESH_TOKEN_SECRET=railway-security-guard-refresh-2025-production-secret-key
```

### ÉTAPE 3: Redéployer
1. Cliquer sur **"Deploy"** (bouton en haut à droite)
2. Attendre 1-2 minutes que le service redémarre
3. Vérifier les logs dans l'onglet **"Deployments"**

## 🧪 TEST APRÈS CONFIGURATION

Ouvrir la console du navigateur et tester:
```javascript
fetch('https://security-guard-deploy-production.up.railway.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@security.com',
    password: 'admin123'
  })
})
.then(r => r.json())
.then(console.log)
```

**Résultat attendu:**
```json
{
  "success": true,
  "message": "Connexion réussie",
  "data": { "user": {...}, "accessToken": "..." }
}
```

## 📊 VÉRIFICATION DES TABLES

Une fois connecté au backend, vérifier que les 22 tables existent:

```sql
SHOW TABLES;
```

Tables attendues:
- users ✅
- events ✅
- assignments ✅
- attendance ✅
- notifications ✅
- activity_logs ✅
- zones ✅
- conversations ✅
- messages ✅
- fraud_attempts ✅
- sos_alerts ✅
- permissions ✅
- role_permissions ✅
- user_permissions ✅
- user_documents ✅
- badges ✅
- tracking_alerts ✅
- liveness_logs ✅
- scheduled_backups ✅
- **incidents ✅** (nouvelle)
- **gps_tracking ✅** (nouvelle)
- **geo_tracking ✅** (nouvelle)

## ⚠️ IMPORTANT

- **NE PAS** utiliser `DATABASE_URL` avec Railway MySQL (conflit avec la config)
- **TOUJOURS** utiliser `DB_HOST`, `DB_PORT`, `DB_NAME`, etc.
- Railway MySQL utilise le proxy `mainline.proxy.rlwy.net:20601`

## 🔗 LIENS UTILES

- Railway Dashboard: https://railway.app/dashboard
- Backend URL: https://security-guard-deploy-production.up.railway.app
- Frontend URL: https://security-guard-web.onrender.com
- Documentation Railway: https://docs.railway.app/
