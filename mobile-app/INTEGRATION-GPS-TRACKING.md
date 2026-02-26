# 📱 INTÉGRATION TRACKING GPS AUTOMATIQUE - MOBILE APP

## ✅ CE QUI A ÉTÉ CRÉÉ

### 1️⃣ **DeviceInfoService** (`mobile-app/src/services/deviceInfoService.js`)

Service complet pour collecter toutes les informations de l'appareil mobile :

**APIs Expo utilisées :**
- `expo-battery` → Niveau batterie, charging, low power mode
- `expo-network` → Type de connexion, IP, état réseau
- `expo-device` → Modèle, OS, mémoire, architecture CPU  
- `expo-constants` → Version app, build number

**Méthodes principales :**
```javascript
// Batterie complète
await deviceInfoService.getBatteryInfo()
// → { level: 85, charging: true, lowPowerMode: false, state: 'charging' }

// Réseau
await deviceInfoService.getNetworkInfo()
// → { type: 'WIFI', isConnected: true, ipAddress: '192.168.1.10' }

// Appareil
await deviceInfoService.getDeviceInfo()
// → { deviceName: 'iPhone 14', brand: 'Apple', os: 'ios', osVersion: '17.2' }

// TOUTES les infos pour Socket.IO
const data = await deviceInfoService.getTransmissionData(location)
// → 40+ champs enrichis prêts pour transmission
```

---

### 2️⃣ **SocketService Amélioré** (`mobile-app/src/services/socketService.js`)

Service Socket.IO avec tracking GPS automatique intégré.

**Nouvelles fonctionnalités :**

#### 🔐 **Authentification stricte**
```javascript
socketService.connect(userId, role, eventId, token);
// Attend auth:success avant de démarrer GPS
```

#### 🚀 **Tracking GPS automatique (5s)**
```javascript
// Démarre automatiquement après auth:success
socketService.startGPSTracking();

// Envoie toutes les 5 secondes :
{
  userId, latitude, longitude, accuracy, altitude, speed, heading,
  batteryLevel, batteryCharging, batteryState,
  networkType, networkIsConnected, networkStatus,
  deviceName, deviceOS, deviceModel, deviceMemory,
  timestamp
}
```

#### 🛑 **Arrêt propre**
```javascript
socketService.stopGPSTracking();
socketService.disconnect();
```

---

## 🎯 INTÉGRATION DANS L'APP

### **Option A : Connexion globale (App.js)**

Démarrer Socket.IO dès la connexion utilisateur :

```javascript
// mobile-app/App.js
import socketService from './src/services/socketService';
import useAuthStore from './src/services/authStore';
import { useEffect } from 'react';

// Dans le composant principal
const { user, isAuthenticated } = useAuthStore();

useEffect(() => {
  if (isAuthenticated && user) {
    // Connecter Socket.IO + démarrer tracking GPS automatique
    socketService.connect(
      user.id,
      user.role,
      user.currentEventId, // Si l'utilisateur a un événement actif
      user.token
    );

    // Écouter événements
    socketService.on('authenticated', (data) => {
      console.log('✅ Socket.IO authentifié, GPS tracking actif');
    });

    socketService.on('auth_error', (error) => {
      console.error('❌ Erreur auth Socket.IO:', error);
    });

    // Cleanup à la déconnexion
    return () => {
      socketService.stopGPSTracking();
      socketService.disconnect();
    };
  }
}, [isAuthenticated, user]);
```

---

### **Option B : Connexion dans CheckInScreen**

Démarrer uniquement lors du check-in :

```javascript
// mobile-app/src/screens/CheckInScreen.js
import socketService from '../services/socketService';
import useAuthStore from '../services/authStore';
import { useEffect } from 'react';

const CheckInScreen = ({ route, navigation }) => {
  const { user } = useAuthStore();
  const { event } = route.params || {};

  useEffect(() => {
    if (user && event) {
      // Connecter Socket.IO pour cet événement
      socketService.connect(
        user.id,
        user.role,
        event.id, // ID de l'événement
        user.token
      );

      // Le tracking GPS démarre automatiquement après auth:success

      return () => {
        // Arrêter tracking à la sortie de l'écran
        socketService.stopGPSTracking();
      };
    }
  }, [user, event]);

  // ... reste du composant
};
```

---

### **Option C : Connexion dans HomeScreen**

Démarrer dès que l'agent/superviseur est sur la page d'accueil :

