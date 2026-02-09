# 🚀 AMÉLIORATIONS TEMPS RÉEL - EVENTDETAILS ↔️ CHECKIN

## 📅 Date: 9 février 2026
## 🎯 Objectif: Synchronisation parfaite temps réel mobile

---

## 📊 ÉTAT ACTUEL ANALYSÉ

### ✅ CE QUI FONCTIONNE DÉJÀ:

#### EventDetails.jsx (Admin Dashboard)
```javascript
// Ligne 56-166: Socket.IO configuré
- ✅ Connexion Socket.IO établie
- ✅ Réception tracking:position_update
- ✅ Gestion online/offline agents
- ✅ Calcul distance Haversine (ligne 169-182)
- ✅ Vérification périmètre (ligne 185-198)
- ✅ Affichage batterie (ligne 750-761)
- ✅ Badge "Dans zone" / "Hors zone" (ligne 763-776)
- ✅ Indicateur connexion temps réel (ligne 702-704)
- ✅ Carte interactive MiniMap (ligne 583-591)
```

#### CheckIn.jsx (Agent Mobile)
```javascript
// Ligne 717-794: GPS Watch configuré
- ✅ watchPosition avec enableHighAccuracy
- ✅ Envoi positions via syncService.sendPosition()
- ✅ Tracking actif après check-in
- ✅ Arrêt automatique après check-out
```

---

## ❌ MANQUES PAR RAPPORT AU CAHIER DES CHARGES

### 🔴 PRIORITÉ CRITIQUE:

#### 1. **Intervalle GPS strict 5 secondes**

**PROBLÈME:**
```javascript
// CheckIn.jsx ligne 758-767 - ACTUEL
watchId = navigator.geolocation.watchPosition(
  sendPosition,
  (error) => console.error('❌ Erreur GPS tracking:', error),
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0  // ⚠️ Intervalle VARIABLE selon appareil
  }
);
```

**PROBLÈME:** `watchPosition` envoie à intervalle **VARIABLE** (1s à 60s selon appareil).

**SOLUTION:** Combiner watchPosition + setInterval fixe 5s
```javascript
// NOUVEAU CODE PROPOSÉ
let lastPosition = null;
let intervalId = null;
let watchId = null;

// 1. Watch position natif (mise à jour variable)
watchId = navigator.geolocation.watchPosition(
  (position) => {
    lastPosition = position; // Stocker dernière position
  },
  (error) => console.error('GPS error:', error),
  { enableHighAccuracy: true, maximumAge: 0 }
);

// 2. Envoi FIXE toutes les 5 secondes
const sendGPS = async () => {
  if (!lastPosition) return;

  const battery = await navigator.getBattery();

  const positionData = {
    userId: user.id,
    role: user.role,
    eventId: selectedEventId,
    latitude: lastPosition.coords.latitude,
    longitude: lastPosition.coords.longitude,
    accuracy: lastPosition.coords.accuracy,
    speed: lastPosition.coords.speed || 0,
    battery: {
      level: Math.round(battery.level * 100),
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime
    },
    timestamp: new Date().toISOString()
  };

  syncService.sendPosition(positionData);
};

intervalId = setInterval(sendGPS, 5000); // ✅ FIXE 5s

// Cleanup
return () => {
  clearInterval(intervalId);
  navigator.geolocation.clearWatch(watchId);
};
```

**IMPACT:**
- ✅ Update précis TOUTES les 5 secondes
- ✅ Visible sur EventDetails en temps réel
- ✅ Latence maximale garantie: 5s

---

#### 2. **Battery API complète avec charging state**

**PROBLÈME:**
```javascript
// CheckIn.jsx ligne 736-745 - ACTUEL
const positionData = {
  // ... coordonnées ...
  // ❌ PAS de données batterie
};
```

