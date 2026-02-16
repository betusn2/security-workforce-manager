# 🚀 Quick Start - Déploiement Vercel + Render

## ⚡ Résumé Ultra-Rapide

### 1️⃣ Backend sur Render (15 min)
1. Créer DB PostgreSQL sur Render
2. Créer Web Service depuis GitHub `betusn2/security-workforce-manager`
3. Root Directory: `backend`
4. Ajouter les variables d'environnement (voir guide complet)
5. Déployer

### 2️⃣ Frontend sur Vercel (5 min)
1. Import depuis GitHub `betusn2/security-workforce-manager`
2. Root Directory: `web-dashboard`
3. Ajouter variables d'environnement :
   ```
   REACT_APP_API_URL=https://votre-backend.onrender.com/api
   REACT_APP_SOCKET_URL=https://votre-backend.onrender.com
   ```
4. Deploy

### 3️⃣ Mise à jour des URLs (2 min)
1. Copier l'URL Vercel
2. Mettre à jour `FRONTEND_URL` et `SOCKET_CORS_ORIGIN` dans Render
3. Redéployer backend

### 4️⃣ Créer Admin (2 min)
Dans Render Shell:
```bash
cd backend
node create-first-admin.js
```

### 5️⃣ Tester
- Frontend: `https://votre-app.vercel.app`
- Login: `admin@security.com` / `Admin123!`

---

## 📋 Checklist de déploiement

- [ ] Repository pushé sur GitHub
- [ ] Base de données Render créée
- [ ] Backend Render déployé
- [ ] Frontend Vercel déployé
- [ ] URLs mises à jour des deux côtés
- [ ] Admin créé
- [ ] Test de connexion réussi
- [ ] WebSocket fonctionnel

---

## 🔗 Liens Rapides

- [Render Dashboard](https://dashboard.render.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Guide Complet](./DEPLOY-VERCEL-RENDER-GUIDE.md)

---

## 🆘 Problèmes courants

**Backend ne démarre pas?**
→ Vérifiez les logs Render et les variables DB

**Frontend ne se connecte pas?**
→ Vérifiez les URLs et CORS dans les deux services

**WebSocket ne fonctionne pas?**
→ Vérifiez que `SOCKET_CORS_ORIGIN` = URL Vercel

---

Temps total: ~25 minutes ⏱️
