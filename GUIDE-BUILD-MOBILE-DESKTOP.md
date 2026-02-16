# 📱💻 GUIDE COMPLET - BUILDS MOBILES & DESKTOP
## Security Workforce Manager - Applications Natives

---

## 📋 TABLE DES MATIÈRES

1. [Applications Mobiles (Android & iOS)](#mobile)
2. [Applications Desktop (Windows, macOS, Linux)](#desktop)
3. [Intégration Bannière Téléchargement](#integration)
4. [Distribution et Déploiement](#distribution)

---

## 📱 1. APPLICATIONS MOBILES <a name="mobile"></a>

### Technologie: Capacitor (Ionic)

Capacitor permet de convertir votre application React en applications natives Android et iOS.

### Installation Capacitor

```bash
cd frontend

# Installer Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios

# Initialiser Capacitor
npx cap init "Security Workforce Manager" "com.securityworkforce.manager" --web-dir=build
```

### Configuration `capacitor.config.json`

```json
{
  "appId": "com.securityworkforce.manager",
  "appName": "Security Workforce Manager",
  "webDir": "build",
  "bundledWebRuntime": false,
  "server": {
    "url": "https://security-workforce-manager.vercel.app",
    "cleartext": true
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#667eea",
      "androidSplashResourceName": "splash",
      "iosSplashResourceName": "Default"
    },
    "Geolocation": {
      "permissions": {
        "location": "always"
      }
    },
    "Camera": {
      "permissions": {
        "camera": "Camera is required for facial recognition"
      }
    },
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    }
  }
}
```

---

## 🤖 BUILD ANDROID APK

### Prérequis

- Android Studio installé
- Java JDK 11 ou supérieur
- Android SDK (API 33+)

### Étapes

#### 1. Build React
```bash
cd frontend
npm run build
```

#### 2. Ajouter la plateforme Android
```bash
npx cap add android
```

#### 3. Synchroniser les fichiers
```bash
npx cap sync android
```

#### 4. Ouvrir dans Android Studio
```bash
npx cap open android
```

#### 5. Configurer le projet

**`android/app/build.gradle`**:
```gradle
android {
    compileSdkVersion 33
    defaultConfig {
        applicationId "com.securityworkforce.manager"
        minSdkVersion 22
        targetSdkVersion 33
        versionCode 1
        versionName "1.0.0"
    }
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
}
```

#### 6. Générer l'APK

##### Option A: Debug APK (pour test)
```bash
cd android
./gradlew assembleDebug
# APK généré: android/app/build/outputs/apk/debug/app-debug.apk
```

##### Option B: Release APK (pour production)

**1. Créer une keystore:**
```bash
keytool -genkey -v -keystore security-manager.keystore -alias security-manager -keyalg RSA -keysize 2048 -validity 10000
```

**2. Configurer signing dans `android/app/build.gradle`:**
```gradle
android {
    signingConfigs {
        release {
            storeFile file("../../security-manager.keystore")
            storePassword "VotreMotDePasse"
            keyAlias "security-manager"
            keyPassword "VotreMotDePasse"
        }
    }
}
```

**3. Build Release:**
```bash
cd android
./gradlew assembleRelease
# APK généré: android/app/build/outputs/apk/release/app-release.apk
```

#### 7. Tester l'APK
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## 🍎 BUILD iOS APP

### Prérequis

- macOS avec Xcode installé
- Compte Apple Developer (99$/an)
- Certificats et Provisioning Profiles

### Étapes

#### 1. Ajouter la plateforme iOS
```bash
cd frontend
npx cap add ios
```

#### 2. Synchroniser
```bash
npx cap sync ios
```

#### 3. Ouvrir dans Xcode
```bash
npx cap open ios
```

#### 4. Configurer le projet dans Xcode

1. Sélectionner le projet "App" dans le navigateur
2. Aller dans "Signing & Capabilities"
3. Cocher "Automatically manage signing"
4. Sélectionner votre Team
5. Modifier le Bundle Identifier: `com.securityworkforce.manager`

#### 5. Permissions dans `Info.plist`

Xcode ouvrira automatiquement `ios/App/App/Info.plist`. Ajouter:

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Nécessaire pour le suivi GPS des agents</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Nécessaire pour le check-in géolocalisé</string>
<key>NSCameraUsageDescription</key>
<string>Nécessaire pour la reconnaissance faciale</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Pour sauvegarder les photos de profil</string>
```

#### 6. Build & Archive

1. Sélectionner "Any iOS Device (arm64)" comme destination
2. Menu: Product > Archive
3. Attendre la fin du build
4. Dans l'organizer, cliquer "Distribute App"
5. Choisir "Ad Hoc" (pour test) ou "App Store" (pour publication)

#### 7. Export IPA
```bash
# L'IPA sera dans ~/Library/Developer/Xcode/Archives/
# Peut être installé via Xcode ou services comme TestFlight
```

---

## 💻 2. APPLICATIONS DESKTOP <a name="desktop"></a>

### Technologie: Electron

### Installation Electron

```bash
cd frontend

# Installer Electron
npm install --save-dev electron electron-builder

# Installer dependencies
npm install electron-is-dev
```

### Créer `public/electron.js`

```javascript
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#667eea',
    show: false
  });

  // Load app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Remove menu bar (optional)
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```

### Créer `public/preload.js`

```javascript
// Preload script for security
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron app loaded');
});
```

### Configurer `package.json`

Ajouter dans le `package.json` du frontend:

```json
{
  "main": "public/electron.js",
  "homepage": "./",
  "scripts": {
    "electron": "electron .",
    "electron-dev": "concurrently \"npm start\" \"wait-on http://localhost:3000 && electron .\"",
    "electron-build": "npm run build && electron-builder",
    "electron-build-all": "npm run build && electron-builder -mwl"
  },
  "build": {
    "appId": "com.securityworkforce.manager",
    "productName": "Security Workforce Manager",
    "files": [
      "build/**/*",
      "node_modules/**/*",
      "public/electron.js",
      "public/preload.js"
    ],
    "directories": {
      "buildResources": "public"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "public/icon.ico"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "icon": "public/icon.icns",
      "category": "public.app-category.business"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "public/icon.png",
      "category": "Office"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-is-dev": "^2.0.0",
    "concurrently": "^8.2.2",
    "wait-on": "^7.2.0"
  }
}
```

---

## 🖥️ BUILD WINDOWS EXE

### Prérequis
- Node.js 18+
- Windows 10/11 (pour build natif)

### Build

```bash
cd frontend

# Installer dependencies
npm install

# Build React
npm run build

# Build Windows executable
npm run electron-build -- --win
```

**Outputs:**
- `dist/Security Workforce Manager Setup 1.0.0.exe` (Installateur NSIS)
- `dist/Security Workforce Manager 1.0.0.exe` (Portable)

### Tester
```bash
# Lancer le portable
"dist/Security Workforce Manager 1.0.0.exe"
```

---

## 🍎 BUILD macOS DMG

### Prérequis
- macOS 10.15+
- Xcode Command Line Tools

### Build

```bash
cd frontend
npm run electron-build -- --mac
```

**Output:**
- `dist/Security Workforce Manager-1.0.0.dmg`
- `dist/Security Workforce Manager-1.0.0-mac.zip`

---

## 🐧 BUILD LINUX

### Build

```bash
cd frontend
npm run electron-build -- --linux
```

**Outputs:**
- `dist/Security Workforce Manager-1.0.0.AppImage`
- `dist/security-workforce-manager_1.0.0_amd64.deb`

---

## 🎨 3. ICÔNES DES APPLICATIONS

### Générer les icônes

Créez une icône 1024x1024 px au format PNG nommée `icon.png`.

#### Windows `.ico`
```bash
# Utiliser un outil comme ImageMagick
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 public/icon.ico
```

#### macOS `.icns`
```bash
# Créer un iconset
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Convertir en .icns
iconutil -c icns icon.iconset -o public/icon.icns
```

#### Android
```bash
# Placer dans android/app/src/main/res/
# Créer plusieurs tailles: mipmap-hdpi, mipmap-xhdpi, mipmap-xxhdpi, mipmap-xxxhdpi
```

---

## 🌐 4. INTÉGRATION BANNIÈRE <a name="integration"></a>

### Dans la page Login

**`frontend/src/pages/Login.jsx`:**

```jsx
import React, { useState } from 'react';
import AppDownloadBanner from '../components/AppDownloadBanner/AppDownloadBanner';
import soundEffects from '../utils/soundEffects';
import './Login.css';

const Login = () => {
  const [showBanner, setShowBanner] = useState(true);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Son au clic
    soundEffects.play('login-start');
    
    try {
      // ... logique d'authentification
      
      // Son de succès
      soundEffects.playSuccess();
      navigate('/dashboard');
    } catch (error) {
      // Son d'erreur
      soundEffects.playError();
    }
  };

  return (
    <div className="login-page">
      {/* Bannière de téléchargement */}
      {showBanner && (
        <AppDownloadBanner />
      )}

      {/* Formulaire de connexion */}
      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          {/* ... reste du formulaire */}
        </form>
      </div>
    </div>
  );
};

