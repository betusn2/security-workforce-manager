# 🚂 Quick Start - Railway + Vercel

## ⚡ Déploiement en 15 Minutes

Vous avez déjà un projet Railway : https://railway.com/project/e578945f-8b65-4d32-b79b-4603779eba9a

---

## 🎯 Étapes Rapides

### 1️⃣ Backend sur Railway (10 min)

1. **Ouvrir Railway** : https://railway.com/project/e578945f-8b65-4d32-b79b-4603779eba9a
2. **Nouveau Service** : "+ New" → "GitHub Repo"
3. **Sélectionner** : `betusn2/security-workforce-manager`
4. **Configurer** :
   - Settings → Root Directory: `backend`
   - Settings → Start Command: `node src/server.js`
5. **Variables** (voir ci-dessous)
6. **Generate Domain** : Settings → Networking → Generate Domain
7. **✏️ Copier l'URL** : `https://votre-service.up.railway.app`

**Variables essentielles :**
```bash
NODE_ENV=production
PORT=5000

# DB (déjà configurée dans votre Railway)
DB_HOST=mainline.proxy.rlwy.net
DB_PORT=20601
DB_NAME=railway
DB_USER=root
DB_PASSWORD=lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
DB_DIALECT=mysql

# Security (générer des clés longues)
JWT_SECRET=your-long-secret-jwt-key-here
REFRESH_TOKEN_SECRET=your-long-secret-refresh-key-here

# CORS (mettre à jour après Vercel)
FRONTEND_URL=https://your-app.vercel.app
SOCKET_CORS_ORIGIN=https://your-app.vercel.app
```

### 2️⃣ Frontend sur Vercel (5 min)

1. **Aller sur** : https://vercel.com/new
2. **Import** : `betusn2/security-workforce-manager`
3. **Root Directory** : `web-dashboard`
4. **Variables** :
   ```
   REACT_APP_API_URL=https://votre-service.up.railway.app/api
   REACT_APP_SOCKET_URL=https://votre-service.up.railway.app
   GENERATE_SOURCEMAP=false
   ```
5. **Deploy** !
6. **✏️ Copier l'URL** : `https://votre-app.vercel.app`

### 3️⃣ Mettre à jour les URLs (1 min)

1. **Retour Railway** → Variables
2. **Modifier** :
   ```
   FRONTEND_URL=https://votre-app.vercel.app
   SOCKET_CORS_ORIGIN=https://votre-app.vercel.app
   ```
3. **Save** (redéploie auto)

### 4️⃣ Créer Admin (1 min)

Railway → Service backend → Menu "..." → Deploy logs ou CLI:
```bash
railway run node create-first-admin.js
```

Login: `admin@security.com` / `Admin123!`

### 5️⃣ Tester ! 🎉

Ouvrir : `https://votre-app.vercel.app`

---

## ✅ Checklist

- [ ] Service Railway backend créé
- [ ] Variables d'environnement Railway configurées
- [ ] Domain Railway généré
- [ ] Frontend Vercel déployé
- [ ] URLs croisées mises à jour
- [ ] Admin créé
- [ ] Test connexion OK

---

## 🔗 Liens Rapides

- [Votre Projet Railway](https://railway.com/project/e578945f-8b65-4d32-b79b-4603779eba9a)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Guide Complet Railway](./DEPLOY-RAILWAY-VERCEL-GUIDE.md)

---

## 💡 Pourquoi Railway ?

- ✅ Pas de cold start (contrairement à Render)
- ✅ Déploiement ultra-rapide (1-2 min)
- ✅ MySQL déjà configuré dans votre projet
- ✅ $5 gratuit/mois
- ✅ WebSocket natif

---

## 🆘 Problèmes ?

**Backend erreur** → Logs Railway  
**Frontend erreur** → Console browser (F12)  
**CORS erreur** → Vérifier URLs exactes (pas de `/`)

---

⏱️ **Temps total** : 15-20 minutes
