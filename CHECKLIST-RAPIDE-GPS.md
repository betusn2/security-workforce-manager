# 📋 CHECKLIST RAPIDE - TRACKING GPS

## 🔍 INFORMATIONS SYSTÈME

**EventID à tester:** `3edc204a-93f8-4a58-972d-6cd022c5a35f`

**Votre UserID:** `16792796-...` (à compléter avec votre UUID complet)

**Votre CIN:** __________ (pour connexion CheckIn)

**Backend URL:** `https://security-guard-backend.onrender.com`

**Frontend URL:** `https://security-guard-web.onrender.com`

---

## 📱 URLS À UTILISER

### Desktop (EventDetails):
```
https://security-guard-web.onrender.com/events/3edc204a-93f8-4a58-972d-6cd022c5a35f
```

### Mobile (CheckIn):
```
https://security-guard-web.onrender.com/checkin
```

### Render Dashboard:
```
https://dashboard.render.com
```

---

## ⏰ TIMING

**Heure du push GitHub:** ________:________ (à noter)

**Heure de test (push + 5min):** ________:________ (calculer)

**Déploiement estimé:** 3-5 minutes après le push

---

## ✅ VÉRIFICATIONS RAPIDES

### 1. Render Déployé? (après 5 min)

- [ ] Frontend: Deploy `26a8687` → Status: **Live** ✅
- [ ] Backend: Deploy `26a8687` → Status: **Live** ✅

### 2. EventDetails Console (F12)

Logs attendus:
```javascript
✅ 🔌 Socket.IO connecté pour suivi temps réel, eventId: 3edc204a-...
✅ 🚪 Joining rooms pour eventId: 3edc204a-...
✅ 📍 Position GPS reçue (tracking:position_update): { userId: "...", lat: 33.XXX, lng: -7.XXX }
```

- [ ] Connecté avec eventId affiché
- [ ] Joining room OK
- [ ] Position GPS reçue (toutes les 5s)

### 3. CheckIn Console (Remote Debug)

Logs attendus:
```javascript
✅ 🔗 Tentative de connexion Socket.IO: ... { userId: "...", eventId: "3edc204a-..." }
✅ 🔐 Authentification Socket.IO avec eventId: 3edc204a-...
✅ 📍 Position GPS envoyée: 33.XXXXX, -7.XXXXX
```

- [ ] EventId présent dans connexion
- [ ] Auth réussie avec eventId
- [ ] Positions envoyées (toutes les 5s)

### 4. Backend Logs Render

Logs attendus:
```
✅ 🔐 Authentification Socket.IO: { userId: '...', role: '...', eventId: '3edc204a-...' }
✅ 📥 REÇU location-update: { socketId: "...", data: { userId: "...", lat: 33.XXX, lng: -7.XXX } }
✅ 📡 BROADCAST position vers room: event:3edc204a-... { userId: "...", lat: 33.XXX, lng: -7.XXX }
```

- [ ] Auth reçue avec eventId
- [ ] Location-update reçue
- [ ] Broadcast vers event:3edc204a-...

### 5. Interface EventDetails

- [ ] 🟢 Banner "Suivi Temps Réel Actif"
- [ ] 👥 "1 agent en ligne" (ou plus)
- [ ] ✅ Table: Agent marqué "En ligne"
- [ ] 📍 Table: Coordonnées GPS affichées (33.XXXXX, -7.XXXXX)
- [ ] 🔋 Table: Batterie affichée (ex: 90%)
- [ ] 🗺️ Carte: Marqueur VERT à ma position
- [ ] 🔄 Carte: Marqueur bouge quand je me déplace

---

## 🚨 SI PROBLÈME

### Pas d'eventId dans logs CheckIn?
→ Frontend pas redéployé. Hard refresh (CTRL+SHIFT+R) et attendre 2 min

### Backend dit "Socket non authentifié"?
→ Vérifier que CheckIn envoie eventId dans auth (voir logs CheckIn)

### EventDetails ne reçoit rien?
→ Vérifier logs backend pour voir si broadcast se fait

---

## 📊 DONNÉES À COPIER POUR DEBUG

Si problème, copier-coller ces infos:

**EventId depuis CheckIn console:**
```
Copier ici le log "eventId: ..."
```

**EventId depuis EventDetails console:**
```
Copier ici le log "eventId: ..."
```

**EventId depuis Backend logs:**
```
Copier ici le log "eventId: ..."
```

**Les 3 doivent être IDENTIQUES:** `3edc204a-93f8-4a58-972d-6cd022c5a35f`

---

## ⚡ ACTION IMMÉDIATE

1. ✅ Attendez 5 minutes après le push GitHub
2. ✅ EventDetails → CTRL+SHIFT+R (hard refresh)
3. ✅ CheckIn → Fermer app + Rouvrir + Connexion CIN
4. ✅ Ouvrir F12 sur EventDetails
5. ✅ Regarder console en temps réel
6. ✅ Vérifier que positions GPS arrivent toutes les 5 secondes

**Temps estimé de test:** 2 minutes

**Si ça marche:** Vous verrez le marqueur sur la carte bouger en temps réel! 🎉

**Si ça ne marche pas:** Envoyez screenshots des 3 consoles (CheckIn, EventDetails, Backend)
