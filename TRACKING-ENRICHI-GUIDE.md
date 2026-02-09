# 📱 SYSTÈME DE TRACKING ENRICHI EN TEMPS RÉEL

## 🎯 Vue d'ensemble

Système complet de tracking GPS avec informations enrichies sur l'appareil, la batterie, le réseau et statistiques en temps réel.

---

## ✨ Nouvelles fonctionnalités

### 🔋 Batterie API Complète

**Avant:**
- ✅ Niveau de batterie uniquement (0-100%)

**Maintenant:**
- ✅ Niveau de batterie (0-100%)
- ✅ État de charge (charging/not charging)
- ✅ Temps jusqu'à charge complète
- ✅ Temps batterie restant
- ✅ Statut batterie (critical, low, medium, good, charging)
- ✅ Estimation temps restant lisible (ex: "2h 30min")

**Exemple données:**
```javascript
{
  batteryLevel: 75,
  batteryCharging: false,
  batteryChargingTime: Infinity,
  batteryDischargingTime: 7200, // 2 heures
  batteryStatus: 'good',
  batteryEstimatedTime: '2h 0min'
}
```

---

### 📶 Réseau - Informations détaillées

**Avant:**
- ✅ Type de réseau basique (wifi, 4g, etc.)

**Maintenant:**
- ✅ Type de connexion (slow-2g, 2g, 3g, 4g, wifi)
- ✅ Vitesse téléchargement (Mbps)
- ✅ Latence réseau (RTT en ms)
- ✅ Mode économie données
- ✅ État online/offline
- ✅ Statut connexion (offline, slow, moderate, fast, excellent)

**Exemple données:**
```javascript
{
  networkType: '4g',
  networkDownlink: 10.5, // Mbps
  networkRtt: 50, // ms
  networkSaveData: false,
  networkOnline: true,
  networkStatus: 'fast'
}
```

---

### 📱 Appareil - Informations système

**Avant:**
- ❌ Aucune information appareil

**Maintenant:**
- ✅ Système d'exploitation (Windows, macOS, Linux, Android, iOS)
- ✅ Navigateur (Chrome, Firefox, Safari, Edge, Opera)
- ✅ Type d'appareil (mobile, tablet, desktop)
- ✅ Plateforme (Win32, MacIntel, iPhone, Android)
- ✅ Langue
- ✅ Nombre de cœurs CPU
- ✅ Mémoire RAM (GB)
- ✅ Résolution écran
- ✅ État écran (allumé/éteint)

**Exemple données:**
```javascript
{
  deviceOS: 'Android',
  deviceBrowser: 'Chrome',
  deviceType: 'mobile',
  devicePlatform: 'Linux armv8l',
  deviceLanguage: 'fr',
  deviceCPUCores: 8,
  deviceMemory: 6,
  deviceScreenResolution: '1080x2400',
  deviceScreenOn: true
}
```

---

### 📊 Statistiques en temps réel

**Nouvelles métriques calculées automatiquement:**

- 📏 **Distance totale parcourue** (en km ou m)
- 🏃 **Distance en mouvement** (filtré du bruit GPS)
- ⏱️ **Temps total actif**
- 🏃 **Temps en mouvement**
- 🛑 **Temps à l'arrêt**
- 🚫 **Temps hors périmètre**
- 📈 **Vitesse moyenne** (km/h)
- ⚡ **Vitesse maximale** (km/h)
- 🔋 **Batterie consommée** (%)
- 📱 **Taux consommation batterie** (%/h)
- 📶 **Nombre changements réseau**
- 🌙 **Temps écran éteint**
- 📍 **Nombre de points GPS**

**Exemple statistiques:**
```javascript
{
  totalDistance: '2.45 km',
  movingDistance: '2.10 km',
  totalTime: '1h 25min',
  movingTime: '45min 30s',
  stoppedTime: '39min 30s',
  averageSpeed: '2.8 km/h',
  maxSpeed: '15.2 km/h',
  batteryConsumed: '12.5%',
  batteryPerHour: '8.8%',
  networkChanges: 3,
  positionsCount: 5432
}
```

---

### 🗺️ Trajet sur carte (Polyline)

- ✅ Affichage du chemin parcouru en temps réel
- ✅ Historique des 1000 derniers points GPS
- ✅ Chaque point contient: lat, lng, batterie, isMoving, timestamp
- ✅ Peut être affiché sur la carte avec Leaflet Polyline

---

### 📍 GPS étendu