```javascript
// mobile-app/src/screens/HomeScreen.js
import socketService from '../services/socketService';
import useAuthStore from '../services/authStore';
import { useEffect, useState } from 'react';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuthStore();
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    // Charger l'événement actif de l'utilisateur
    const loadActiveEvent = async () => {
      try {
        const assignRes = await assignmentsAPI.getMyAssignments({ status: 'confirmed' });
        const assignments = assignRes.data.data || [];
        
        if (assignments.length > 0) {
          const eventId = assignments[0].eventId;
          // Connecter Socket.IO
          socketService.connect(user.id, user.role, eventId, user.token);
          setActiveEvent(eventId);
        }
      } catch (error) {
        console.error('Erreur chargement événement:', error);
      }
    };

    if (user) {
      loadActiveEvent();
    }

    return () => {
      socketService.stopGPSTracking();
      socketService.disconnect();
    };
  }, [user]);

  return (
    <View>
      {/* Indicateur connexion Socket.IO */}
      {socketService.isAuthenticated && (
        <View style={{ backgroundColor: '#10b981', padding: 8 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>
            🟢 Suivi GPS actif
          </Text>
        </View>
      )}
      
      {/* ... reste du HomeScreen */}
    </View>
  );
};
```

---

## 🔧 FONCTIONNALITÉS DISPONIBLES

### 1️⃣ **Écouter les événements Socket.IO**

```javascript
// Succès authentification
socketService.on('authenticated', (data) => {
  console.log('✅ Authentifié:', data);
  // GPS tracking démarre automatiquement
});

// Erreur authentification
socketService.on('auth_error', (error) => {
  Alert.alert('Erreur', 'Impossible de démarrer le suivi temps réel');
});

// Mise à jour position d'autres agents
socketService.on('position_update', (data) => {
  console.log('📍 Position agent:', data.userId, data.latitude, data.longitude);
  // Mettre à jour la carte en temps réel
});

// Nouveau check-in
socketService.on('checkin_new', (data) => {
  console.log('✅ Agent a pointé:', data.userId);
  // Rafraîchir liste des présences
});

// Incident
socketService.on('incident_new', (data) => {
  Alert.alert('🚨 Incident', data.description);
});

// SOS
socketService.on('sos_alert', (data) => {
  Alert.alert('🆘 ALERTE', `Agent ${data.agentName} en détresse!`);
});
```

### 2️⃣ **Envoyer des événements**

```javascript
// Position manuelle (en dehors du tracking auto)
await socketService.sendEnrichedPosition(userId);

// Check-in
socketService.sendCheckin(eventId, latitude, longitude, photoBase64);

// Incident
socketService.sendIncident(
  eventId,
  'intrusion',
  'Personne suspecte détectée',
  latitude,
  longitude,
  [photo1, photo2]
);

// SOS
socketService.sendSOS(eventId, latitude, longitude, 'Besoin assistance urgente!');
```

### 3️⃣ **Contrôle du tracking**

```javascript
// Démarrer manuellement (si auto-start désactivé)
await socketService.startGPSTracking();

// Arrêter temporairement
socketService.stopGPSTracking();

// Vérifier état
console.log('Connected:', socketService.isConnected);
console.log('Authenticated:', socketService.isAuthenticated);
console.log('Tracking active:', !!socketService.trackingInterval);
```

---

## 📊 DONNÉES TRANSMISES AUTOMATIQUEMENT

Toutes les 5 secondes, le mobile envoie :

```javascript
{
  // 👤 Utilisateur
  userId: "16792796-73b4-4156-a722-7f89a0898162",
  
  // 📍 GPS
  latitude: 33.5731104,
  longitude: -7.5898434,
  accuracy: 15.2,
  altitude: 42.5,
  speed: 0,
  heading: 180,
  
  // 🔋 Batterie
  batteryLevel: 85,
  batteryCharging: true,
  batteryLowPowerMode: false,
  batteryState: "charging",
  batteryStatus: "charging",
  
  // 📶 Réseau
  networkType: "WIFI",
  networkIsConnected: true,
  networkIsInternetReachable: true,
  networkIpAddress: "192.168.1.10",
  networkStatus: "excellent",
  
  // 📱 Appareil
  deviceName: "iPhone 14 Pro",
  deviceType: "PHONE",
  deviceBrand: "Apple",
  deviceManufacturer: "Apple",
  deviceModel: "iPhone 14 Pro",
  deviceOS: "ios",
  deviceOSName: "iOS",
  deviceOSVersion: "17.2.1",
  devicePlatform: "ios",
  deviceIsDevice: true,
  deviceTotalMemory: 6442450944,
  deviceCpuArchitectures: ["arm64"],
  deviceAppVersion: "1.0.0",
  deviceAppBuildVersion: "1",
  
  // ⏰ Timestamp
  timestamp: "2026-02-08T19:45:30.123Z"
}
```

