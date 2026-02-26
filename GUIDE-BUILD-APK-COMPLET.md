# 📱 Guide Complet — Application Mobile Android (APK)
## Security Guard Mobile — React Native + Expo

---

## 1. CHOIX TECHNIQUE : POURQUOI REACT NATIVE + EXPO ?

| Critère | React Native + Expo | Capacitor (WebView) | Flutter | PWA → APK |
|---------|---------------------|---------------------|---------|-----------|
| **Performance** | ✅ Native | ⚠️ WebView | ✅ Native | ❌ Web |
| **Réutilisation code** | ✅ 90% du JS | ✅ 100% HTML/CSS | ❌ Réécriture | ✅ 100% |
| **Accès caméra/GPS** | ✅ Native | ✅ Via plugins | ✅ Native | ⚠️ Limité |
| **Expérience mobile** | ✅ Fluide | ⚠️ Scroll hybride | ✅ Fluide | ❌ Browser |
| **Coût** | Gratuit | Gratuit | Gratuit | Gratuit |
| **Backend existant** | ✅ Aucune modif | ✅ Aucune modif | ⚠️ Adapter API | ✅ Aucune modif |
| **Google Play** | ✅ APK + AAB | ✅ APK + AAB | ✅ APK + AAB | ⚠️ Limité |

**👉 Choix retenu : React Native + Expo**
- Réutilise toute la logique API existante (même endpoints REST)
- Accès natif caméra (FaceDetector), GPS background, notifications push
- Compatible avec le backend Render + MySQL Railway sans aucune modification

---

## 2. ARCHITECTURE TECHNIQUE

```
┌─────────────────────────────────────────────────────────┐
│                  App Mobile Android                      │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐ │
│  │  Auth (JWT)  │  │  GPS Track  │  │  Notifications │ │
│  │  SecureStore │  │  Background │  │  Push (Expo)   │ │
│  └──────────────┘  └─────────────┘  └────────────────┘ │
│                         │                               │
│              ┌──────────▼──────────┐                    │
│              │   axios + Socket.IO │                    │
│              └──────────┬──────────┘                    │
└─────────────────────────┼───────────────────────────────┘
                          │ HTTPS
                          ▼
            ┌─────────────────────────┐
            │  Backend Render         │
            │  Node.js / Express      │
            │  https://security-guard │
            │  -backend.onrender.com  │
            └─────────────┬───────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │  MySQL — Railway        │
            │  Base de données        │
            └─────────────────────────┘
```

---

## 3. STRUCTURE DU PROJET MOBILE

```
mobile-app/
├── App.js                        # Point d'entrée — navigation + socket + GPS
├── app.json                      # Config Expo (nom, icons, permissions Android)
├── eas.json                      # Profiles de build (debug / preview / production)
├── credentials.json              # Keystore signing local
├── security-guard.jks            # Keystore Android signé
├── android/                      # Code natif Android (généré par expo prebuild)
│   ├── app/
│   │   ├── build.gradle          # Config Gradle + signing
│   │   └── src/
│   └── gradle.properties         # Variables Gradle + keystore passwords
├── assets/
│   ├── icon.png                  # Icône de l'app (1024x1024)
│   ├── adaptive-icon.png         # Icône adaptative Android
│   └── splash.png                # Écran de démarrage
└── src/
    ├── navigation/
    │   └── AppNavigator.js       # Navigation complète avec badges
    ├── screens/
    │   ├── LoginScreen.js        # Login email/password + CIN
    │   ├── HomeScreen.js         # Dashboard — statut du jour + actions
    │   ├── CheckInScreen.js      # Pointage arrivée — caméra + GPS + géofence
    │   ├── CheckOutScreen.js     # Pointage départ — caméra + résumé
    │   ├── HistoryScreen.js      # Historique pointages + stats
    │   ├── NotificationsScreen.js# Notifications + badge non lus
    │   ├── ProfileScreen.js      # Profil + préférences + avatar
    │   ├── IncidentReportScreen.js# Rapport d'incident — photo + GPS + type
    │   └── EventDetailScreen.js  # Détail événement + actions contextuelles
    └── services/
        ├── api.js                # Axios + intercepteurs JWT refresh
        ├── authStore.js          # Store Zustand — auth + mode pointage CIN
        ├── backgroundLocationTask.js # Tâche GPS background (écran éteint)
        ├── socketService.js      # Socket.IO temps réel
        ├── trackingService.js    # Tracking GPS continu
        └── useTracking.js        # Hook React pour le tracking
```

