# 🚀 Quick Start - Architecture Hybride

## ⚡ Railway DB + Render Backend + Vercel Frontend

**Temps total** : 25 minutes

---

## 🎯 Configuration

```
Vercel (Frontend) ←→ Render (Backend) ←→ Railway (MySQL DB)
```

---

## 📋 Prérequis

✅ Vous avez déjà Railway avec MySQL : https://railway.com/project/e578945f-8b65-4d32-b79b-4603779eba9a

**Infos DB Railway :**
```
Host: mainline.proxy.rlwy.net
Port: 20601
Database: railway
User: root
Password: lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
```

---

## 🚀 Étape 1 : Render Backend (15 min)

1. **Aller sur** : https://dashboard.render.com
2. **New +** → **Web Service**
3. **Connect** : `betusn2/security-workforce-manager`
4. **Config** :
   - Root Directory: `backend`
   - Build: `npm install`
   - Start: `node src/server.js`
   - Plan: Free

5. **Variables** (copier-coller) :
```bash
NODE_ENV=production
PORT=5000
DB_HOST=mainline.proxy.rlwy.net
DB_PORT=20601
DB_NAME=railway
DB_USER=root
DB_PASSWORD=lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
DB_DIALECT=mysql
JWT_SECRET=render-prod-jwt-secret-2026-change-me-please
FRONTEND_URL=https://your-app.vercel.app
SOCKET_CORS_ORIGIN=https://your-app.vercel.app
```

6. **Create Web Service** et attendre ~10 min
7. **✏️ Copier l'URL** : `https://xxxx.onrender.com`

---

## 🎨 Étape 2 : Vercel Frontend (5 min)

1. **Aller sur** : https://vercel.com/new
2. **Import** : `betusn2/security-workforce-manager`
3. **Root Directory** : `web-dashboard`
4. **Variables** :
```bash
REACT_APP_API_URL=https://xxxx.onrender.com/api
REACT_APP_SOCKET_URL=https://xxxx.onrender.com
GENERATE_SOURCEMAP=false
```
5. **Deploy** et attendre ~3 min
6. **✏️ Copier l'URL** : `https://xxxx.vercel.app`

---

## 🔄 Étape 3 : Connecter les Services (2 min)

1. **Retour Render** → Environment
2. **Modifier** :
```bash
FRONTEND_URL=https://xxxx.vercel.app
SOCKET_CORS_ORIGIN=https://xxxx.vercel.app
```
3. **Save** → Redémarre auto

---

## 👤 Étape 4 : Créer Admin (2 min)

**Render** → Votre service → **Shell** :
```bash
cd backend
node create-first-admin.js
```

**Login** : `admin@security.com` / `Admin123!`

---

## ✅ Étape 5 : Tester !

1. Ouvrir : `https://xxxx.vercel.app`
2. Se connecter
3. Vérifier GPS/Tracking

---

## ✅ Checklist

- [ ] Railway DB active
- [ ] Render backend déployé
- [ ] Vercel frontend déployé
- [ ] URLs croisées OK
- [ ] Admin créé
- [ ] Test connexion ✓

---

## 📚 Guide Complet

Voir : [DEPLOY-HYBRID-GUIDE.md](./DEPLOY-HYBRID-GUIDE.md)

---

## 💰 Coûts

- Railway DB : ~$5-10/mois
- Render : Gratuit (dort après 15 min)
- Vercel : Gratuit

**Total** : ~$5-10/mois

---

## 🆘 Problèmes ?

**Backend ne démarre pas** → Logs Render  
**DB connexion fail** → Vérifier variables Railway  
**CORS error** → URLs exactes sans `/`

---

⏱️ **25 minutes top chrono !**