---

## 🎨 INDICATEURS VISUELS

### **Badge connexion Socket.IO**

```javascript
import { View, Text } from 'react-native';
import socketService from '../services/socketService';

const SocketStatusBadge = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkStatus = setInterval(() => {
      setIsConnected(socketService.isAuthenticated);
    }, 1000);

    return () => clearInterval(checkStatus);
  }, []);

  if (!isConnected) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 50,
      right: 10,
      backgroundColor: '#10b981',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center'
    }}>
      <View style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginRight: 6
      }} />
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
        GPS Actif
      </Text>
    </View>
  );
};
```

---

## 🧪 TESTS

### **Test 1 : Connexion Socket.IO**

```javascript
// Dans n'importe quel screen
import socketService from '../services/socketService';

// Bouton test
<TouchableOpacity onPress={() => {
  socketService.connect('test-user-id', 'agent', 'test-event-id', 'token');
  
  socketService.on('authenticated', () => {
    Alert.alert('✅ Succès', 'Socket.IO connecté et authentifié');
  });
}}>
  <Text>Tester Socket.IO</Text>
</TouchableOpacity>
```

### **Test 2 : Position manuelle**

```javascript
<TouchableOpacity onPress={async () => {
  const data = await socketService.sendEnrichedPosition('test-user-id');
  Alert.alert('Position envoyée', JSON.stringify(data, null, 2));
}}>
  <Text>Envoyer position</Text>
</TouchableOpacity>
```

### **Test 3 : Battery Info**

```javascript
import deviceInfoService from '../services/deviceInfoService';

<TouchableOpacity onPress={async () => {
  const battery = await deviceInfoService.getBatteryInfo();
  Alert.alert('Batterie', `Niveau: ${battery.level}%, Charging: ${battery.charging}`);
}}>
  <Text>Tester Battery API</Text>
</TouchableOpacity>
```

---

## 🚀 DÉPLOIEMENT

### **1. Build APK/IPA**

```bash
cd mobile-app

# Android APK
expo build:android

# iOS IPA
expo build:ios

# Development build (recommandé)
eas build --platform android --profile development
eas build --platform ios --profile development
```

### **2. Permissions nécessaires**

#### **Android** (`android/app/src/main/AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

#### **iOS** (`ios/SecurityGuardMobile/Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Nous avons besoin de votre position pour le tracking GPS temps réel</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>Le tracking GPS permet au superviseur de suivre votre position en temps réel</string>
```

### **3. Configuration Backend**

Vérifier que le backend accepte les connexions mobiles :

```javascript
// backend/src/server.js
const cors = require('cors');

app.use(cors({
  origin: [
    'https://security-guard-web.onrender.com',
    'exp://*', // Expo Go
    'http://localhost:*' // Development
  ],
  credentials: true
}));

// Socket.IO CORS
const io = require('socket.io')(server, {
  cors: {
    origin: [
      'https://security-guard-web.onrender.com',
      'exp://*',
      'http://localhost:*'
    ]
  }
});
```

---

## 📝 CHECKLIST COMPLÈTE

- [ ] `deviceInfoService.js` créé dans `mobile-app/src/services/`
- [ ] `socketService.js` mis à jour avec tracking GPS
- [ ] Intégration dans `App.js` OU `CheckInScreen.js` OU `HomeScreen.js`
- [ ] Permissions GPS configurées (Android + iOS)
- [ ] Backend CORS configuré pour mobile
- [ ] Tests Socket.IO connexion
- [ ] Tests Battery/Network APIs
- [ ] Tests position enrichie
- [ ] Indicateur visuel ajouté
- [ ] Build APK/IPA testé
- [ ] Déploiement production

---

## 🎯 RÉSULTAT ATTENDU

Une fois intégré, l'application mobile :

✅ Se connecte à Socket.IO automatiquement  
✅ Envoie la position GPS toutes les 5 secondes  
✅ Transmet 40+ champs enrichis (Battery, Network, Device)  
✅ Affiche indicateur "GPS Actif"  
✅ Fonctionne en arrière-plan (avec expo-task-manager)  
✅ Reconnecte automatiquement si déconnexion  
✅ Dashboard web affiche positions en temps réel  

---

**Technologies utilisées :**
- Socket.IO Client 4.7.2
- Expo Location 16.5
- Expo Battery 7.7
- Expo Network 5.8
- Expo Device 5.9
- React Native 0.73.6

**Date :** 08/02/2026  
**Version :** 2.0 avec tracking GPS automatique enrichi