**Nouvelles informations GPS:**
- ✅ Altitude (mètres)
- ✅ Précision altitude
- ✅ Direction (heading 0-360°)
- ✅ Vitesse instantanée (m/s et km/h)
- ✅ État mouvement amélioré

---

## 🏗️ Architecture

### Frontend (Web Dashboard)

#### 1. **deviceInfoService.js**
Service principal pour récupérer toutes les infos appareil.

**Méthodes:**
```javascript
// Batterie complète
await deviceInfoService.getBatteryInfo()

// Réseau
deviceInfoService.getNetworkInfo()

// Appareil
deviceInfoService.getDeviceInfo()

// GPS étendu
await deviceInfoService.getGPSExtendedInfo(position)

// Tout en une fois
await deviceInfoService.getAllInfo()

// Monitoring continu avec callback
deviceInfoService.startMonitoring((info) => {
  console.log('Nouvelles infos:', info);
}, 5000); // Toutes les 5 secondes
```

#### 2. **trackingStatsService.js**
Calcul des statistiques en temps réel.

**Méthodes:**
```javascript
// Initialiser agent
trackingStatsService.initializeAgent(userId, initialPosition)

// Mettre à jour position
const stats = trackingStatsService.updatePosition(userId, newPosition)

// Obtenir stats
const stats = trackingStatsService.getStats(userId)

// Obtenir chemin
const path = trackingStatsService.getPath(userId)

// Nettoyer
trackingStatsService.clearAgent(userId)
```

#### 3. **useGPSTracking.js**
Hook React mis à jour avec toutes les infos enrichies.

**Automatiquement envoyé chaque seconde:**
- Position GPS complète
- Batterie complète
- Réseau complet
- Appareil complet
- Stats en temps réel

#### 4. **AgentInfoPanel.jsx + CSS**
Composant React pour afficher toutes les infos.

**Utilisation:**
```jsx
import AgentInfoPanel from '../components/AgentInfoPanel';

<AgentInfoPanel 
  agent={selectedAgent}
  stats={selectedAgent.stats}
  onClose={() => setSelectedAgent(null)}
/>
```

---

### Backend

#### 1. **trackingStatsService.js**
Service backend pour calculer stats (identique au frontend).

#### 2. **gpsTrackingService.js**
Mis à jour pour :
- Utiliser trackingStatsService
- Sauvegarder toutes les nouvelles colonnes
- Émettre stats via Socket.IO

#### 3. **GeoTracking Model**
**Nouvelles colonnes:**

```javascript
// Batterie
battery_charging
battery_charging_time
battery_discharging_time
battery_status
battery_estimated_time

// Réseau
network_downlink
network_rtt
network_save_data
network_online
network_status

// Appareil
device_os
device_browser
device_type
device_platform
device_language
device_cpu_cores
device_memory
device_screen_resolution
device_screen_on

// GPS
is_moving
```

#### 4. **Socket.IO Events**

**Émis par le serveur:**
```javascript
// Position mise à jour (maintenant avec toutes les infos)
'tracking:position_update' -> {
  // Position GPS
  latitude, longitude, accuracy, altitude, speed, heading,
  
  // Batterie complète
  batteryLevel, batteryCharging, batteryStatus, batteryEstimatedTime,
  
  // Réseau
  networkType, networkStatus, networkOnline, networkDownlink, networkRtt,
  
  // Appareil
  deviceOS, deviceBrowser, deviceType, deviceScreenOn,
  
  // Statistiques
  stats: { totalDistance, averageSpeed, ... },
  
  // Chemin parcouru
  path: [{ lat, lng, timestamp, ... }],
  
  // Utilisateur
  user: { ... }
}

// Agent terminé (avec stats finales)
'tracking:agent_stopped' -> {
  userId,
  timestamp,
  finalStats: { ... },
  path: [...]
}
```

---

## 🚀 Installation et déploiement

### 1. Migration base de données

**Ajouter les nouvelles colonnes:**
```bash
cd backend
node src/migrations/add-enriched-tracking-columns.js
```

**Résultat:**
```
🚀 Démarrage migration...
📝 Ajout de 21 nouvelles colonnes...
   ➕ Ajout colonne: battery_charging
   ➕ Ajout colonne: battery_charging_time
   ...
✅ Toutes les colonnes ont été ajoutées!
🎉 Migration terminée!
```

### 2. Vérifier que les services sont utilisés

**Backend (déjà fait dans le code):**
- ✅ gpsTrackingService utilise trackingStatsService
- ✅ Toutes les colonnes sont sauvegardées
- ✅ Socket.IO émet toutes les données