**SOLUTION:** Intégrer Battery API complète
```javascript
// Récupérer état batterie complet
const battery = await navigator.getBattery();

const batteryData = {
  level: Math.round(battery.level * 100),      // 0-100%
  charging: battery.charging,                  // true/false
  chargingTime: battery.chargingTime,          // Secondes restantes
  dischargingTime: battery.dischargingTime     // Autonomie restante
};

// EventDetails.jsx - AFFICHAGE AMÉLIORÉ
const getBatteryIcon = (level, charging) => {
  if (charging) return <FiBatteryCharging className="text-green-500 animate-pulse" />;
  if (level > 80) return <FiBattery className="text-green-500" />;
  if (level > 50) return <FiBattery className="text-blue-500" />;
  if (level > 20) return <FiBattery className="text-yellow-500" />;
  return <FiBattery className="text-red-500 animate-pulse" />; // CRITIQUE
};

// Badge batterie enrichi
<div className="flex items-center gap-1">
  {getBatteryIcon(location.battery.level, location.battery.charging)}
  <span className={getBatteryColor(location.battery.level)}>
    {location.battery.level}%
  </span>
  {location.battery.charging && (
    <span className="text-xs text-green-600">⚡ En charge</span>
  )}
  {!location.battery.charging && location.battery.dischargingTime && (
    <span className="text-xs text-gray-500">
      ({Math.round(location.battery.dischargingTime / 60)}min)
    </span>
  )}
</div>
```

**IMPACT:**
- ✅ Voir si agent en charge
- ✅ Autonomie restante affichée
- ✅ Alerte batterie < 20%

---

#### 3. **Détection + Alerte sortie périmètre AVANT fin événement**

**PROBLÈME:**
```javascript
// EventDetails.jsx ligne 763-776 - ACTUEL
{inPerimeter ? (
  <span className="bg-green-100 text-green-700">Dans zone</span>
) : (
  <span className="bg-red-100 text-red-700 animate-pulse">Hors zone</span>
)}
// ❌ Badge affiché MAIS pas d'alerte automatique!
```

**SOLUTION:** Détecter + créer incident automatiquement

**Backend - websocket.js:**
```javascript
socket.on('tracking:gps_update', async (data) => {
  const { userId, eventId, latitude, longitude, accuracy, battery } = data;

  // 1. Récupérer événement
  const event = await Event.findByPk(eventId);
  if (!event) return;

  // 2. Calculer distance
  const distance = calculateDistance(
    parseFloat(event.latitude),
    parseFloat(event.longitude),
    latitude,
    longitude
  );

  const isInPerimeter = distance <= (parseFloat(event.radius) || 1000);

  // 3. Sauvegarder position
  await GPSTracking.create({
    userId,
    eventId,
    latitude,
    longitude,
    accuracy,
    battery: battery.level,
    charging: battery.charging,
    distance,
    isInPerimeter
  });

  // 4. ⚠️ DÉTECTER SORTIE PÉRIMÈTRE
  const now = new Date();
  const eventEnd = new Date(event.endDate + ' ' + event.checkOutTime);

  // SI hors périmètre AVANT la fin de l'événement
  if (!isInPerimeter && now < eventEnd) {
    console.log('🚨 ALERTE: Agent hors périmètre avant fin événement!');

    // 4.1. Créer incident automatique
    const incident = await Incident.create({
      type: 'sortie_perimetre',
      severity: 'high',
      eventId,
      userId,
      latitude,
      longitude,
      distance,
      description: `Agent ${user.firstName} ${user.lastName} sorti du périmètre autorisé (${Math.round(distance)}m du centre)`,
      createdAt: now,
      status: 'open'
    });

    // 4.2. Broadcast ALERTE vers EventDetails (admin)
    io.to(`event:${eventId}`).emit('alert:perimeter_breach', {
      type: 'sortie_perimetre',
      severity: 'high',
      agentId: userId,
      agentName: `${user.firstName} ${user.lastName}`,
      eventId,
      eventName: event.name,
      distance: Math.round(distance),
      maxDistance: parseFloat(event.radius),
      latitude,
      longitude,
      timestamp: now,
      incidentId: incident.id
    });

    // 4.3. Notifier le responsable (si assigné)
    if (event.supervisorId) {
      io.to(`user:${event.supervisorId}`).emit('notification:alert', {
        title: '🚨 Sortie de périmètre',
        message: `${user.firstName} ${user.lastName} hors zone (${Math.round(distance)}m)`,
        eventId,
        type: 'perimeter_breach',
        severity: 'high'
      });
    }

    // 4.4. Notifier l'agent lui-même
    io.to(`user:${userId}`).emit('notification:warning', {
      title: '⚠️ Vous êtes hors périmètre',
      message: `Veuillez retourner dans la zone autorisée (${event.radius}m du centre)`,
      distance: Math.round(distance)
    });
  }

  // 5. Broadcast position normale (tous les agents)
  io.to(`event:${eventId}`).emit('tracking:position_update', {
    userId,
    latitude,
    longitude,
    accuracy,
    batteryLevel: battery.level,
    batteryCharging: battery.charging,
    distance,
    isInPerimeter,
    timestamp: now
  });

  // 6. ACK au client
  socket.emit('tracking:ack', { success: true, timestamp: now });
});
```

