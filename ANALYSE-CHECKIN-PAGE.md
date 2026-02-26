# 📱 ANALYSE COMPLÈTE - PAGE CHECKIN
## https://security-workforce-manager.vercel.app/checkin

---

## 🎯 VUE D'ENSEMBLE

La page CheckIn est une **page de connexion unifiée multi-profils** avec système de pointage en temps réel, tracking GPS automatique, et reconnaissance faciale. Elle sert de point d'entrée pour 3 types d'utilisateurs avec des flux d'authentification différents.

---

## 🧑‍💼 PROFILS UTILISATEURS

### 1️⃣ **Agent de sécurité** (Profil bleu)
- **Méthode connexion** : CIN uniquement
- **Accès** : Écran de pointage mobile
- **Fonctionnalités** :
  - Check-in / Check-out avec reconnaissance faciale
  - Tracking GPS automatique
  - Transmission batterie en temps réel
  - Affectations événements

### 2️⃣ **Responsable/Superviseur** (Profil jaune)
- **Méthode connexion** : CIN uniquement  
- **Accès** : Écran de pointage + supervision
- **Fonctionnalités** :
  - Mêmes que agents
  - Supervision zones/agents
  - Gestion événements assignés

### 3️⃣ **Administrateur** (Profil rouge)
- **Méthode connexion** : Email + Mot de passe
- **Accès** : Tableau de bord complet
- **Fonctionnalités** :
  - Accès complet administration
  - Gestion utilisateurs
  - Configuration système

---

## 🎨 ÉTAPES D'UTILISATION

### **ÉTAPE 1 : Sélection du profil**

Interface affichée au chargement :

```
┌─────────────────────────────────────┐
│     🛡️  Security Guard              │
│     Système de gestion              │
├─────────────────────────────────────┤
│                                     │
│  [🛡️ Agent de sécurité        →]  │
│     Pointage d'entrée et de sortie │
│                                     │
│  [✅ Responsable              →]  │
│     Supervision agents et pointage │
│                                     │
│  [⚙️ Administrateur           →]   │
│     Gestion complète du système    │
│                                     │
└─────────────────────────────────────┘
```

**Actions utilisateur :**
- Clic sur une des 3 cartes → Passage à l'étape 2

---

### **ÉTAPE 2A : Connexion Agent/Responsable (CIN)**

**Interface :**
```
┌─────────────────────────────────────┐
│ ← [🛡️ Agent de sécurité]           │
│    Connexion par CIN                │
├─────────────────────────────────────┤
│                                     │
│  Numéro CIN                         │
│  [💳 AB123456              ✅]     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ✅ Prévisualisation         │   │
│  │ 👤 Mohamed TAZI             │   │
│  │    ID: BK517312             │   │
│  │    ✅ Visage OK             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Accéder au pointage         →]   │
│                                     │
│  Vous serez redirigé vers          │
│  l'écran de pointage               │
└─────────────────────────────────────┘
```

**Fonctionnalités :**

1. **Vérification CIN en temps réel** (debounce 500ms)
   - Après 6 caractères → API appel automatique
   - Affiche prévisualisation utilisateur si trouvé
   - Indicateur vert (✅) si CIN valide

2. **Prévisualisation utilisateur**
   - Photo de profil (ou initiales)
   - Nom complet
   - ID employé
   - Badge "Visage OK" si facial vector configuré
   - Warning si compte inactif
   - Warning si reconnaissance faciale manquante

3. **Validation automatique**
   - Bouton désactivé si :
     - CIN vide
     - Compte inactif
     - En cours de chargement

4. **Gestion erreurs fenêtres temporelles**
   - Code `OUTSIDE_TIME_WINDOW` → Message détaillé avec horaires
   - Code `NO_ASSIGNMENTS` → "Aucune affectation confirmée"
   - Code `NO_FACIAL_VECTOR` → "Reconnaissance faciale non configurée"

---

