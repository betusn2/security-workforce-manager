# 📝 FORMULAIRE DE TEST GPS - À REMPLIR

## 📅 INFORMATIONS DE DÉPLOIEMENT

**Date du test:** _____ / _____ / 2026

**Heure du push GitHub:** _____ h _____ (notée au moment du `git push`)

**Heure de test recommandée:** _____ h _____ (push + 5 minutes minimum)

**Commit déployé:** `26a8687`

---

## 🔑 VOS IDENTIFIANTS

**Votre CIN (pour CheckIn):** ________________________________

**Votre Email:** ________________________________

**Votre Nom complet:** ________________________________

**Votre Role:**
- [ ] Agent
- [ ] Supervisor
- [ ] Admin
- [ ] User

---

## 🌐 URLS À UTILISER

### 1. EventDetails (PC/Desktop)
```
https://security-guard-web.onrender.com/events/3edc204a-93f8-4a58-972d-6cd022c5a35f
```

### 2. CheckIn (Téléphone)
```
https://security-guard-web.onrender.com/checkin
```

### 3. Render Dashboard
```
https://dashboard.render.com
```

---

## ✅ ÉTAPE 1: VÉRIFIER DÉPLOIEMENT RENDER

**Temps:** _____ h _____ (après 5 min du push)

### Frontend (security-guard-web)

- [ ] Aller sur https://dashboard.render.com
- [ ] Cliquer sur service **"security-guard-web"**
- [ ] Onglet **"Events"**
- [ ] Dernier deploy affiché: **"Deploy triggered by push to main"**
- [ ] Commit SHA: **26a8687** ✅
- [ ] Status: **Live** ✅
- [ ] Heure de déploiement: _____ h _____

### Backend (security-guard-backend)

- [ ] Cliquer sur service **"security-guard-backend"**
- [ ] Onglet **"Events"**
- [ ] Dernier deploy affiché: **"Deploy triggered by push to main"**
- [ ] Commit SHA: **26a8687** ✅ (peut être différent mais récent)
- [ ] Status: **Live** ✅
- [ ] Heure de déploiement: _____ h _____

**Screenshot pris:**
- [ ] Oui (fichier: ___________________________)
- [ ] Non

---

## 💻 ÉTAPE 2: EVENTDETAILS (PC)

**Temps:** _____ h _____

### Actions préliminaires

1. [ ] Ouvrir Chrome/Firefox/Edge
2. [ ] Aller sur: https://security-guard-web.onrender.com/events/3edc204a-93f8-4a58-972d-6cd022c5a35f
3. [ ] Appuyer sur **F12** pour ouvrir DevTools
4. [ ] Cliquer sur onglet **"Console"**
5. [ ] Appuyer sur **CTRL + SHIFT + R** (hard refresh)

### Logs Socket.IO attendus

Copier-coller les logs exacts ci-dessous:

**Log 1 - Connexion:**
```
Copier ici le log qui commence par "🔌 Socket.IO connecté pour suivi temps réel"


```

**Log 2 - Joining room:**
```
Copier ici le log qui commence par "🚪 Joining rooms pour eventId"


```

**EventId détecté dans les logs:** ________________________________

- [ ] L'eventId est bien `3edc204a-93f8-4a58-972d-6cd022c5a35f`

### Positions GPS reçues

Attendre 10 secondes et chercher dans la console:

**Log 3 - Position GPS (copier le PREMIER qui apparaît):**
```
Copier ici le log qui commence par "📍 Position GPS reçue (tracking:position_update)"




```

**Informations extraites:**
- [ ] userId visible: ________________________________
- [ ] latitude visible: ________________________________
- [ ] longitude visible: ________________________________
- [ ] batteryLevel visible: _______ %
- [ ] Timestamp visible: ________________________________

**Fréquence de réception:**
- [ ] Aucune position reçue ❌
- [ ] 1 position toutes les 5-10 secondes ✅
- [ ] Positions irrégulières ⚠️

**Screenshot console pris:**
- [ ] Oui (fichier: ___________________________)
- [ ] Non

---

## 📱 ÉTAPE 3: CHECKIN (TÉLÉPHONE)

**Temps:** _____ h _____

### Actions préliminaires

1. [ ] Fermer complètement l'application navigateur (tuer l'app)
2. [ ] Rouvrir le navigateur
3. [ ] Aller sur: https://security-guard-web.onrender.com/checkin
4. [ ] Se connecter avec CIN: ________________________________

### Interface CheckIn visible

