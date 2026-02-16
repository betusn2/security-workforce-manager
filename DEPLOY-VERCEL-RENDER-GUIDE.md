# 🚀 Guide de Déploiement Complet - Vercel + Render

## 📋 Architecture
- **Frontend (Dashboard Web)** → Vercel
- **Backend (API + WebSocket)** → Render
- **Base de données** → Render PostgreSQL ou PlanetScale MySQL

---

## 🎯 Partie 1 : Déploiement Backend sur Render

### Étape 1.1: Créer la base de données

1. Allez sur [Render Dashboard](https://dashboard.render.com)
2. Cliquez sur **"New +"** → **"PostgreSQL"**
3. Configuration :
   - **Name:** `security-guard-db`
   - **Database:** `security_guard_db`
   - **User:** (généré automatiquement)
   - **Region:** `Frankfurt` (Europe)
   - **Plan:** `Free`
4. Cliquez sur **"Create Database"**
5. ⚠️ **IMPORTANT:** Copiez les informations de connexion :
   - `Internal Database URL`
   - `External Database URL`
   - `PSQL Command`

### Étape 1.2: Créer le service Backend

1. Sur Render Dashboard, cliquez **"New +"** → **"Web Service"**
2. Connectez votre repository GitHub :
   - Repository: `betusn2/security-workforce-manager`
   - Branch: `main`
3. Configuration :
   - **Name:** `security-workforce-backend`
   - **Region:** `Frankfurt`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Plan:** `Free`

### Étape 1.3: Configurer les variables d'environnement Backend

Ajoutez ces variables dans **Environment** → **Add Environment Variable** :

```bash
# Configuration serveur
NODE_ENV=production
PORT=5000

# Base de données (copier depuis votre DB Render)
DATABASE_URL=<votre-internal-database-url>
DB_HOST=<host-de-votre-db>
DB_PORT=5432
DB_NAME=security_guard_db
DB_USER=<user-de-votre-db>
DB_PASSWORD=<password-de-votre-db>

# Sécurité (générer des valeurs aléatoires)
JWT_SECRET=<générer-une-clé-secrète-longue>
SESSION_SECRET=<générer-une-autre-clé-secrète>

# CORS et WebSocket (mettre à jour après déploiement Vercel)
FRONTEND_URL=https://your-frontend.vercel.app
SOCKET_CORS_ORIGIN=https://your-frontend.vercel.app

# Mode
BYPASS_TIME_WINDOWS=false
```

4. Cliquez sur **"Create Web Service"**
5. Attendez la fin du déploiement (5-10 minutes)
6. **Copiez l'URL du backend** : `https://security-workforce-backend.onrender.com`

---

## 🎨 Partie 2 : Déploiement Frontend sur Vercel

### Étape 2.1: Importer le projet sur Vercel

1. Allez sur [Vercel Dashboard](https://vercel.com/new)
2. Cliquez sur **"Import Project"**
3. Sélectionnez **"Import Git Repository"**
4. Cherchez : `betusn2/security-workforce-manager`
5. Cliquez sur **"Import"**

### Étape 2.2: Configuration du projet

1. **Configure Project** :
   - **Project Name:** `security-workforce-manager`
   - **Framework Preset:** `Create React App`
   - **Root Directory:** `web-dashboard`
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`

### Étape 2.3: Variables d'environnement Frontend

Ajoutez dans **Environment Variables** :

```bash
REACT_APP_API_URL=https://security-workforce-backend.onrender.com/api
REACT_APP_SOCKET_URL=https://security-workforce-backend.onrender.com
GENERATE_SOURCEMAP=false
```

⚠️ **Remplacez l'URL** par votre vraie URL Render du backend !

3. Cliquez sur **"Deploy"**
4. Attendez la fin du build (2-5 minutes)
5. **Copiez l'URL frontend** : `https://security-workforce-manager.vercel.app`

---

## 🔄 Partie 3 : Mise à jour des URLs

### Étape 3.1: Mettre à jour le Backend

1. Retournez sur [Render Dashboard](https://dashboard.render.com)
2. Sélectionnez votre service `security-workforce-backend`
3. Allez dans **Environment**
4. Modifiez ces variables :
   ```bash
   FRONTEND_URL=https://security-workforce-manager.vercel.app
   SOCKET_CORS_ORIGIN=https://security-workforce-manager.vercel.app
   ```
5. Cliquez sur **"Save Changes"**
6. Le service va redémarrer automatiquement

### Étape 3.2: Vérifier Vercel

1. Sur Vercel, vérifiez que les variables pointent vers la bonne URL Render
2. Si besoin, allez dans **Settings** → **Environment Variables**
3. Modifiez et redéployez si nécessaire

---

## 📊 Partie 4 : Initialiser la base de données

### Option A: Via Render Shell

1. Sur Render Dashboard, sélectionnez `security-workforce-backend`
2. Cliquez sur **"Shell"** (en haut à droite)
3. Exécutez :
   ```bash
   npm run migrate
   ```

### Option B: Via connexion directe

1. Utilisez le `PSQL Command` de votre base de données
2. Ou utilisez DBeaver/pgAdmin avec l'External Database URL
3. Importez le schéma SQL depuis `backend/sql/`

---

## ✅ Partie 5 : Tests et Vérification

### 5.1: Tester le Backend

```bash
# Health check
curl https://security-workforce-backend.onrender.com/health

# API test
curl https://security-workforce-backend.onrender.com/api/users
```

### 5.2: Tester le Frontend

1. Ouvrez : `https://security-workforce-manager.vercel.app`
2. Vérifiez la page de connexion
3. Essayez de vous connecter
4. Vérifiez la console du navigateur (F12)

### 5.3: Tester WebSocket

1. Ouvrez le dashboard
2. Allez dans la section GPS/Tracking
3. Vérifiez que les mises à jour en temps réel fonctionnent

---

## 🔐 Partie 6 : Créer un compte Admin

### Via Render Shell :

```bash
# Se connecter au shell
cd backend
node create-admin.js
```

### Ou créer un script temporaire :

Créez `backend/create-first-admin.js` :

```javascript
require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function createAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const hashedPassword = await bcrypt.hash('Admin123!', 10);
  
  await connection.execute(`
    INSERT INTO users (cin, name, email, password, role, phone, status)
    VALUES ('ADMIN001', 'Admin Principal', 'admin@security.com', ?, 'admin', '+212600000000', 'active')
  `, [hashedPassword]);

  console.log('✅ Admin créé avec succès!');
  console.log('Email: admin@security.com');
  console.log('Password: Admin123!');
  
  await connection.end();
}

createAdmin();
```

Puis dans le Shell Render :
```bash
node create-first-admin.js
```

---

## 🎯 Récapitulatif des URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend (Vercel)** | `https://security-workforce-manager.vercel.app` | Dashboard web |
| **Backend (Render)** | `https://security-workforce-backend.onrender.com` | API REST |
| **Base de données** | `postgresql://...` | PostgreSQL sur Render |

---

## 🔧 Déploiements futurs

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

→ Render redéploie automatiquement ! ✨

---

## ⚠️ Points importants

1. **Free Plan Render** : Le backend s'endort après 15 minutes d'inactivité
   - Premier appel peut prendre 30-60 secondes
   
2. **CORS** : Les URLs doivent correspondre exactement
   - Pas de `/` à la fin
   - HTTPS uniquement
   
3. **Variables d'environnement** : 
   - Ne jamais commiter les fichiers `.env`
   - Toujours utiliser les variables via les dashboards
   
4. **Base de données Free** :
   - 90 jours d'expiration sur Render Free
   - Pensez à exporter régulièrement

---

## 🆘 Dépannage

### Le backend ne démarre pas

1. Vérifiez les logs sur Render
2. Vérifiez les variables d'environnement
3. Vérifiez la connexion à la database

### Le frontend ne peut pas se connecter au backend

1. Vérifiez les URLs dans Vercel environment variables
2. Vérifiez le CORS dans le backend
3. Vérifiez la console du navigateur (F12)

### WebSocket ne fonctionne pas

1. Vérifiez `SOCKET_CORS_ORIGIN` dans le backend
2. Vérifiez `REACT_APP_SOCKET_URL` dans le frontend
3. Les deux doivent être identiques à l'URL frontend Vercel

---

## 📚 Ressources

- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Render](https://render.com/docs)
- [Socket.IO Documentation](https://socket.io/docs/)

---

**Besoin d'aide ?** Consultez les logs :
- Vercel : Dashboard → Project → Deployments → Logs
- Render : Dashboard → Service → Logs