### **ÉTAPE 2B : Connexion Administrateur (Email)**

**Interface :**
```
┌─────────────────────────────────────┐
│ ← [⚙️ Administrateur]               │
│    Connexion par Email              │
├─────────────────────────────────────┤
│                                     │
│  Email                              │
│  [📧 admin@example.com       ]     │
│                                     │
│  Mot de passe                       │
│  [🔒 ••••••••                ]     │
│                                     │
│  [Accéder au tableau de bord  →]   │
│                                     │
│  Accès complet à l'administration  │
└─────────────────────────────────────┘
```

**Fonctionnalités :**
- Validation email requis
- Validation mot de passe requis
- Authentification JWT
- Redirection vers `/dashboard`

---

## 🔧 FONCTIONNALITÉS TECHNIQUES

### 1️⃣ **TRACKING GPS AUTOMATIQUE**

**Déclenchement :**
- Dès le chargement de la page (useEffect)
- Indépendant de la connexion utilisateur
- Continue tant que la page est ouverte

**Configuration :**
```javascript
navigator.geolocation.getCurrentPosition({
  enableHighAccuracy: true,  // GPS haute précision
  timeout: 10000,             // 10 secondes max
  maximumAge: 0               // Pas de cache
})
```

**Fréquence :**
- Position immédiate au chargement
- Mise à jour toutes les **5 secondes**

**Données GPS transmises :**
```javascript
{
  latitude: 33.5731104,      // Coordonnées GPS
  longitude: -7.5898434,
  accuracy: 20,              // Précision en mètres
  altitude: 50.2,            // Altitude (si disponible)
  speed: 0,                  // Vitesse en m/s
  heading: 180               // Direction (0-360°)
}
```

---

### 2️⃣ **BATTERY API ENRICHIE**

**Informations collectées :**
```javascript
{
  // Niveau batterie
  batteryLevel: 85,                    // 0-100%
  batteryCharging: true,               // En charge ?
  
  // Temps restant
  batteryChargingTime: 1800,           // Secondes jusqu'à 100% (30 min)
  batteryDischargingTime: Infinity,    // Secondes restantes si pas en charge
  
  // État batterie
  batteryStatus: 'charging',           // 'charging', 'discharging', 'full', 'low'
  batteryEstimatedTime: '30 minutes'   // Format lisible
}
```

**Événements écoutés :**
- `levelchange` → Mise à jour automatique du niveau

---

### 3️⃣ **NETWORK INFORMATION API**

**Informations collectées :**
```javascript
{
  // Type de connexion
  networkType: '4g',                // 'slow-2g', '2g', '3g', '4g', 'wifi'
  
  // Performance réseau
  networkDownlink: 10.5,            // Vitesse download en Mbps
  networkRtt: 50,                   // Latence en ms
  
  // Paramètres
  networkSaveData: false,           // Mode économie données ?
  networkOnline: true,              // En ligne ?
  networkStatus: 'excellent'        // 'excellent', 'good', 'fair', 'poor'
}
```

---

### 4️⃣ **DEVICE INFORMATION**

**Informations collectées :**
```javascript
{
  // Système
  deviceOS: 'Windows 10',
  deviceBrowser: 'Chrome 144',
  deviceType: 'desktop',            // 'mobile', 'tablet', 'desktop'
  devicePlatform: 'Win32',
  
  // Matériel
  deviceLanguage: 'fr-FR',
  deviceCPUCores: 8,                // Nombre de cœurs CPU
  deviceMemory: 16,                 // RAM en GB
  
  // Écran
  deviceScreenResolution: '1920x1080',
  deviceScreenOn: true              // Écran allumé ?
}
```

---

### 5️⃣ **SOCKET.IO TEMPS RÉEL**

**Architecture :**

