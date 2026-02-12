# 📋 VARIABLES BACKEND COMPLÈTES - RAILWAY

## 🎯 COPIER/COLLER RAPIDE

**Fichier prêt à l'emploi:** [RAILWAY-VARIABLES-COPIER-COLLER.txt](RAILWAY-VARIABLES-COPIER-COLLER.txt)

```bash
# COPIER CES 17 LIGNES DANS RAILWAY:

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

---

## 📊 TABLEAU RÉCAPITULATIF

### 🗄️ Base de données MySQL (7 variables)

| Variable | Valeur | Description |
|----------|--------|-------------|
| **DB_HOST** | `mainline.proxy.rlwy.net` | Proxy MySQL Railway |
| **DB_PORT** | `20601` | Port de connexion |
| **DB_NAME** | `railway` | Nom de la base |
| **DB_USER** | `root` | Utilisateur admin |
| **DB_PASSWORD** | `lZSPaiVe...` | Mot de passe (secret) |
| **DB_SSL** | `false` | SSL désactivé (proxy) |
| **DB_DIALECT** | `mysql` | Type de base |

### 🚀 Node.js (2 variables)

| Variable | Valeur | Description |
|----------|--------|-------------|
| **NODE_ENV** | `production` | Mode production |
| **PORT** | `5000` | Port serveur |

### 🌐 Frontend (2 variables)

| Variable | Valeur | Description |
|----------|--------|-------------|
| **FRONTEND_URL** | `https://security-guard-web.onrender.com` | URL frontend principal |
| **WEB_URL** | `https://security-guard-web.onrender.com` | URL frontend (fallback) |

### 🔌 Socket.IO (5 variables)

| Variable | Valeur | Description |
|----------|--------|-------------|
| **SOCKET_CORS_ORIGIN** | `https://security-guard-web.onrender.com` | CORS autorisé |
| **SOCKET_PATH** | `/socket.io/` | Chemin WebSocket |
| **SOCKET_TRANSPORTS** | `websocket,polling` | Protocoles |
| **SOCKET_PING_TIMEOUT** | `60000` | Timeout 60s |
| **SOCKET_PING_INTERVAL** | `25000` | Ping toutes les 25s |

### 🔐 JWT Sécurité (2 variables)

| Variable | Valeur | Description |
|----------|--------|-------------|
| **JWT_SECRET** | `railway-security-guard-jwt-...` | Secret JWT (32+ car) |
| **REFRESH_TOKEN_SECRET** | `railway-security-guard-refresh-...` | Secret refresh token |

---

## ✅ TOTAL: 17 VARIABLES OBLIGATOIRES

### Par catégorie:
- ✅ **MySQL:** 7 variables
- ✅ **Node.js:** 2 variables
- ✅ **Frontend:** 2 variables
- ✅ **Socket.IO:** 5 variables
- ✅ **JWT:** 2 variables

---

## 🚀 INSTALLATION EN 3 ÉTAPES

### ÉTAPE 1: Copier
Ouvrir [RAILWAY-VARIABLES-COPIER-COLLER.txt](RAILWAY-VARIABLES-COPIER-COLLER.txt) et tout sélectionner (`Ctrl+A`)

### ÉTAPE 2: Coller dans Railway

#### Méthode 1: Raw Editor (recommandé)
```
Railway Dashboard
→ Backend Service
→ Variables
→ "Raw Editor" (bouton en haut)
→ Coller tout
→ "Update Variables"
```

#### Méthode 2: Une par une
```
Railway Dashboard
→ Backend Service  
→ Variables
→ "+ New Variable"
→ Copier/coller chaque ligne
→ Répéter 17 fois
```

### ÉTAPE 3: Redéployer
```
→ Cliquer "Deploy"
→ Attendre 2-3 minutes
→ Vérifier logs dans "Deployments"
```

---

## 🧪 TESTS POST-CONFIGURATION

### Test PowerShell
```powershell
.\test-railway-complete.ps1
```

**Résultats attendus:**
```
✅ API Health Check accessible
✅ Connexion MySQL fonctionnelle
✅ Authentification réussie
✅ Socket.IO endpoint actif
✅ Tables MySQL lisibles
```

