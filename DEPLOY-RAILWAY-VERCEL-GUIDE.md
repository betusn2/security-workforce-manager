# 🚂 Guide de Déploiement Railway + Vercel

## 📋 Architecture
- **Frontend (Dashboard Web)** → Vercel
- **Backend (API + WebSocket)** → Railway
- **Base de données** → Railway MySQL (déjà configurée !)

---

## ✅ Votre Projet Railway Existant

Vous avez déjà un projet Railway : 
**https://railway.com/project/e578945f-8b65-4d32-b79b-4603779eba9a**

### Base de données MySQL déjà configurée :
- Host: `mainline.proxy.rlwy.net`
- Port: `20601`
- Database: `railway`
- User: `root`

---

## 🚀 PARTIE 1 : Configurer le Backend sur Railway

### Étape 1.1 : Connecter le Repository GitHub

1. Ouvrez votre projet Railway : https://railway.com/project/e578945f-8b65-4d32-b79b-4603779eba9a
2. Cliquez sur **"+ New Service"** ou **"New"**
3. Sélectionnez **"GitHub Repo"**
4. Cherchez et sélectionnez : `betusn2/security-workforce-manager`
5. Railway va détecter automatiquement le projet Node.js

### Étape 1.2 : Configurer le Service Backend

1. Une fois le service créé, cliquez dessus
2. Allez dans **"Settings"**
3. **Root Directory** : Mettez `backend`
4. **Start Command** : `node src/server.js`
5. **Watch Paths** : `backend/**`

### Étape 1.3 : Configurer les Variables d'Environnement

Dans votre service Railway, allez dans **"Variables"** et ajoutez :

```bash
# Server Configuration
NODE_ENV=production
PORT=5000

# Database MySQL (utiliser les valeurs de votre DB Railway existante)
DB_HOST=mainline.proxy.rlwy.net
DB_PORT=20601
DB_NAME=railway
DB_USER=root
DB_PASSWORD=lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
DB_SSL=false
DB_DIALECT=mysql

# Security (générer de nouvelles valeurs sécurisées)
JWT_SECRET=votre-secret-jwt-tres-long-et-securise
REFRESH_TOKEN_SECRET=votre-secret-refresh-tres-long-et-securise

# CORS & WebSocket (à mettre à jour après Vercel)
FRONTEND_URL=https://your-app.vercel.app
WEB_URL=https://your-app.vercel.app
SOCKET_CORS_ORIGIN=https://your-app.vercel.app

# Socket.IO Configuration
SOCKET_PATH=/socket.io/
SOCKET_TRANSPORTS=websocket,polling
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000

# Options
BYPASS_TIME_WINDOWS=false
```

### Étape 1.4 : Obtenir l'URL publique

1. Dans votre service Railway, allez dans **"Settings"**
2. Section **"Networking"** → **"Public Networking"**
3. Cliquez sur **"Generate Domain"**
4. Railway va générer une URL : `https://votre-service.up.railway.app`
5. **⚠️ COPIEZ CETTE URL !**

### Étape 1.5 : Déployer

1. Cliquez sur **"Deploy"** ou poussez un commit
2. Railway va automatiquement :
   - Installer les dépendances
   - Builder le projet
   - Démarrer le serveur
3. Attendez 2-3 minutes
4. Vérifiez les logs pour confirmer que tout fonctionne

---

## 🎨 PARTIE 2 : Déployer le Frontend sur Vercel

### Étape 2.1 : Importer le Projet

1. Allez sur https://vercel.com/new
2. Cliquez sur **"Import Project"**
3. Sélectionnez **"Import Git Repository"**
4. Cherchez : `betusn2/security-workforce-manager`
5. Cliquez sur **"Import"**

### Étape 2.2 : Configuration du Projet

**Configure Project** :
- **Project Name** : `security-workforce-manager`
- **Framework Preset** : `Create React App`
- **Root Directory** : cliquez sur "Edit" → sélectionnez `web-dashboard`
- **Build Command** : `npm run build` (par défaut)
- **Output Directory** : `build` (par défaut)

