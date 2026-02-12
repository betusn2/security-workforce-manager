# ⚡ DÉPLOIEMENT RAILWAY - GUIDE COMPLET

## 🎯 OBJECTIF
Configurer le backend Railway avec:
- ✅ **22 tables MySQL** (toutes créées)
- ✅ **Variables d'environnement** (DB + Socket.IO + JWT)
- ✅ **Socket.IO temps réel** (GPS tracking, notifications)

---

## 📊 ÉTAT ACTUEL

### Base de données MySQL ✅
- **Host:** mainline.proxy.rlwy.net:20601
- **Database:** railway
- **Tables:** 22/22 créées
  - users, events, assignments, attendance, notifications, activity_logs
  - zones, conversations, messages, fraud_attempts, sos_alerts
  - permissions, role_permissions, user_permissions, user_documents
  - badges, tracking_alerts, liveness_logs, scheduled_backups
  - **incidents, gps_tracking, geo_tracking** (nouvellement ajoutées)

### Backend Railway ⚠️
- **URL:** https://security-guard-deploy-production.up.railway.app
- **Statut:** Variables manquantes → Erreur 500
- **À faire:** Configurer les variables d'environnement

---

## 🚀 PROCÉDURE RAPIDE (5 MINUTES)

### ÉTAPE 1: Copier les variables
Ouvrir [railway-variables.env](railway-variables.env) et copier TOUTES les lignes

### ÉTAPE 2: Aller sur Railway
1. Ouvrir https://railway.app/dashboard
2. Sélectionner le projet **security-guard-deploy**
3. Cliquer sur le service **BACKEND**
4. Onglet **"Variables"**

### ÉTAPE 3: Coller les variables
Cliquer **"+ New Variable"** et coller:

```env
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

### ÉTAPE 4: Redéployer
1. Cliquer **"Deploy"**
2. Attendre 2-3 minutes

### ÉTAPE 5: Tester
```powershell
# Test complet (API + MySQL + Socket.IO)
.\test-railway-complete.ps1

# Test Socket.IO seul
node test-socket-railway.js
```

---

## 📁 FICHIERS CRÉÉS

| Fichier | Description |
|---------|-------------|
| [railway-variables.env](railway-variables.env) | **Toutes les variables (copier/coller)** |
| [CONFIGURE-RAILWAY-VARIABLES.md](CONFIGURE-RAILWAY-VARIABLES.md) | Documentation détaillée |
| [SOCKET-IO-RAILWAY-GUIDE.md](SOCKET-IO-RAILWAY-GUIDE.md) | Guide Socket.IO complet |
| [test-railway-complete.ps1](test-railway-complete.ps1) | Test PowerShell complet |
| [test-socket-railway.js](test-socket-railway.js) | Test Socket.IO Node.js |
| [import-missing-tables.js](import-missing-tables.js) | Script tables manquantes |

---

## 🧪 TESTS POST-DÉPLOIEMENT

### Test 1: API Health
```bash
curl https://security-guard-deploy-production.up.railway.app/api/health
```
**Attendu:** `{"status":"ok"}`

### Test 2: Login
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
**Attendu:** `{"success":true, "data":{...}}`

### Test 3: Socket.IO
```bash
node test-socket-railway.js
```
**Attendu:** 
```
✅ Socket.IO CONNECTÉ!
🆔 Socket ID: abc123
🔗 Transport: websocket
```

---

## 🔧 VARIABLES DÉTAILLÉES

### Base de données
```env
DB_HOST=mainline.proxy.rlwy.net     # Proxy Railway MySQL
DB_PORT=20601                        # Port spécifique
DB_NAME=railway                      # Nom de la base
DB_USER=root                         # Utilisateur
DB_PASSWORD=lZSPaiVeXV...           # Mot de passe généré
DB_SSL=false                         # SSL désactivé (proxy interne)
DB_DIALECT=mysql                     # Type de base
```

### Socket.IO
```env
SOCKET_CORS_ORIGIN=https://security-guard-web.onrender.com
SOCKET_PATH=/socket.io/              # Chemin WebSocket
SOCKET_TRANSPORTS=websocket,polling  # Protocoles
SOCKET_PING_TIMEOUT=60000            # 60s timeout
SOCKET_PING_INTERVAL=25000           # 25s keepalive
```

### JWT
```env
JWT_SECRET=railway-security-guard-jwt-2025-production-secret-key
REFRESH_TOKEN_SECRET=railway-security-guard-refresh-2025-production-secret-key
```

---

## ❌ DÉPANNAGE

### Erreur 500 sur /api/auth/login
**Cause:** Variables DB manquantes  
**Solution:** Ajouter toutes les variables `DB_*` dans Railway

### Socket.IO ne se connecte pas
**Cause:** Variables SOCKET manquantes  
**Solution:** 
1. Ajouter variables `SOCKET_*` dans Railway
2. Redéployer le backend
3. Vérifier les logs: Railway → Deployments → Logs

### "connect_error": "Authentication error"
**Cause:** Token JWT invalide  
**Solution:** 
1. Se connecter via `/api/auth/login`
2. Récupérer le `accessToken`
3. Utiliser dans Socket.IO: `auth: { token }`

### Tables manquantes
**Cause:** Script import non exécuté  
**Solution:**
```bash
node import-missing-tables.js
```

---

## 📊 VÉRIFICATION TABLES

Toutes les tables existent? Tester:

```sql
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT * FROM users WHERE role='admin';
```

**Résultat attendu:** 22 tables, 4 utilisateurs

---

## 🔗 URLS IMPORTANTES

| Service | URL |
|---------|-----|
| Backend Railway | https://security-guard-deploy-production.up.railway.app |
| Frontend Render | https://security-guard-web.onrender.com |
| Railway Dashboard | https://railway.app/dashboard |
| MySQL (TablePlus) | mainline.proxy.rlwy.net:20601 |

---

## 📞 PROCHAINES ÉTAPES

Après configuration des variables:

1. ✅ Tester l'API: `.\test-railway-complete.ps1`
2. ✅ Tester Socket.IO: `node test-socket-railway.js`
3. ✅ Tester depuis le frontend (navigateur)
4. ✅ Vérifier les logs Railway
5. ✅ Monitorer les connexions temps réel

---

## 💡 NOTES

- **22 tables** MySQL créées et prêtes
- **Variables** à copier/coller en **1 fois**
- **Redéploiement** automatique après ajout variables
- **Socket.IO** pour tracking GPS temps réel
- **JWT** pour authentification sécurisée

**Temps estimé:** 5 minutes pour configuration complète

---

**Dernière mise à jour:** 12 février 2026  
**Status:** ✅ Tables OK | ⚠️ Variables à configurer