- [ ] Onglet "Info" visible
- [ ] Onglet "Pointage" visible
- [ ] Mon nom affiché en haut: ________________________________
- [ ] Mon rôle affiché: ________________________________
- [ ] Liste d'événements visible: _______ événement(s)

### Événement sélectionné

**Nom de l'événement actif:** ________________________________

- [ ] Événement sélectionné (case cochée verte) ✅
- [ ] Carte visible avec ma position
- [ ] Distance au site affichée: _______ mètres

### Debug Console Mobile (optionnel mais recommandé)

**Option A - Chrome Remote Debugging:**
1. [ ] Connecter téléphone en USB
2. [ ] PC → Chrome → `chrome://inspect`
3. [ ] Sélectionner votre appareil
4. [ ] Cliquer sur "Inspect" sous la page CheckIn

**Option B - Safari (iOS):**
1. [ ] iPhone → Réglages → Safari → Avancé → Inspecteur web (ON)
2. [ ] Mac → Safari → Développement → [Votre iPhone] → CheckIn

**Logs Console CheckIn attendus:**

**Log 1 - Tentative connexion:**
```
Copier ici le log "🔗 Tentative de connexion Socket.IO" avec userId et eventId


```

**Log 2 - Authentification:**
```
Copier ici le log "🔐 Authentification Socket.IO avec eventId"


```

**Log 3 - Position envoyée:**
```
Copier ici le log "📍 Position GPS envoyée"


```

**EventId détecté:** ________________________________

- [ ] L'eventId est bien `3edc204a-93f8-4a58-972d-6cd022c5a35f`

**Fréquence d'envoi:**
- [ ] Aucune position envoyée ❌
- [ ] 1 position toutes les 5-10 secondes ✅
- [ ] Positions irrégulières ⚠️

**Screenshot téléphone pris:**
- [ ] Oui (fichier: ___________________________)
- [ ] Non

---

## 🖥️ ÉTAPE 4: LOGS BACKEND RENDER

**Temps:** _____ h _____

### Accéder aux logs

1. [ ] Render Dashboard → Service **"security-guard-backend"**
2. [ ] Onglet **"Logs"**
3. [ ] Scroll jusqu'en bas (logs les plus récents)

### Chercher les logs (CTRL+F dans la page)

**Requête 1:** Chercher "Authentification Socket.IO"

**Résultat copié:**
```
Copier ici la ligne complète qui contient "🔐 Authentification Socket.IO: { userId: '...', role: '...', eventId: '...' }"




```

**EventId détecté:** ________________________________

- [ ] L'eventId est bien `3edc204a-93f8-4a58-972d-6cd022c5a35f`

---

**Requête 2:** Chercher "REÇU location-update"

**Résultat copié:**
```
Copier ici la ligne complète "📥 REÇU location-update: { socketId: '...', data: { userId: '...', lat: ..., lng: ... } }"




```

---

**Requête 3:** Chercher "BROADCAST position vers room"

**Résultat copié:**
```
Copier ici la ligne "📡 BROADCAST position vers room: event:3edc204a-... { userId: '...', lat: ..., lng: ... }"




```

**Room broadcastée:** ________________________________

- [ ] La room est bien `event:3edc204a-93f8-4a58-972d-6cd022c5a35f`

**Fréquence de broadcast:**
- [ ] Aucun broadcast visible ❌
- [ ] 1 broadcast toutes les 5-10 secondes ✅
- [ ] Broadcasts irréguliers ⚠️

**Screenshot Render Logs pris:**
- [ ] Oui (fichier: ___________________________)
- [ ] Non

---

## 🎯 ÉTAPE 5: INTERFACE EVENTDETAILS

**Temps:** _____ h _____

### Banner en haut de page

**Texte affiché dans le banner:**
```
Copier exactement le texte du banner ici:




```

- [ ] Banner visible
- [ ] Texte contient "Suivi Temps Réel Actif" ou "En ligne"
- [ ] Nombre d'agents affiché: _______ agent(s)
- [ ] Dernière sync affichée: Il y a _______ secondes

**Couleur du banner:**
- [ ] Vert (actif) ✅
- [ ] Gris (inactif) ❌
- [ ] Autre: ________________________________

---

### Table des agents

**Ligne pour votre agent visible:**

| Colonne | Valeur affichée | ✓ |
|---------|----------------|---|
| Nom | ________________________________ | [ ] |
| Statut | ________________________________ | [ ] |
| Position GPS | ________________________________ | [ ] |
| Batterie | _______ % | [ ] |
| Dernière activité | ________________________________ | [ ] |