```
┌─────────────────┐
│   CheckIn       │
│   (Frontend)    │
└────────┬────────┘
         │ Socket.IO connect
         │
         ▼
┌─────────────────┐
│   Backend       │
│   Socket.IO     │
└────────┬────────┘
         │ Broadcast
         │
         ▼
┌─────────────────┐
│  EventDetails   │
│  (Dashboard)    │
└─────────────────┘
```

**Événements Socket.IO :**

#### 📤 **Émis par CheckIn :**

1. **`auth`** - Authentification initiale
```javascript
socket.emit('auth', {
  userId: '16792796-...',
  role: 'agent',
  eventId: '3edc204a-...',
  token: 'eyJhbGci...'
})
```

2. **`event:join`** - Rejoindre room événement
```javascript
socket.emit('event:join', eventId)
```

3. **`tracking:subscribe`** - S'abonner au tracking
```javascript
socket.emit('tracking:subscribe', eventId)
```

4. **`location-update`** - Envoyer position GPS (toutes les 5s)
```javascript
socket.emit('location-update', {
  userId: '16792796-...',
  latitude: 33.5731104,
  longitude: -7.5898434,
  accuracy: 20,
  altitude: 50.2,
  speed: 0,
  heading: 180,
  batteryLevel: 85,
  batteryCharging: true,
  networkType: '4g',
  deviceOS: 'Android 10',
  timestamp: '2026-02-08T19:30:45.123Z'
})
```

#### 📥 **Reçus par CheckIn :**

1. **`auth:success`** - Authentification réussie
```javascript
socket.on('auth:success', (data) => {
  console.log('✅ Authentifié:', data);
  setIsSocketAuthenticated(true);
  // Démarrage envoi GPS
})
```

2. **`auth:error`** - Échec authentification
```javascript
socket.on('auth:error', (error) => {
  console.error('❌ Auth error:', error);
  toast.error('Erreur authentification Socket.IO');
})
```

3. **`tracking:position_ack`** - Position confirmée
```javascript
socket.on('tracking:position_ack', (data) => {
  console.log('✅ Position reçue par serveur');
})
```

4. **`tracking:error`** - Erreur tracking
```javascript
socket.on('tracking:error', (error) => {
  console.error('❌ Tracking error:', error);
})
```

5. **`tracking:disabled`** - Tracking désactivé (hors fenêtre)
```javascript
socket.on('tracking:disabled', (data) => {
  console.warn('⏸️ Tracking désactivé:', data.message);
  // Affiche raison: événement pas commencé, événement terminé
})
```

---

### 6️⃣ **AUTHENTIFICATION SOCKET.IO STRICTE**

**Flux d'authentification :**

```
1. Socket.IO connect
2. Émettre 'auth' avec userId/eventId/token
3. Attendre 'auth:success'
4. ✅ setIsSocketAuthenticated(true)
5. Démarrage envoi GPS
```

**Protection :**
```javascript
// sendLocationUpdate vérifie TOUJOURS :
if (!isSocketAuthenticated) {
  console.log('⏳ En attente authentification...');
  return; // ❌ Bloque l'envoi
}
```

**Raison :**
Sans authentification, le backend rejette les positions avec :
```
❌ Socket non authentifié: abc123
```

---

### 7️⃣ **DEVICE FINGERPRINT**

**Objectif :**
Identifier de manière unique un appareil pour détecter connexions multiples.

**Données utilisées :**
```javascript
{
  fingerprint: 'a1b2c3d4e5f6...',  // Hash unique 32 caractères
  browser: 'Chrome 144',
  os: 'Windows 10',
  platform: 'Win32',
  language: 'fr-FR',
  screenResolution: '1920x1080',
  timezone: 'Europe/Paris',
  plugins: ['PDF Viewer', 'Chrome PDF Viewer'],
  canvas: 'canvas_hash_xyz...',
  webgl: 'webgl_renderer_xyz...'
}
```

**Utilisation :**
- Envoyé lors du login CIN
- Stocké en base de données
- Permet détection multi-connexions

---

### 8️⃣ **EFFETS SONORES**