**Frontend - EventDetails.jsx:**
```javascript
// Écouter les alertes de sortie périmètre
socketRef.current.on('alert:perimeter_breach', (data) => {
  console.log('🚨 ALERTE SORTIE PÉRIMÈTRE:', data);

  // Notification browser
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🚨 Sortie de périmètre', {
      body: `${data.agentName} hors zone (${data.distance}m)`,
      icon: '/alert-icon.png',
      tag: `perimeter-${data.incidentId}`,
      requireInteraction: true
    });
  }

  // Toast urgent
  toast.error(
    <div>
      <strong>🚨 SORTIE DE PÉRIMÈTRE</strong><br/>
      <span>{data.agentName}</span><br/>
      <span className="text-xs">Distance: {data.distance}m / {data.maxDistance}m autorisés</span>
    </div>,
    {
      position: 'top-center',
      autoClose: false, // Ne se ferme pas automatiquement
      closeButton: true,
      className: 'bg-red-600 text-white'
    }
  );

  // Jouer son d'alerte (si disponible)
  try {
    const audio = new Audio('/sounds/alert-urgent.mp3');
    audio.play();
  } catch (e) {
    console.warn('Son non disponible');
  }

  // Marquer visuellement l'agent dans le tableau
  setAgentLocations(prev => ({
    ...prev,
    [data.agentId]: {
      ...prev[data.agentId],
      perimeterBreach: true,
      perimeterBreachTimestamp: new Date()
    }
  }));
});
```

**Frontend - CheckIn.jsx:**
```javascript
// Écouter les alertes pour l'agent
syncService.on('notification:warning', (data) => {
  console.log('⚠️ NOTIFICATION:', data);

  // Afficher alerte visuelle proéminente
  toast.warning(
    <div className="text-center p-2">
      <strong className="text-xl">⚠️ {data.title}</strong><br/>
      <span className="text-lg">{data.message}</span><br/>
      <span className="text-sm text-red-600 font-bold">
        Distance: {data.distance}m
      </span>
    </div>,
    {
      position: 'top-center',
      autoClose: 10000,
      className: 'bg-orange-100 border-2 border-orange-500'
    }
  );

  // Vibration mobile (si supporté)
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }

  // Badge HORS PÉRIMÈTRE visible
  setPerimeterStatus('outside'); // Nouveau state
});
```

**IMPACT:**
- ✅ Détection automatique sortie périmètre
- ✅ Incident créé en BDD
- ✅ Admin alerté immédiatement
- ✅ Responsable notifié
- ✅ Agent averti (retourner dans zone)
- ✅ Traçabilité complète

---

#### 4. **Trail de déplacement (historique positions)**

**PROBLÈME:**
```javascript
// EventDetails.jsx - ACTUEL
// ❌ Affiche seulement position ACTUELLE
<MiniMap
  agentLocations={agentLocations} // { agentId: { lat, lng, battery } }
/>
```

**SOLUTION:** Stocker historique + afficher trail