### Étape 2.3 : Variables d'Environnement

Ajoutez dans **"Environment Variables"** :

```bash
REACT_APP_API_URL=https://votre-service.up.railway.app/api
REACT_APP_SOCKET_URL=https://votre-service.up.railway.app
GENERATE_SOURCEMAP=false
```

⚠️ **Remplacez** `votre-service.up.railway.app` par votre vraie URL Railway !

### Étape 2.4 : Déployer

1. Cliquez sur **"Deploy"**
2. Attendez 2-5 minutes pour le build
3. **Copiez l'URL Vercel** : `https://security-workforce-manager.vercel.app`

---

## 🔄 PARTIE 3 : Mettre à Jour les URLs Croisées

### Étape 3.1 : Mettre à jour Railway

1. Retournez sur Railway
2. Sélectionnez votre service backend
3. Allez dans **"Variables"**
4. Modifiez :
   ```bash
   FRONTEND_URL=https://security-workforce-manager.vercel.app
   WEB_URL=https://security-workforce-manager.vercel.app
   SOCKET_CORS_ORIGIN=https://security-workforce-manager.vercel.app
   ```
5. Sauvegardez → Railway redéploie automatiquement

### Étape 3.2 : Vérifier Vercel

1. Sur Vercel Dashboard, vérifiez que les URLs pointent vers Railway
2. Si besoin de modifier : **Settings** → **Environment Variables**
3. Modifiez et cliquez **"Redeploy"**

---

## 📊 PARTIE 4 : Initialiser/Vérifier la Base de Données

### Option A : Base de données déjà configurée

Si vous avez déjà des données, vérifiez simplement la connexion.

### Option B : Nouvelle installation

1. Dans Railway, cliquez sur votre service MySQL
2. Allez dans **"Data"** (ou utilisez un client MySQL)
3. Ou utilisez **Railway CLI** :

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link au projet
railway link

# Se connecter à MySQL
railway connect mysql
```

### Option C : Via script

Depuis votre ordinateur local :

```bash
cd backend
node create-tables-railway.js
node create-first-admin.js
```

---

## ✅ PARTIE 5 : Tests et Vérification

### 5.1 : Tester le Backend Railway

```bash
# Health check
curl https://votre-service.up.railway.app/health

# API test
curl https://votre-service.up.railway.app/api/users
```

### 5.2 : Tester le Frontend Vercel

1. Ouvrez : `https://security-workforce-manager.vercel.app`
2. Vérifiez la page de connexion
3. Essayez de vous connecter
4. Ouvrez la console (F12) pour vérifier les requêtes

### 5.3 : Tester WebSocket

1. Connectez-vous au dashboard
2. Allez dans la section GPS/Tracking
3. Vérifiez que les connexions WebSocket fonctionnent
4. Dans la console, vous devriez voir : `Socket connected`

---

## 🔐 PARTIE 6 : Créer/Vérifier le Compte Admin

### Si admin n'existe pas encore :

1. Dans Railway, cliquez sur votre service backend
2. Cliquez sur **"..." (menu)** → **"Run Command"** ou utilisez Railway CLI
3. Exécutez :

```bash
node create-first-admin.js
```

### Ou depuis votre machine locale :

```bash
cd backend
# Configurez temporairement .env avec les infos Railway
node create-first-admin.js
```

**Identifiants par défaut :**
- Email : `admin@security.com`
- Password : `Admin123!`

---

## 🎯 Récapitulatif des URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend (Vercel)** | `https://security-workforce-manager.vercel.app` | Dashboard web |
| **Backend (Railway)** | `https://votre-service.up.railway.app` | API REST + WebSocket |
| **Base de données (Railway)** | `mainline.proxy.rlwy.net:20601` | MySQL |
| **Project Railway** | https://railway.com/project/e578945f-8b65-4d32-b79b-4603779eba9a | Dashboard |

---