**Fichiers son :**
```javascript
soundEffects = {
  loginStart: 'beep-start.mp3',
  loginSuccess: 'success-chime.mp3',
  loginError: 'error-buzz.mp3',
  checkIn: 'check-in.mp3',
  checkOut: 'check-out.mp3',
  alert: 'alert-notification.mp3'
}
```

**Déclencheurs :**
- **loginStart** → Clic bouton "Accéder au pointage"
- **loginSuccess** → Connexion CIN réussie
- **loginError** → Échec connexion (CIN invalide, compte inactif)

**Configuration :**
```javascript
soundEffects.initialize(); // Au chargement page
soundEffects.playLoginStart(); // Avant API call
soundEffects.playLoginSuccess(); // Après succès
soundEffects.playLoginError(); // Après erreur
```

---

### 9️⃣ **GESTION FENÊTRES TEMPORELLES**

**Règles :**
- Login CIN autorisé **2h avant → fin événement**
- Check-in autorisé **2h avant → fin événement**
- Check-out autorisé **5min avant fin → fin événement**
- Tracking GPS autorisé **2h avant → fin événement**

**Messages d'erreur détaillés :**

#### 🔴 **Avant fenêtre (> 2h avant début) :**
```
Le check-in pour l'événement "WAC VS NLI" sera disponible 
2 heures avant le début, à partir de 14:00 le 08/02/2026.

⏰ Temps restant : 3h 45min
```

#### 🔴 **Après événement :**
```
L'événement "WAC VS NLI" est terminé depuis 12:30 le 08/02/2026.
Le tracking temps réel est désactivé automatiquement.
```

#### 🔴 **Aucune affectation :**
```
Vous n'avez aucune affectation confirmée pour aujourd'hui 
ou dans les 2 prochaines heures.

Contactez votre superviseur pour obtenir une affectation.
```

---

### 🔟 **STOCKAGE LOCAL**

**LocalStorage clés utilisées :**

```javascript
localStorage.setItem('checkInToken', token);        // JWT token
localStorage.setItem('token', token);               // Alias
localStorage.setItem('accessToken', token);         // Alias
localStorage.setItem('checkInUser', JSON.stringify(user));  // User data
localStorage.setItem('validEvents', JSON.stringify(events)); // Events list
```

**Données utilisateur stockées :**
```javascript
{
  id: '16792796-73b4-4156-a722-7f89a0898162',
  firstName: 'Youssef',
  lastName: 'ALAMI',
  email: 'youssef@example.com',
  cin: 'BK517312',
  role: 'supervisor',
  employeeId: 'EMP001',
  profilePhoto: 'https://...',
  phone: '+212600000000',
  isActive: true,
  hasFacialVector: true
}
```

**Événements valides stockés :**
```javascript
[
  {
    id: '3edc204a-93f8-4a58-972d-6cd022c5a35f',
    name: 'WAC VS NLI',
    startDate: '2026-02-08T16:00:00.000Z',
    endDate: '2026-02-08T20:00:00.000Z',
    location: 'Stade Mohammed V',
    status: 'confirmed',
    zones: [
      { id: 'zone1', name: 'Zone A', radius: 100 }
    ]
  }
]
```

---

## 🎨 DESIGN & UI/UX

### **Couleurs par profil :**

| Profil | Couleur | Classes Tailwind |
|--------|---------|------------------|
| Agent | Bleu | `bg-blue-50`, `text-blue-600`, `border-blue-500` |
| Responsable | Jaune | `bg-yellow-50`, `text-yellow-600`, `border-yellow-500` |
| Admin | Rouge | `bg-red-50`, `text-red-600`, `border-red-500` |

### **États visuels :**

1. **Carte profil non sélectionnée :**
   - Border transparente
   - Background `bg-blue-50` (selon profil)
   - Hover : Border colorée + background plus foncé