**Backend - Stocker historique:**
```javascript
// models/GPSTracking.js (déjà existant ou créer)
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('GPSTracking', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false },
    eventId: { type: DataTypes.UUID, allowNull: false },
    latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
    longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: false },
    accuracy: DataTypes.FLOAT,
    speed: DataTypes.FLOAT,
    batteryLevel: DataTypes.INTEGER,
    batteryCharging: DataTypes.BOOLEAN,
    distance: DataTypes.FLOAT, // Distance vs centre événement
    isInPerimeter: DataTypes.BOOLEAN,
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });
};
```

**Frontend - EventDetails.jsx:**
```javascript
// État pour stocker trails
const [agentTrails, setAgentTrails] = useState({}); // { agentId: [pos1, pos2, ...] }

// Mise à jour lors position_update
socketRef.current.on('tracking:position_update', (data) => {
  const newPos = { lat: data.latitude, lng: data.longitude, timestamp: new Date() };

  // Ajouter à l'historique (garder 50 dernières positions max)
  setAgentTrails(prev => {
    const trail = prev[data.userId] || [];
    const updatedTrail = [...trail, newPos].slice(-50); // Max 50 points

    return {
      ...prev,
      [data.userId]: updatedTrail
    };
  });
});

// Passer trails à MiniMap
<MiniMap
  agentLocations={agentLocations}
  agentTrails={agentTrails} // NOUVEAU
/>
```

**Frontend - MiniMap.jsx (ou créer AgentTrail component):**
```javascript
// Afficher polyline trail pour chaque agent
{Object.entries(agentTrails).map(([agentId, trail]) => (
  <Polyline
    key={`trail-${agentId}`}
    positions={trail.map(p => [p.lat, p.lng])}
    color="#3B82F6"
    weight={3}
    opacity={0.6}
    dashArray="5, 10" // Ligne pointillée
  >
    <Tooltip>
      Trail de déplacement - {trail.length} positions
    </Tooltip>
  </Polyline>
))}
```

**IMPACT:**
- ✅ Voir le chemin parcouru par chaque agent
- ✅ Analyser les déplacements
- ✅ Identifier les zones fréquentées
- ✅ Historique visuel jusqu'à 50 points

---

#### 5. **Notifications Browser natives**

**SOLUTION:** Demander permission + afficher notifications

**CheckIn.jsx - Demander permission au démarrage:**
```javascript
useEffect(() => {
  // Demander permission notifications
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('✅ Notifications autorisées');
      }
    });
  }
}, []);
```

**EventDetails.jsx - Afficher notification:**
```javascript
socketRef.current.on('alert:perimeter_breach', (data) => {
  // Notification browser
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('🚨 Sortie de périmètre', {
      body: `${data.agentName} hors zone (${data.distance}m)`,
      icon: '/alert-icon.png',
      badge: '/badge.png',
      tag: `perimeter-${data.incidentId}`,
      requireInteraction: true, // Ne disparaît pas automatiquement
      vibrate: [200, 100, 200],
      actions: [
        { action: 'view', title: 'Voir détails', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Ignorer', icon: '/icons/dismiss.png' }
      ]
    });

    notification.onclick = () => {
      window.focus();
      // Centrer carte sur agent
      focusOnAgent(data.agentId);
    };
  }
});
```

**IMPACT:**
- ✅ Notifications même si onglet en arrière-plan
- ✅ Alertes critiques visibles immédiatement
- ✅ Actions rapides (voir détails)

---

#### 6. **Buffer local + Resync automatique**

**PROBLÈME:** Si connexion perdue, positions sont perdues.

**SOLUTION:** Buffer local avec IndexedDB