### Test Socket.IO
```bash
node test-socket-railway.js
```

**Résultat attendu:**
```
✅ Socket.IO CONNECTÉ!
🆔 Socket ID: abc123xyz
🔗 Transport: websocket
```

---

## 📁 FICHIERS DE RÉFÉRENCE

| Fichier | Contenu |
|---------|---------|
| **[RAILWAY-VARIABLES-COPIER-COLLER.txt](RAILWAY-VARIABLES-COPIER-COLLER.txt)** | ⚡ Copier/coller direct (sans commentaires) |
| **[RAILWAY-VARIABLES-COMPLET.txt](RAILWAY-VARIABLES-COMPLET.txt)** | 📖 Documentation complète avec explications |
| **[railway-variables.env](railway-variables.env)** | 🔧 Format .env standard |
| **[RAILWAY-BACKEND-VARIABLES.txt](RAILWAY-BACKEND-VARIABLES.txt)** | 📝 Variables avec instructions |
| **[SOCKET-IO-RAILWAY-GUIDE.md](SOCKET-IO-RAILWAY-GUIDE.md)** | 🔌 Guide Socket.IO |
| **[test-railway-complete.ps1](test-railway-complete.ps1)** | 🧪 Script de test complet |

---

## 🔍 VÉRIFICATION RAPIDE

### Variables correctement configurées?

```bash
# Dans Railway → Backend → Variables, vérifier:
✅ DB_HOST contient "mainline.proxy.rlwy.net"
✅ DB_PORT = 20601
✅ DB_PASSWORD = lZSPaiVe... (32+ caractères)
✅ FRONTEND_URL contient "https://"
✅ SOCKET_CORS_ORIGIN = même valeur que FRONTEND_URL
✅ JWT_SECRET et REFRESH_TOKEN_SECRET sont différents
✅ Total = 17 variables
```

### Backend démarré correctement?

```bash
# Dans Railway → Backend → Deployments → Logs, chercher:
✅ "Server running on port 5000"
✅ "Database connected successfully"
✅ "Socket.IO initialized"
✅ Pas d'erreurs "ECONNREFUSED" ou "Authentication failed"
```

---

## ⚠️ ERREURS COURANTES

### Erreur 500 sur /api/auth/login
**Cause:** Variables DB manquantes  
**Solution:** Vérifier toutes les 7 variables `DB_*`

### Socket.IO ne connecte pas
**Cause:** Variables SOCKET manquantes  
**Solution:** Ajouter les 5 variables `SOCKET_*`

### "Authentication failed" dans logs
**Cause:** `DB_PASSWORD` incorrect  
**Solution:** Copier exactement `lZSPaiVeXVPgcVbHQVehucJSdUuahlHS`

### CORS error dans frontend
**Cause:** `SOCKET_CORS_ORIGIN` incorrect  
**Solution:** Doit être exactement `https://security-guard-web.onrender.com`

---

## 🔐 SÉCURITÉ

### ⚠️ NE JAMAIS:
- ❌ Commiter `DB_PASSWORD` dans Git
- ❌ Partager `JWT_SECRET` publiquement
- ❌ Exposer `REFRESH_TOKEN_SECRET`
- ❌ Publier ce fichier sur GitHub public

### ✅ TOUJOURS:
- ✅ Utiliser variables d'environnement Railway
- ✅ Générer secrets uniques par projet
- ✅ Changer secrets si fuite détectée
- ✅ Sauvegarder dans gestionnaire mot de passe

---

## 📞 RESSOURCES

- **Railway Dashboard:** https://railway.app/dashboard
- **Backend URL:** https://security-guard-deploy-production.up.railway.app
- **Frontend URL:** https://security-guard-web.onrender.com
- **Documentation complète:** [RAILWAY-DEPLOYMENT-COMPLETE.md](RAILWAY-DEPLOYMENT-COMPLETE.md)

---

**Dernière mise à jour:** 12 février 2026  
**Status:** ✅ 22 tables MySQL | ⚠️ Variables à configurer  
**Temps installation:** ~3 minutes