export default Login;
```

---

## 📦 5. DISTRIBUTION <a name="distribution"></a>

### Hébergement des Fichiers

#### Option A: Vercel Blob Storage
```bash
npm install @vercel/blob

# Upload
vercel blob upload security-workforce-manager.apk
vercel blob upload security-workforce-manager-setup.exe
```

#### Option B: GitHub Releases
```bash
# Créer un release sur GitHub
gh release create v1.0.0 \
  --title "Security Workforce Manager v1.0.0" \
  --notes "Version initiale" \
  security-workforce-manager.apk \
  security-workforce-manager-setup.exe \
  security-workforce-manager.dmg
```

#### Option C: Service CDN
- Upload sur AWS S3
- Upload sur Cloudflare R2
- Upload sur Firebase Storage

### URLs de Téléchargement

Modifier les liens dans `AppDownloadBanner.jsx`:

```jsx
// Remplacer par vos vraies URLs
<a href="https://github.com/votre-org/security-workforce-manager/releases/download/v1.0.0/app.apk" 
   download>
  Android APK
</a>

<a href="https://github.com/votre-org/security-workforce-manager/releases/download/v1.0.0/setup.exe" 
   download>
  Windows Setup
</a>
```

---

## 🚀 DÉPLOIEMENT COMPLET

### Script de Build Complet

**`build-all-apps.sh`:**

```bash
#!/bin/bash