**CheckIn.jsx:**
```javascript
// Buffer local pour positions hors ligne
const positionBuffer = useRef([]);
const [isOffline, setIsOffline] = useState(false);

// Détecter connexion/déconnexion
useEffect(() => {
  const handleOnline = () => {
    console.log('🌐 Connexion rétablie');
    setIsOffline(false);
    resyncBufferedPositions();
  };

  const handleOffline = () => {
    console.log('📶 Connexion perdue - Mode hors ligne');
    setIsOffline(true);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

// Envoi position avec buffer
const sendGPS = async () => {
  if (!lastPosition) return;

  const positionData = { /* ... */ };

  // Si en ligne
  if (navigator.onLine && !isOffline) {
    try {
      syncService.sendPosition(positionData);
    } catch (error) {
      // Si erreur réseau, buffer
      positionBuffer.current.push(positionData);
    }
  } else {
    // Hors ligne: buffer local
    positionBuffer.current.push(positionData);
    console.log('📦 Position bufferisée:', positionBuffer.current.length);
  }
};

// Resync après reconnexion
const resyncBufferedPositions = async () => {
  if (positionBuffer.current.length === 0) return;

  console.log('🔄 Resync de', positionBuffer.current.length, 'positions');

  try {
    // Envoyer en batch
    await syncService.sendBatchPositions(positionBuffer.current);

    toast.success(`✅ ${positionBuffer.current.length} positions synchronisées`);
    positionBuffer.current = [];
  } catch (error) {
    console.error('Erreur resync:', error);
  }
};
```

**Backend - syncService.js:**
```javascript
// Nouveau endpoint pour batch
sendBatchPositions(positions) {
  if (!this.socket || !this.socket.connected) {
    throw new Error('Socket not connected');
  }

  this.socket.emit('tracking:batch_update', {
    positions,
    userId: this.userId,
    timestamp: new Date().toISOString()
  });
}
```

**IMPACT:**
- ✅ Aucune perte de positions
- ✅ Resync automatique
- ✅ Traçabilité complète même hors ligne

---

## 📊 RÉCAPITULATIF AMÉLIORATIONS

| # | Amélioration | Impact | Priorité |
|---|-------------|--------|----------|
| 1 | Intervalle GPS fixe 5s | Update précis temps réel | 🔴 CRITIQUE |
| 2 | Battery API complète | Alertes batterie faible | 🔴 CRITIQUE |
| 3 | Alerte sortie périmètre + incident auto | Sécurité opérationnelle | 🔴 CRITIQUE |
| 4 | Trail déplacement | Analyse trajectoires | 🟡 HAUTE |
| 5 | Notifications browser | Alertes en arrière-plan | 🟡 HAUTE |
| 6 | Buffer local + resync | Pas de perte données | 🟡 HAUTE |

---

## 🚀 PLAN D'IMPLÉMENTATION

### Phase 1: Core Tracking (2-3h)
1. ✅ Modifier CheckIn.jsx: setInterval 5s + Battery API
2. ✅ Backend: handler tracking:gps_update enrichi
3. ✅ EventDetails: affichage batterie + charging state

### Phase 2: Alertes (2h)
4. ✅ Backend: détection sortie périmètre + incident auto
5. ✅ Socket broadcast alert:perimeter_breach
6. ✅ EventDetails: réception + notification
7. ✅ CheckIn: alerte visuelle agent

### Phase 3: UX Avancé (2h)
8. ✅ Trail historique positions
9. ✅ Notifications browser
10. ✅ Buffer local + resync

### Phase 4: Optimisations Mobile (1h)
11. ✅ Réduction fréquence si batterie < 20% (15s au lieu de 5s)
12. ✅ Compression données
13. ✅ Gestion réseau instable

---

## ✅ VALIDATION FINALE

**Critères de succès:**

- [ ] Position mise à jour TOUTES les 5 secondes (visible EventDetails)
- [ ] Batterie + charging state affichés
- [ ] Si agent sort du périmètre AVANT fin → alerte immédiate
- [ ] Incident créé automatiquement
- [ ] Admin + responsable notifiés
- [ ] Agent reçoit avertissement
- [ ] Trail de 50 dernières positions visible
- [ ] Notifications browser actives
- [ ] Buffer local fonctionne (test hors ligne)
- [ ] Resync automatique après reconnexion

---

**Créé par:** Claude Code Senior Full Stack
**Date:** 9 février 2026
**Status:** ⏳ EN ATTENTE VALIDATION POUR DÉMARRER