2. **Carte profil sélectionnée :**
   - Border colorée épaisse (2px)
   - Background `bg-blue-100`
   - Icône dans cercle blanc avec ombre

3. **Input CIN :**
   - Avec icône CreditCard à gauche
   - Checkmark vert à droite si CIN valide
   - Font mono, uppercase automatique
   - Focus : Border primary + ring

4. **Prévisualisation utilisateur :**
   - Border verte si compte actif
   - Photo ronde ou initiales
   - Badges : "Visage OK" (vert), "Compte inactif" (rouge)

5. **Messages erreur :**
   - Background rouge clair
   - Icône AlertCircle
   - Texte rouge foncé
   - Message détaillé avec instructions

---

## 📱 RESPONSIVE DESIGN

**Breakpoints :**
- Mobile : < 640px → Carte pleine largeur
- Tablet : 640px-1024px → Carte centrée (max-w-md)
- Desktop : > 1024px → Carte centrée (max-w-md)

**Adaptations mobiles :**
- Inputs plus larges (py-4)
- Touch-friendly buttons
- Fonts plus grandes
- Espacement généreux

---

## 🔐 SÉCURITÉ

### **1. Validation côté client :**
- CIN requis (min 6 caractères)
- Email format valide
- Mot de passe requis

### **2. Tokens JWT :**
- Token stocké dans localStorage
- Envoyé dans header Authorization
- Expiration 7 jours
- Refresh automatique

### **3. Device Fingerprint :**
- Hash unique par appareil
- Détection connexions multiples
- Protection contre usurpation

### **4. Authentification Socket.IO :**
- Token JWT requis
- Validation userId
- Rooms isolées par événement
- Position rejetée si non authentifié

---

## 🛠️ TECHNOLOGIES UTILISÉES

### **Frontend :**
- React 18.2
- React Router DOM 6.21
- Socket.IO Client 4.8.1
- React Icons (Feather Icons)
- React Toastify (Notifications)
- Tailwind CSS 3.4
- Zustand (State management)

### **APIs Navigateur :**
- Geolocation API (GPS)
- Battery Status API
- Network Information API
- Navigator API (Device info)

### **Backend :**
- Node.js + Express
- Socket.IO Server
- JWT Authentication
- MySQL/Sequelize

---

## 📊 FLUX DE DONNÉES COMPLET

```
┌────────────────────────────────────────────────────────────┐
│                     CHECKIN PAGE LOAD                       │
└──────────────────┬─────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌─────────────┐       ┌─────────────┐
│ Device Info │       │ GPS Tracking│
│ Collection  │       │ Start       │
└──────┬──────┘       └──────┬──────┘
       │                     │
       │                     │ Every 5s
       ▼                     ▼
┌─────────────────────────────────┐
│    USER SELECTS PROFILE         │
└──────────────┬──────────────────┘
               │
     ┌─────────┴──────────┐
     │                    │
     ▼                    ▼
┌──────────┐       ┌──────────────┐
│ CIN Form │       │ Email Form   │
└────┬─────┘       └──────┬───────┘
     │                    │
     │ Input CIN          │ Submit
     │ (6+ chars)         │
     ▼                    ▼
┌──────────────┐   ┌──────────────┐
│ Verify CIN   │   │ Email Login  │
│ API Call     │   │ API Call     │
└──────┬───────┘   └──────┬───────┘
       │                  │
       │ Success          │ Success
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ Show Preview │   │ Store Token  │
│ User Info    │   │ Redirect     │
└──────┬───────┘   │ /dashboard   │
       │           └──────────────┘
       │ Submit
       ▼
┌────────────────────────────────────┐
│   LOGIN CIN API CALL               │
│   - deviceFingerprint              │
│   - deviceInfo (all data)          │
│   - userType (agent/supervisor)    │
└──────────────┬─────────────────────┘
               │
               │ Success
               ▼
┌────────────────────────────────────┐
│   RECEIVE RESPONSE                 │
│   - user (full data)               │
│   - checkInToken (JWT)             │
│   - validEvents (array)            │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│   STORE IN LOCALSTORAGE            │
│   - checkInToken                   │
│   - checkInUser                    │
│   - validEvents                    │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│   UPDATE ZUSTAND STORE             │
│   setAuthenticatedUser(user,token) │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│   INITIALIZE SOCKET.IO             │
│   - Connect to backend             │
│   - Emit 'auth' event              │
│   - Emit 'event:join'              │
│   - Emit 'tracking:subscribe'      │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│   WAIT AUTH:SUCCESS                │
│   setIsSocketAuthenticated(true)   │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│   START GPS TRANSMISSION           │
│   Every 5s emit 'location-update'  │
│   - GPS (lat/lng/accuracy)         │
│   - Battery (level/charging/time)  │
│   - Network (type/speed/rtt)       │
│   - Device (os/browser/memory)     │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│   BACKEND RECEIVES & BROADCASTS    │
│   to room: event:{eventId}         │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│   EVENTDETAILS PAGE RECEIVES       │
│   Updates table with real-time pos │
└────────────────────────────────────┘
```

