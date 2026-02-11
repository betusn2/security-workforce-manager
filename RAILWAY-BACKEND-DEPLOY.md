# 🚂 GUIDE: Déployer le Backend sur Railway

**Durée: 5-10 minutes**

---

## ✅ Pourquoi Railway pour le Backend?

- ✅ **Backend Railway ↔ MySQL Railway** = Réseau privé (ultra-rapide, garanti)
- ✅ Pas de problèmes de connexion/timeout
- ✅ Variables database automatiques (`${{MySQL.MYSQLHOST}}`)
- ✅ Gratuit jusqu'à 500h/mois ou $5/mois plan Hobby

---

## 📋 ÉTAPE 1: Créer le Service Backend sur Railway

### 1.1 Accéder à votre projet Railway

1. **Allez sur**: https://railway.app
2. **Ouvrez** votre projet: **"respectful-connection"**
3. Vous devriez voir votre service **MySQL** déjà existant

### 1.2 Ajouter un nouveau service

1. Dans le projet, cliquez sur **"+ New Service"**
2. Sélectionnez **"GitHub Repo"**
3. **Autorisez Railway** à accéder à GitHub (si demandé)
4. **Sélectionnez** le dépôt: **`moheshaimi-beep/security-guard-deploy`**
5. Cliquez sur **"Deploy"**

### 1.3 Configuration du service

Railway va détecter automatiquement que c'est un projet Node.js.

**Nom du service**: Railway le nommera `security-guard-deploy` automatiquement

---

## ⚙️ ÉTAPE 2: Configurer les Variables d'Environnement

### 2.1 Accéder aux variables

1. **Cliquez** sur le nouveau service backend qu'on vient de créer
2. Allez dans l'onglet **"Variables"**
3. Cliquez sur **"+ New Variable"** ou **"Raw Editor"**

### 2.2 Utiliser Railway References (RECOMMANDÉ)

Railway peut référencer automatiquement les variables MySQL:

**Copiez-collez ces variables dans "Raw Editor":**

```
NODE_ENV=production
PORT=5000

DB_HOST=${{MySQL.MYSQL_PRIVATE_URL}}
DB_PORT=3306
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_DIALECT=mysql

JWT_SECRET=security_guard_secret_key_2024_very_secure
JWT_EXPIRES_IN=7d
SESSION_SECRET=BrO9YoRyMtAX21QSNWdbusZKGP6wz3geLmhFcCI4HTnV5jkJ7qUlEa0ipfDvx8
ENCRYPTION_KEY=12345678901234567890123456789012

FRONTEND_URL=https://security-guard-web.onrender.com
SOCKET_CORS_ORIGIN=https://security-guard-web.onrender.com

FACE_RECOGNITION_MODE=local
FACE_MATCH_THRESHOLD=0.45
FACE_DETECTION_CONFIDENCE=0.8

BYPASS_TIME_WINDOWS=true
FORCE_DB_SYNC=true

COMPREFACE_URL=http://localhost:8000
COMPREFACE_API_KEY=your-api-key-here
COMPREFACE_THRESHOLD=0.85
```

**Cliquez** sur **"Add"** ou **"Save"**

---

## 🔧 ÉTAPE 3: Configurer le Root Directory

Railway doit savoir où se trouve le code backend:

1. Dans le service backend, allez dans **"Settings"**
2. Section **"Build"**
3. **Root Directory**: `backend`
4. **Build Command**: `npm install`
5. **Start Command**: `node src/server.js`
6. **Watch Paths**: `backend/**`

**Sauvegardez** les changements

---

## 🌐 ÉTAPE 4: Générer un Domaine Public

1. Dans le service backend, allez dans **"Settings"**
2. Section **"Networking"**
3. Cliquez sur **"Generate Domain"**
4. Railway va créer un domaine comme: 
   - `security-guard-deploy-production.up.railway.app`
   - Ou `your-service.railway.app`

**Copiez cette URL** - vous en aurez besoin pour le frontend!

---

## 🚀 ÉTAPE 5: Déployer

1. Railway va **déployer automatiquement**
2. Allez dans l'onglet **"Deployments"**
3. Suivez le build en temps réel
4. Attendez le statut: **"Success ✅"**

### Vérifier les logs:

1. Cliquez sur le déploiement actif
2. Onglet **"Deploy Logs"**
3. Cherchez:
   ```
   ✅ Using existing database (mysql) - creation skipped in production mode
   🔌 Connecting to mysql at...
   ✅ Database connection established successfully.
   Server running on port 5000
   ```

---

## 🔄 ÉTAPE 6: Mettre à Jour le Frontend

Maintenant que le backend est sur Railway, mettez à jour le frontend:

### Sur Render (Frontend):

1. **Service**: `security-guard-web`
2. **Environment Variables**
3. Modifiez:
   ```
   REACT_APP_API_URL=https://[VOTRE-BACKEND-RAILWAY].railway.app/api
   REACT_APP_SOCKET_URL=https://[VOTRE-BACKEND-RAILWAY].railway.app
   ```
4. **Save Changes**

Le frontend redéploiera automatiquement.

---

## ✅ ÉTAPE 7: Tester

### 7.1 Test Backend Railway

Ouvrez dans le navigateur:
```
https://[VOTRE-BACKEND-RAILWAY].railway.app/api/health
```

Vous devriez voir:
```json
{
  "status": "OK",
  "timestamp": "..."
}
```

### 7.2 Test Frontend → Backend

1. Ouvrez: `https://security-guard-web.onrender.com`
2. Essayez de vous connecter
3. Vérifiez que les données chargent

---

## 📊 Architecture Finale

```
┌─────────────────────────────────────────┐
│   Frontend (Render)                     │
│   security-guard-web.onrender.com       │
└──────────────┬──────────────────────────┘
               │ HTTP/WebSocket
               ▼
┌─────────────────────────────────────────┐
│   Backend (Railway)                     │
│   [your-backend].railway.app            │
└──────────────┬──────────────────────────┘
               │ Réseau Privé Railway
               ▼
┌─────────────────────────────────────────┐
│   MySQL (Railway)                       │
│   mysql-production-XXXX.railway.app     │
└─────────────────────────────────────────┘
```

---

## 💰 Coûts Railway

**Plan Hobby ($5/mois):**
- 500 heures d'exécution/mois
- $0.000231/GB
- Assez pour développement et petite production

**Plan gratuit:**
- 500 heures partagées entre tous les services
- OK pour tests

---

## 🆘 Troubleshooting

### Erreur "Root directory not found"

Vérifiez que **Root Directory = `backend`** dans Settings

### Erreur "Cannot find module"

Build Command doit être `npm install` (dans le dossier backend)

### Database connection failed

Vérifiez que les variables utilisent bien `${{MySQL.XXX}}` references

### Frontend ne se connecte pas

Vérifiez que `REACT_APP_API_URL` pointe vers l'URL Railway du backend

---

## 🎉 Avantages de cette Solution

1. ✅ **Backend ↔ Database** sur même réseau = connexion ultra-rapide
2. ✅ Pas de problèmes CORS cross-provider
3. ✅ Déploiement Git automatique sur Railway
4. ✅ Frontend Render reste gratuit
5. ✅ Logs centralisés par service

---

**Bon déploiement! 🚀**