## 🔧 Déploiements Futurs (Automatiques !)

### Pour mettre à jour le Frontend :

```bash
git add .
git commit -m "Update frontend"
git push origin main
```

→ Vercel redéploie automatiquement ! ✨

### Pour mettre à jour le Backend :

```bash
git add .
git commit -m "Update backend"
git push origin main
```

→ Railway redéploie automatiquement ! ✨

---

## 💡 Avantages de Railway vs Render

| Fonctionnalité | Railway | Render |
|----------------|---------|--------|
| **Vitesse déploiement** | ⚡ Très rapide (1-2 min) | 🐌 Plus lent (5-10 min) |
| **Plan gratuit** | 💰 $5 gratuit/mois | 🕐 750h/mois |
| **Cold starts** | ✅ Minimal | ❌ ~30-60s |
| **Facilité config** | ✅✅✅ Très simple | ✅✅ Simple |
| **CLI** | ✅ Excellent | ✅ Bon |
| **Database** | ✅ MySQL/Postgres | ✅ Postgres seulement |
| **Logs** | ✅ En temps réel | ✅ Bon |
| **WebSocket** | ✅ Natif | ✅ Natif |

---

## ⚠️ Points Importants Railway

### 1. Crédits Gratuits
- Railway offre **$5 gratuit par mois**
- Après, c'est pay-as-you-go (très abordable)
- 1 projet = ~$10-15/mois si actif

### 2. Variables d'Environnement
- Utilisez `${{SERVICE_NAME.VARIABLE}}` pour référencer entre services
- Exemple : `DB_HOST=${{MySQL.RAILWAY_PRIVATE_DOMAIN}}`

### 3. Networking
- **Private Network** : Communication interne entre services (gratuit, rapide)
- **Public Domain** : Exposition publique (requis pour API)

### 4. Monitoring
- Railway montre CPU, RAM, Network usage en temps réel
- Alertes automatiques si problème

---

## 🆘 Dépannage

### Backend ne démarre pas

1. **Vérifier les logs** : Railway Dashboard → Service → Logs
2. **Vérifier les variables** : Toutes définies ?
3. **Vérifier le build** : `npm install` réussi ?
4. **Vérifier la DB** : Connexion possible ?

### Frontend ne se connecte pas au backend

1. **CORS** : Vérifiez `SOCKET_CORS_ORIGIN` dans Railway
2. **URLs** : Pas de `/` à la fin
3. **HTTPS** : Les deux doivent être en HTTPS
4. **Console browser** : F12 pour voir les erreurs

### WebSocket ne fonctionne pas

1. Vérifiez que `SOCKET_TRANSPORTS=websocket,polling`
2. Railway supporte WebSocket nativement
3. Vérifiez dans Network tab (F12) : connexion `ws://` ou `wss://`
4. Timeout configuré ? `SOCKET_PING_TIMEOUT=60000`

### Base de données connexion

```javascript
// Tester la connexion depuis Railway shell
const mysql = require('mysql2/promise');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

console.log('✅ Connected!');
```

---

## 📚 Ressources

- [Railway Documentation](https://docs.railway.app/)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Vercel Documentation](https://vercel.com/docs)
- [Socket.IO Documentation](https://socket.io/docs/)

---

## 🚀 Railway CLI - Commandes Utiles

```bash
# Installation
npm install -g @railway/cli

# Login
railway login

# Link au projet
railway link

# Voir les logs
railway logs

# Lancer une commande
railway run node script.js

# Ouvrir le dashboard
railway open

# Variables
railway variables set KEY=value
railway variables list

# Status
railway status
```

---

## 🎁 Bonus : Configuration avancée Railway

### fichier railway.toml (optionnel)

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install"

[deploy]
startCommand = "node src/server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
healthcheckPath = "/health"
healthcheckTimeout = 100

[environments.production]
watch = ["backend/**"]
```

---

**Temps total** : ~15-20 minutes ⏱️

**Besoin d'aide ?** Vérifiez les logs Railway et Vercel !