---

## 🎯 PROMPT COMPLET - REPRODUCTION EXACTE

```markdown
# PROMPT SYSTÈME - PAGE CHECKIN UNIFIÉE

## CONTEXTE
Créer une page de connexion unifiée pour 3 types d'utilisateurs avec tracking GPS temps réel, Battery API enrichie, et authentification Socket.IO stricte.

## SPÉCIFICATIONS TECHNIQUES

### 1. PROFILS UTILISATEURS
- **Agent** : CIN → /checkin (bleu)
- **Responsable** : CIN → /checkin (jaune)
- **Admin** : Email/Password → /dashboard (rouge)

### 2. ÉTAPES UI
1. Sélection profil (3 cartes cliquables)
2. Formulaire connexion (CIN ou Email selon profil)

### 3. TRACKING GPS AUTOMATIQUE
- Démarrage au chargement page (useEffect)
- Mise à jour toutes les 5 secondes
- enableHighAccuracy: true
- Transmission seulement si isSocketAuthenticated

### 4. BATTERY API ENRICHIE
```javascript
{
  level: 85,                           // %
  charging: true,                      // Boolean
  chargingTime: 1800,                  // Secondes
  dischargingTime: Infinity,
  status: 'charging',                  // Estado
  estimatedTimeRemaining: '30 minutes' // Formatted
}
```

### 5. NETWORK INFORMATION API
```javascript
{
  type: '4g',                // Tipo conexión
  downlink: 10.5,            // Mbps
  rtt: 50,                   // ms latencia
  saveData: false,           // Data saver
  online: true,              // Estado
  status: 'excellent'        // Rating
}
```

### 6. DEVICE INFO COMPLET
```javascript
{
  os: 'Windows 10',
  browser: 'Chrome 144',
  type: 'desktop',
  platform: 'Win32',
  language: 'fr-FR',
  cpuCores: 8,
  memory: 16,                // GB
  screenResolution: '1920x1080',
  screenOn: true
}
```

### 7. SOCKET.IO FLUX
```
1. connect
2. emit('auth', {userId, eventId, token})
3. Wait 'auth:success'
4. setIsSocketAuthenticated(true)
5. emit('location-update') every 5s avec TOUTES infos enrichies
```

### 8. VÉRIFICATION CIN TEMPS RÉEL
- Après 6 caractères
- Debounce 500ms
- API verifyCin
- Affiche prévisualisation utilisateur
- Badge "Visage OK" si hasFacialVector

### 9. GESTION ERREURS FENÊTRE TEMPORELLE
- OUTSIDE_TIME_WINDOW → Message détaillé avec horaires
- NO_ASSIGNMENTS → "Aucune affectation"
- NO_FACIAL_VECTOR → "Reconnaissance non configurée"

### 10. EFFETS SONORES
- loginStart → Clic bouton
- loginSuccess → Après succès API
- loginError → Après erreur API

### 11. LOCALSTORAGE
Stocker:
- checkInToken (JWT)
- checkInUser (objet complet)
- validEvents (array événements)

### 12. ZUSTAND STORE
Appeler setAuthenticatedUser(user, token) après login CIN

### 13. REDIRECTION
- CIN success → /checkin
- Email success → /dashboard

## DESIGN TAILWIND

### Carte profil
- bg-{color}-50 hover:bg-{color}-100
- border-2 border-transparent hover:border-{color}-300
- Selected: bg-{color}-100 border-{color}-500

### Input CIN
- pl-12 pr-12 py-4 (icône gauche + check droite)
- font-mono tracking-wider uppercase
- focus:border-primary-500 focus:ring-2

### Prévisualisation
- bg-green-50 border-green-200
- Photo ronde 12x12
- Badges status

### Messages erreur
- bg-red-50 border-red-200
- text-red-700
- Icône AlertCircle

## COMPOSANTS REQUIS
```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiCreditCard, FiArrowRight, FiAlertCircle, FiCheck, FiShield, FiLock, FiMail, FiArrowLeft, FiUsers, FiUserCheck, FiSettings } from 'react-icons/fi';
import io from 'socket.io-client';
import { authAPI } from '../services/api';
import useAuthStore from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { getDeviceFingerprint, getDeviceInfo } from '../utils/deviceFingerprint';
import deviceInfoService from '../services/deviceInfoService';
import soundEffects from '../utils/soundEffects';
```

## ÉTATS REACT
```jsx
const [step, setStep] = useState('select');
const [profileType, setProfileType] = useState(null);
const [cin, setCin] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [userPreview, setUserPreview] = useState(null);
const [deviceInfo, setDeviceInfo] = useState(null);
const [currentLocation, setCurrentLocation] = useState(null);
const [batteryLevel, setBatteryLevel] = useState(null);
const [isSocketAuthenticated, setIsSocketAuthenticated] = useState(false);
```

## REFS
```jsx
const socketRef = useRef(null);
const locationIntervalRef = useRef(null);
```

## FONCTION CRITIQUE: sendLocationUpdate
```javascript
const sendLocationUpdate = async (location) => {
  const user = JSON.parse(localStorage.getItem('checkInUser') || '{}');
  
  // Vérifications
  if (!user.id) return;
  if (!socketRef.current || !socketRef.current.connected) return;
  
  // CRITIQUE: Vérifier authentification
  if (!isSocketAuthenticated) {
    console.log('⏳ En attente authentification Socket.IO...');
    return;
  }
  
  // Collecter TOUTES les infos enrichies
  const enrichedInfo = await deviceInfoService.getAllInfo();
  
  const data = {
    userId: user.id,
    latitude, longitude, accuracy, altitude, speed, heading,
    batteryLevel: enrichedInfo.battery?.level,
    batteryCharging: enrichedInfo.battery?.charging,
    batteryChargingTime: enrichedInfo.battery?.chargingTime,
    batteryDischargingTime: enrichedInfo.battery?.dischargingTime,
    batteryStatus: enrichedInfo.battery?.status,
    batteryEstimatedTime: enrichedInfo.battery?.estimatedTimeRemaining,
    networkType: enrichedInfo.network?.type,
    networkDownlink: enrichedInfo.network?.downlink,
    networkRtt: enrichedInfo.network?.rtt,
    networkSaveData: enrichedInfo.network?.saveData,
    networkOnline: enrichedInfo.network?.online,
    networkStatus: enrichedInfo.network?.status,
    deviceOS: enrichedInfo.device?.os,
    deviceBrowser: enrichedInfo.device?.browser,
    deviceType: enrichedInfo.device?.type,
    devicePlatform: enrichedInfo.device?.platform,
    deviceLanguage: enrichedInfo.device?.language,
    deviceCPUCores: enrichedInfo.device?.cpuCores,
    deviceMemory: enrichedInfo.device?.memory,
    deviceScreenResolution: enrichedInfo.device?.screenResolution,
    deviceScreenOn: enrichedInfo.device?.screenOn,
    timestamp: new Date().toISOString()
  };
  
  socketRef.current.emit('location-update', data);
};
```

## VALIDATION REQUISE
- [ ] GPS démarre automatiquement au chargement
- [ ] Battery API complète collectée
- [ ] Network Info complète collectée
- [ ] Device Info complet collecté
- [ ] Socket.IO authentifié AVANT envoi GPS
- [ ] CIN vérifié en temps réel après 6 chars
- [ ] Prévisualisation utilisateur affichée
- [ ] Erreurs fenêtre temporelle gérées avec messages détaillés
- [ ] Sons joués aux bons moments
- [ ] LocalStorage correctement rempli
- [ ] Zustand store mis à jour
- [ ] Redirection correcte selon profil
- [ ] Design Tailwind respecté (couleurs par profil)
- [ ] Responsive mobile-first
- [ ] Logs console détaillés pour debug

## ENDPOINTS API
```javascript
// Vérification CIN
POST /api/auth/verify-cin
Body: { cin: 'AB123456' }
Response: { success: true, data: { user, hasFacialVector, isActive } }