**Frontend (déjà fait dans le code):**
- ✅ useGPSTracking utilise deviceInfoService
- ✅ Envoie toutes les infos enrichies
- ✅ AgentInfoPanel affiche tout

### 3. Tester

**Simulation GPS:**
```bash
node simulate-gps-tracking-socketio.js
```

**Vérifier dans les logs:**
```
📤 Envoi position enrichie: {
  coords: '34.053100, -6.798500',
  battery: '85% (good)',
  network: '4g (fast)',
  device: 'Android - Chrome',
  screenOn: true
}
```

---

## 📊 Exemple d'utilisation complète

### Frontend - Afficher infos agent

```jsx
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import AgentInfoPanel from '../components/AgentInfoPanel';

function RealTimeTracking() {
  const [agents, setAgents] = useState({});
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('tracking:position_update', (data) => {
      setAgents(prev => ({
        ...prev,
        [data.userId]: data
      }));
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div>
      {/* Carte avec markers */}
      <MapContainer>
        {Object.values(agents).map(agent => (
          <Marker 
            key={agent.userId}
            position={[agent.latitude, agent.longitude]}
            onClick={() => setSelectedAgent(agent)}
          />
        ))}

        {/* Afficher polyline si agent sélectionné */}
        {selectedAgent?.path && (
          <Polyline 
            positions={selectedAgent.path.map(p => [p.lat, p.lng])}
            color="#667eea"
          />
        )}
      </MapContainer>

      {/* Panneau d'infos */}
      {selectedAgent && (
        <AgentInfoPanel
          agent={selectedAgent}
          stats={selectedAgent.stats}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
```

---

## 📋 Checklist déploiement

- [ ] **1. Exécuter migration**
  ```bash
  node backend/src/migrations/add-enriched-tracking-columns.js
  ```

- [ ] **2. Redémarrer backend**
  ```bash
  cd backend
  npm start
  ```

- [ ] **3. Rebuild frontend**
  ```bash
  cd web-dashboard
  npm run build
  ```

- [ ] **4. Tester avec simulation**
  ```bash
  node simulate-gps-tracking-socketio.js
  ```

- [ ] **5. Vérifier dans dashboard**
  - Ouvrir `/tracking`
  - Cliquer sur un agent
  - Vérifier que le panneau affiche toutes les infos

---

## 🎯 Résultat final

### Ce que voit l'admin/superviseur:

**Sur la carte:**
- 📍 Position en temps réel
- 🗺️ Trajet parcouru (polyline)
- 🎨 Icône agent avec statut (couleur selon batterie, mouvement, etc.)

**Dans le panneau d'infos:**
- **Position GPS**: Lat, Lng, Altitude, Direction, Vitesse
- **Batterie**: Niveau, État charge, Temps restant
- **Réseau**: Type, Vitesse, Latence, État
- **Appareil**: OS, Navigateur, Type, Écran
- **Statistiques**: Distance, Vitesse moy/max, Temps actif, etc.

**En temps réel:**
- ⚡ Mise à jour chaque seconde
- 📊 Stats recalculées automatiquement
- 🔔 Alertes batterie faible
- 🚨 Alertes géofencing

---

## 🔧 API Browser utilisées

| API | Support | Fallback |
|-----|---------|----------|
| Battery API | Chrome, Opera, Edge | Niveau 100% |
| Network Information API | Chrome, Edge, Opera | Type 'unknown' |
| Geolocation API | Tous | ❌ Requis |
| Page Visibility API | Tous | true |
| Navigator properties | Tous | N/A |

---

## 📝 Notes importantes

1. **Battery API** peut ne pas fonctionner sur iOS Safari (retourne toujours 100%)
2. **Network Information API** limité sur Firefox
3. Toutes les infos sont **optionnelles** - le système fonctionne même si certaines APIs ne sont pas disponibles
4. Les **statistiques** sont calculées **côté serveur ET client** pour redondance
5. Le **chemin parcouru** est limité à 1000 points pour ne pas surcharger la mémoire

---

## 🎉 Conclusion

Vous avez maintenant un système de tracking **ultra-complet** qui fournit:

- ✅ 3x plus d'informations qu'avant
- ✅ Statistiques automatiques
- ✅ Visualisation enrichie
- ✅ Alertes intelligentes
- ✅ Historique de trajet
- ✅ Détection état appareil (écran, batterie, réseau)

**Parfait pour:**
- 👮 Surveillance agents terrain
- 📊 Analytics détaillés
- 🚨 Détection problèmes
- 📱 Gestion flotte mobile