echo "🚀 Building all applications..."

# Build React
cd frontend
npm install
npm run build

# Build Android APK
echo "📱 Building Android APK..."
npx cap sync android
cd android
./gradlew assembleRelease
cd ..

# Build iOS (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🍎 Building iOS App..."
  npx cap sync ios
  xcodebuild -workspace ios/App/App.xcworkspace \
    -scheme App \
    -configuration Release \
    -archivePath build/App.xcarchive \
    archive
fi

# Build Electron apps
echo "💻 Building Desktop apps..."
npm run electron-build-all

echo "✅ All builds complete!"
echo ""
echo "📦 Build artifacts:"
echo "   - Android: android/app/build/outputs/apk/release/"
echo "   - iOS: build/App.xcarchive"
echo "   - Windows: dist/*.exe"
echo "   - macOS: dist/*.dmg"
echo "   - Linux: dist/*.AppImage"
```

---

## ✅ CHECKLIST FINALE

### Avant Publication

- [ ] Tester APK sur plusieurs appareils Android
- [ ] Tester IPA sur iPhone (via TestFlight)
- [ ] Tester EXE sur Windows 10/11
- [ ] Tester DMG sur macOS
- [ ] Vérifier tous les sons (login, logout, notifications)
- [ ] Tester la géolocalisation
- [ ] Tester la caméra (facial recognition)
- [ ] Vérifier les notifications push
- [ ] Tester en mode offline
- [ ] Optimiser la taille des builds
- [ ] Créer les screenshots pour les stores
- [ ] Préparer les descriptions pour App Store / Play Store
- [ ] Obtenir les certificats de signature
- [ ] Upload sur les stores

---

## 📞 SUPPORT

### Ressources
- **Capacitor Docs**: https://capacitorjs.com
- **Electron Docs**: https://www.electronjs.org
- **Android Studio**: https://developer.android.com/studio
- **Xcode**: https://developer.apple.com/xcode

### Dépannage

**Erreur: Platform not found**
```bash
npx cap sync
```

**Erreur: Build failed Android**
```bash
cd android
./gradlew clean
./gradlew assembleDebug --stacktrace
```

**Erreur: Xcode signing**
- Vérifier le compte Apple Developer
- Régénérer les provisioning profiles

---

**🎉 Votre application est prête pour le monde entier!**