---

## 4. FONCTIONNALITÉS IMPLÉMENTÉES

### ✅ Authentification
- Login par email/mot de passe (admin, supervisor)
- Login par CIN (agents) → mode pointage simplifié
- JWT access token + refresh token chiffré (expo-secure-store)
- Refresh automatique sur 401
- Persistance de session (checkAuth au démarrage)

### ✅ Pointage
- Camera native avec détection de visage (expo-face-detector)
- Géolocalisation GPS haute précision
- Vérification géofence (rayon configurable par événement)
- Photo capturée + envoi base64 au backend
- Pointage arrivée + départ

### ✅ GPS Background
- Tracking continu même écran éteint (expo-task-manager)
- File d'attente offline → synchronisation au retour réseau
- Envoi via Socket.IO + REST API

### ✅ Notifications Push
- expo-notifications configuré
- Badge de compteur non-lus
- Marquer comme lu / tout marquer

### ✅ Rapport d'incident
- Photo (caméra ou galerie)
- Géolocalisation + adresse
- Types d'incidents multiples
- Niveaux de sévérité (faible → critique)

### ✅ Permissions Android configurées
```
CAMERA, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION,
ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE,
FOREGROUND_SERVICE_LOCATION, VIBRATE
```

---

## 5. BUILD APK — MÉTHODES

### Méthode A — Local avec Gradle (recommandé, sans compte Expo)