// Login CIN
POST /api/auth/login-cin
Body: { 
  cin: 'AB123456', 
  deviceFingerprint: 'abc123',
  deviceInfo: {...},
  userType: 'agent' | 'supervisor'
}
Response: { 
  success: true, 
  data: { 
    user: {...}, 
    checkInToken: 'JWT...', 
    validEvents: [...] 
  } 
}

// Login Email
POST /api/auth/login
Body: { email, password }
Response: { success: true, data: { user, token } }
```

## LOGS CONSOLE REQUIS
```javascript
console.log('🔌 Socket.IO connecté pour tracking GPS');
console.log('✅ Authentification Socket.IO réussie:', data);
console.log('🚀 Démarrage envoi GPS après authentification...');
console.log('📍 Position envoyée via Socket.IO:', { userId, lat, lng, battery, authenticated });
console.log('⏳ En attente authentification Socket.IO...');
console.log('❌ Erreur auth Socket.IO:', error);
```

---

FIN DU PROMPT - Toutes fonctionnalités documentées
```

---

## 📝 RÉSUMÉ EXÉCUTIF

**Fonctionnalités principales :**
1. ✅ Connexion multi-profils (Agent/Responsable/Admin)
2. ✅ Tracking GPS automatique toutes les 5 secondes
3. ✅ Battery API enrichie (niveau, temps restant, état)
4. ✅ Network Information API (type, vitesse, latence)
5. ✅ Device Info complet (OS, navigateur, mémoire, écran)
6. ✅ Socket.IO temps réel avec authentification stricte
7. ✅ Vérification CIN en temps réel
8. ✅ Prévisualisation utilisateur avec photo
9. ✅ Gestion fenêtres temporelles (2h avant → fin)
10. ✅ Effets sonores (login start/success/error)
11. ✅ Device Fingerprint unique
12. ✅ Messages d'erreur détaillés avec horaires

**Technologies :**
- React 18.2, Socket.IO Client 4.8.1, Tailwind CSS 3.4
- APIs: Geolocation, Battery, Network Information, Navigator

**URLs Production :**
- Vercel : https://security-workforce-manager.vercel.app/checkin
- Render : https://security-guard-web.onrender.com/checkin

---

📄 **Document généré le** : 08/02/2026  
🔗 **Source** : `web-dashboard/src/pages/CheckInLogin.jsx` (839 lignes)  
📊 **Nombre de fonctionnalités** : 13 majeures  
⚡ **Version** : 2.0 (avec Battery/Network enrichis)