**Statut correct:**
- [ ] ✅ En ligne (vert)
- [ ] ❌ Hors ligne (gris)
- [ ] ⚠️ Autre: ________________________________

---

### Carte (Map)

**Marqueur visible:**
- [ ] OUI - Marqueur visible sur la carte ✅
- [ ] NON - Aucun marqueur visible ❌

**Si OUI, couleur du marqueur:**
- [ ] 🟢 Vert (en ligne)
- [ ] 🔴 Rouge (hors ligne)
- [ ] 🟡 Jaune (autre)
- [ ] Autre: ________________________________

**Position du marqueur:**
- [ ] Correspond à ma position réelle (environ)
- [ ] Totalement ailleurs
- [ ] Ne peut pas vérifier

**Le marqueur bouge quand je me déplace?**
- [ ] OUI - Marqueur se met à jour en temps réel ✅
- [ ] NON - Marqueur fixe ❌
- [ ] Ne peut pas tester (pas bougé)

**Zoom de la carte:**
- [ ] Centré sur mon marqueur
- [ ] Trop dézoomé
- [ ] Trop zoomé
- [ ] Autre: ________________________________

**Screenshot carte pris:**
- [ ] Oui (fichier: ___________________________)
- [ ] Non

---

## 📊 RÉSUMÉ DES RÉSULTATS

### ✅ SUCCÈS (tout fonctionne)

- [ ] EventDetails reçoit les positions GPS toutes les 5s
- [ ] CheckIn envoie les positions GPS toutes les 5s
- [ ] Backend broadcaste vers la bonne room
- [ ] Carte affiche le marqueur en temps réel
- [ ] Table affiche "En ligne" avec coordonnées GPS

**Si tout est coché ci-dessus: 🎉 TRACKING GPS FONCTIONNE!**

---

### ⚠️ PROBLÈMES DÉTECTÉS

Cocher les problèmes rencontrés:

- [ ] EventId manquant dans logs CheckIn
- [ ] EventId manquant dans logs Backend
- [ ] EventDetails ne reçoit aucune position
- [ ] CheckIn n'envoie aucune position
- [ ] Backend rejette les positions (non authentifié)
- [ ] Marqueur absent sur la carte
- [ ] Marqueur ne bouge pas en temps réel
- [ ] Banner gris (pas actif)
- [ ] Agent marqué "Hors ligne"
- [ ] Autre: ________________________________

---

### 🔍 PROBLÈME PRINCIPAL IDENTIFIÉ

**Description du problème en 1 phrase:**

```
Écrire ici le problème principal rencontré:




```

**Error visible dans console?**

```
Copier ici l'erreur complète si visible:




```

---

## 📸 SCREENSHOTS À FOURNIR (si problème)

Liste des fichiers screenshots:

1. [ ] **render-frontend.png** - Render Events frontend (commit 26a8687 Live)
2. [ ] **render-backend.png** - Render Events backend (commit récent Live)
3. [ ] **console-eventdetails.png** - Console EventDetails avec logs Socket.IO
4. [ ] **console-checkin.png** - Console CheckIn avec logs Socket.IO (remote debug)
5. [ ] **logs-backend.png** - Logs Render Backend (100 dernières lignes)
6. [ ] **carte-eventdetails.png** - Carte EventDetails avec/sans marqueur
7. [ ] **table-eventdetails.png** - Table des agents EventDetails

---

## 🚀 ACTIONS SUIVANTES

### Si tout fonctionne ✅

- [ ] Prendre screenshots de succès (carte avec marqueur qui bouge)
- [ ] Tester déplacement réel (marcher 50m et vérifier carte)
- [ ] Tester avec plusieurs agents (si possible)
- [ ] Marquer comme résolu

**Commentaires supplémentaires:**
```




```

---

### Si problème persiste ❌

- [ ] Vérifier que tous les screenshots sont pris
- [ ] Copier tous les logs demandés ci-dessus
- [ ] Noter l'heure exacte de chaque test
- [ ] Envoyer tous les fichiers + ce formulaire rempli

**Prochaine étape de debug:**
```
Écrire ici ce qu'il faudrait vérifier ensuite:




```

---

## ✍️ NOTES ADDITIONNELLES

```
Espace libre pour notes, observations, ou comportements inattendus:










```

---

**Formulaire rempli par:** ________________________________

**Date de complétion:** _____ / _____ / 2026 à _____ h _____

**Temps total de test:** _______ minutes

**Résultat global:**
- [ ] ✅ Succès total
- [ ] ⚠️ Succès partiel
- [ ] ❌ Échec - problème majeur