**Prérequis :**
- Node.js 18+
- JDK 17 (via Android Studio ou https://adoptium.net)
- Android Studio avec SDK Android 34

```powershell
# APK Debug (test rapide sur téléphone)
.\BUILD-APK-LOCAL.ps1

# APK Release signé (distribution externe)
.\BUILD-APK-LOCAL.ps1 -Release

# AAB Release (Google Play Store)
.\BUILD-APK-LOCAL.ps1 -Bundle

# Avec nettoyage complet
.\BUILD-APK-LOCAL.ps1 -Release -Clean
```

**Résultat :**
- `security-guard-debug.apk` — installable directement (test)
- `security-guard-release.apk` — signé avec production keystore
- `security-guard.aab` — bundle Google Play

### Méthode B — EAS Build (cloud Expo, sans Android Studio)

```powershell
# Via le script existant (nécessite un compte expo.dev gratuit)
.\BUILD-APK.ps1
```

```bash
# Commandes EAS manuelles
cd mobile-app
npm install -g eas-cli
eas login

# APK de test
eas build --platform android --profile preview

# APK local (sans upload cloud)
eas build --platform android --profile preview-local --local

# AAB production
eas build --platform android --profile production
```

### Méthode C — Commandes Gradle directes

```bash
cd mobile-app/android

# APK Debug
./gradlew assembleDebug

# APK Release signé
./gradlew assembleRelease

# AAB (Google Play)
./gradlew bundleRelease
```

---

## 6. INSTALLER SUR UN TÉLÉPHONE ANDROID

### Option 1 — Via USB (ADB)
```bash
# Activer le débogage USB sur le téléphone
# Paramètres → Options développeur → Débogage USB

adb devices                      # Vérifier la connexion
adb install -r security-guard-debug.apk
# ou
adb install -r security-guard-release.apk
```

### Option 2 — Transfert direct
1. Copier l'APK vers le téléphone (USB, Google Drive, email)
2. Activer "Sources inconnues" dans Paramètres → Sécurité
3. Ouvrir l'APK depuis le gestionnaire de fichiers

### Option 3 — Expo Go (développement uniquement)
```bash
cd mobile-app
npx expo start
# Scanner le QR Code avec l'app Expo Go
```

---

## 7. KEYSTORE & SIGNATURE

Le keystore de production est déjà configuré :

| Paramètre | Valeur |
|-----------|--------|
| Fichier | `mobile-app/security-guard.jks` |
| Mot de passe store | `SecurityGuard2024!` |
| Alias | `securityguard` |
| Mot de passe clé | `SecurityGuard2024!` |

> ⚠️ **IMPORTANT** : Ne jamais committer le fichier `.jks` dans Git public.
> Ajouter `*.jks` et `credentials.json` au `.gitignore`.

### Générer un nouveau keystore (si nécessaire)
```bash
keytool -genkey -v -keystore security-guard.jks \
  -alias securityguard \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass SecurityGuard2024! -keypass SecurityGuard2024!
```

---

## 8. VERSIONING

Éditer `mobile-app/android/app/build.gradle` :

```groovy
defaultConfig {
    versionCode 2       // Incrémenter à chaque publication Play Store
    versionName "1.1.0" // Version affichée aux utilisateurs
}
```

Ou via `app.json` :
```json
{
  "expo": {
    "version": "1.1.0",
    "android": {
      "versionCode": 2
    }
  }
}
```

---

## 9. PUBLICATION GOOGLE PLAY STORE

### Étape 1 — Préparer l'AAB
```powershell
.\BUILD-APK-LOCAL.ps1 -Bundle
# Génère security-guard.aab
```

### Étape 2 — Google Play Console
1. Aller sur https://play.google.com/console
2. Créer une nouvelle app : "Security Guard Mobile"
3. Package : `com.securityguard.mobile`
4. Remplir les informations de la fiche (description, captures d'écran)

### Étape 3 — Publication interne (test)
1. **Tests internes** → Créer une nouvelle version
2. Uploader le fichier `.aab`
3. Inviter les testeurs par email
4. Les testeurs reçoivent le lien d'installation

### Étape 4 — Production
1. **Production** → Créer une version de production
2. Soumettre pour examen (1-3 jours)

---

## 10. VARIABLES D'ENVIRONNEMENT

L'URL du backend est configurée dans `src/services/api.js` :

```javascript
const API_URL = 'https://security-guard-backend.onrender.com/api';
```

Pour un environnement de développement local :
```javascript
const API_URL = __DEV__
  ? 'http://192.168.1.X:5000/api'   // IP locale du PC
  : 'https://security-guard-backend.onrender.com/api';
```

---

## 11. CORS BACKEND

Le backend Render doit accepter les requêtes depuis l'app mobile.
Dans `backend/src/config/` ou `app.js`, vérifier :

```javascript
app.use(cors({
  origin: [
    'https://security-workforce-manager.vercel.app',
    // L'app mobile envoie des requêtes sans origine (null origin)
    // React Native n'envoie pas d'en-tête Origin
  ],
  credentials: true,
}));
```

> React Native (Axios) n'envoie pas d'en-tête `Origin` → les requêtes mobile
> passent naturellement si `cors()` est configuré sans restriction d'origine stricte.

---

## 12. CHECKLIST AVANT PUBLICATION

- [ ] `versionCode` incrémenté dans `build.gradle`
- [ ] `versionName` mis à jour
- [ ] URL API pointe vers la production Render
- [ ] APK/AAB testé sur un vrai téléphone Android
- [ ] Permissions vérifiées (caméra refusée → message clair)
- [ ] Comportement offline testé (file d'attente GPS)
- [ ] Keystore sauvegardé en lieu sûr (hors Git)
- [ ] Screenshots préparés pour la fiche Play Store (1080x1920)
- [ ] Icône 512x512 PNG fond transparent pour Play Store

---

## 13. DÉPANNAGE COURANT

| Problème | Solution |
|----------|----------|
| `JAVA_HOME not set` | Installer JDK 17, définir `JAVA_HOME` |
| `SDK location not found` | Créer `local.properties` avec `sdk.dir=C:\\Users\\...\\Android\\Sdk` |
| `Duplicate class` | `./gradlew clean` puis rebuilder |
| `401 Unauthorized` | Vérifier le refresh token dans SecureStore |
| `Camera permission denied` | Vérifier `app.json` → android.permissions |
| `GPS ne fonctionne pas` | Activer "Localisation précise" dans les paramètres Android |
| `Build trop lent` | Ajouter `org.gradle.parallel=true` dans `gradle.properties` |
| `APK trop volumineux` | Activer `minifyEnabled true` dans `build.gradle` |

---

*Généré le 22 février 2026 — Security Guard Mobile v1.0.0*
