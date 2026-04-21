# Security Workforce Manager — Copilot Instructions

## Contexte du projet

Application complète de **gestion des agents de sécurité** (pointage, GPS, événements, missions).
Langue principale de l'interface : **Français**. Code en **English** (variables, fonctions, composants).

---

## Architecture globale

```
security-guard-deploy/
├── backend/          → API Node.js/Express (port 5000)
├── web-dashboard/    → React 18 + TailwindCSS (port 3000)
├── mobile-app/       → React Native / Expo (SDK 50)
└── .github/          → Copilot instructions
```

**Déploiement recommandé :**
- Base de données MySQL → Railway
- Backend API → Render (Frankfurt)
- Frontend React → Vercel
- APK Android → Expo EAS Build

---

## Stack technique

### Backend (`backend/`)
- **Runtime :** Node.js + Express 4
- **ORM :** Sequelize 6 + MySQL2 / PostgreSQL (pg)
- **Auth :** JWT (jsonwebtoken) + bcrypt (12 rounds)
- **Temps réel :** Socket.IO 4
- **IA :** TensorFlow.js + @vladmandic/face-api (reconnaissance faciale)
- **Tâches planifiées :** node-cron
- **Sécurité :** helmet, express-rate-limit, AES-256 (crypto-js)
- **Notifications :** Nodemailer, Twilio (SMS), WhatsApp
- **Fichiers :** Multer, Sharp, PDFKit, ExcelJS
- **Logs :** Winston, Morgan

### Frontend Web (`web-dashboard/`)
- **Framework :** React 18 + React Router v6
- **Style :** TailwindCSS 3 + Headless UI
- **State :** Zustand + TanStack Query v5
- **Formulaires :** React Hook Form + Zod
- **Cartes :** Leaflet + React-Leaflet + MarkerCluster
- **Calendrier :** FullCalendar 6
- **Graphiques :** Chart.js, Recharts
- **Temps réel :** Socket.IO Client 4
- **HTTP :** Axios (centralisé dans `src/services/api.js`)
- **Exports :** jsPDF + jsPDF-AutoTable, ExcelJS
- **QR :** qrcode, qr-scanner
- **Reconnaisance faciale :** face-api.js
- **Notifications :** react-toastify

### Mobile (`mobile-app/`)
- **Framework :** React Native 0.73 + Expo SDK 50
- **Navigation :** React Navigation v6 (stack + bottom tabs)
- **State :** Zustand
- **HTTP :** Axios 0.27
- **Temps réel :** Socket.IO Client 4
- **GPS :** expo-location + expo-task-manager (background)
- **Caméra :** expo-camera (check-in facial)
- **Cartes :** react-native-maps
- **Push :** expo-notifications
- **Stockage :** expo-secure-store, AsyncStorage
- **Médias :** expo-image-picker, expo-document-picker, expo-av

---

## Modèles de données (Sequelize)

| Modèle | Description |
|--------|-------------|
| `User` | Agents, superviseurs, admins. Roles: `agent`, `supervisor`, `admin`. Soft-delete (paranoid). |
| `Event` | Événements/missions. Possède `directorId`, `directorName`, `directorEmail`, phases. |
| `Assignment` | Affectation agent↔événement. Statuts: `pending`, `confirmed`, `refused`. |
| `Attendance` | Pointage (check-in/check-out). GPS + reconnaissance faciale. |
| `Zone` | Zones géographiques liées à un événement. |
| `GeoTracking` | Historique GPS temps réel des agents. |
| `Incident` | Incidents signalés lors d'événements. |
| `Notification` | Notifications in-app. |
| `ActivityLog` | Journal d'audit de toutes les actions. |
| `Badge` / `UserBadge` | Système de badges/récompenses. |
| `Conversation` / `Message` | Messagerie interne. |
| `SosAlert` | Alertes SOS agents. |
| `Permission` / `RolePermission` / `UserPermission` | RBAC granulaire. |
| `UserDocument` | Documents liés aux agents. |
| `ScheduledBackup` | Sauvegardes programmées. |

---

## Routes API principales (`/api/...`)

| Préfixe | Fichier route | Description |
|---------|---------------|-------------|
| `/auth` | `auth.js` | Login, register, profil, JWT refresh, CIN login |
| `/users` | `users.js` | CRUD utilisateurs, superviseurs, agents |
| `/events` | `events.js` | CRUD événements, phases, stats |
| `/assignments` | `assignments.js` | Affectations agents↔événements |
| `/attendance` | `attendance.js` | Pointages check-in/check-out |
| `/zones` | `zones.js` | Zones géographiques |
| `/tracking` | `tracking.js` | GPS tracking temps réel |
| `/incidents` | `incidents.js` | Incidents |
| `/notifications` | `notifications.js` | Notifications |
| `/badges` | `badges.js` | Badges |
| `/reports` | `reports.js` | Rapports PDF/Excel |
| `/messages` | `messages.js` | Messagerie |
| `/sos` | `sos.js` | Alertes SOS |
| `/permissions` | `permissions.js` | RBAC |
| `/supervisor` | `supervisor.js` | Données superviseur |
| `/documents` | `documents.js` | Documents agents |

---

## Pages Web Dashboard

Pages dans `web-dashboard/src/pages/` :
- `Dashboard.jsx` / `DashboardEnhanced.jsx` — Tableau de bord temps réel
- `Users.jsx` / `UsersEnhanced.jsx` / `UsersResponsive.jsx` — Gestion utilisateurs
- `Events.jsx` — Événements & missions (modal création/édition avec tabs)
- `Assignments.jsx` / `AssignmentsResponsive.jsx` — Affectations
- `Attendance.jsx` / `AttendanceVerification.jsx` — Pointages
- `CheckIn.jsx` / `CheckInLogin.jsx` / `CheckInOut.jsx` — Interface pointage terrain
- `RealTimeTracking.jsx` — Carte GPS temps réel
- `AgentTrackingMap.jsx` — Carte par agent
- `Planning.jsx` — Calendrier FullCalendar
- `Incidents.jsx` — Gestion incidents
- `Reports.jsx` — Rapports PDF/Excel
- `Notifications.jsx` / `AdminNotifications.jsx` — Notifications
- `Zones.jsx` — Zones géographiques
- `Badges.jsx` / `Rankings.jsx` — Badges & classements
- `Permissions.jsx` — RBAC
- `Settings.jsx` — Paramètres
- `AdminLogs.jsx` — Journal d'audit
- `AdminDatabaseBackup.jsx` — Sauvegardes DB
- `AdminFacialManager.jsx` / `FaceRecognitionDashboard.jsx` — Reconnaissance faciale
- `Login.jsx` — Connexion

---

## Écrans Mobile

Screens dans `mobile-app/src/screens/` :
- `LoginScreen.js` — Connexion (email ou CIN)
- `HomeScreen.js` — Accueil agent
- `CheckInScreen.js` / `CheckOutScreen.js` — Pointage GPS + facial
- `EventsScreen.js` / `EventDetailScreen.js` — Événements
- `AssignmentsScreen.js` — Missions
- `LiveTrackingScreen.js` — Tracking GPS live
- `IncidentReportScreen.js` — Signalement incident
- `ChatScreen.js` — Messagerie
- `NotificationsScreen.js` — Notifications
- `BadgesScreen.js` — Badges
- `HistoryScreen.js` — Historique pointages
- `ProfileScreen.js` / `EditProfileScreen.js` — Profil
- `DocumentsScreen.js` — Documents
- `ReportsScreen.js` — Rapports
- `PhaseManagerScreen.js` — Gestion phases événement
- `UsersScreen.js` — Liste agents (superviseur)
- `SettingsScreen.js` / `HelpScreen.js` / `ChangePasswordScreen.js`

---

## Service API centralisé (`web-dashboard/src/services/api.js`)

Toutes les requêtes HTTP passent par `api.js`. Les services exportés sont :
`authAPI`, `usersAPI`, `eventsAPI`, `phaseAPI`, `assignmentsAPI`, `attendanceAPI`,
`notificationsAPI`, `reportsAPI`, `incidentsAPI`, `badgesAPI`, `zonesAPI`, `trackingAPI`,
`supervisorAPI`, `permissionsAPI`, `messagesAPI`, `sosAPI`, `documentsAPI`

Intercepteurs Axios : ajout automatique du Bearer token (`accessToken` → `token` → `checkInToken`),
refresh automatique JWT 401, redirection login si token expiré.

---

## Authentification & Rôles

- **3 rôles :** `admin`, `supervisor`, `agent`
- **Auth :** JWT access token + refresh token (localStorage)
- **Tokens :** `accessToken`, `token` (alias), `checkInToken` (mode pointage CIN)
- **Middleware backend :** `authenticate` (vérifie JWT), `authorize(...roles)` (RBAC)
- **Statuts utilisateur :** `active`, `inactive`, `suspended`
- **Soft-delete :** activé (paranoid Sequelize)

---

## Temps réel (Socket.IO)

- Backend : `socketIOService.js` — émet les événements temps réel
- Frontend web : connexion via `socket.io-client` dans les pages de tracking
- Mobile : connexion Socket.IO pour GPS et alertes
- Événements principaux : `user:update`, `attendance:checkin`, `gps:update`, `alert:sos`, `incident:new`

---

## Variables d'environnement clés (backend)

```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD  # MySQL
DATABASE_URL                                      # PostgreSQL (Render)
JWT_SECRET, JWT_REFRESH_SECRET
JWT_EXPIRE=24h, JWT_REFRESH_EXPIRE=7d
NODE_ENV=production
PORT=5000
CORS_ORIGIN                                       # URL frontend
ENCRYPTION_KEY                                    # AES-256 facial vectors
```

---

## Conventions de code

- Composants React en **PascalCase** (`EventModal`, `UserCard`)
- Fonctions/variables en **camelCase** (`fetchEvents`, `formData`)
- Fichiers de pages en **PascalCase.jsx**
- API calls toujours via les services dans `api.js`, jamais directement avec axios
- Toasts pour feedback utilisateur : `toast.success()`, `toast.error()` (react-toastify)
- Modals contrôlés par `isOpen` prop + `onClose` callback
- Données chargées dans `useEffect` avec dépendances explicites
- Erreurs loggées avec `console.error()` + message descriptif
- Langue des labels/messages UI : **Français**

---

## Points d'attention

- Le backend supporte **MySQL** (Railway) et **PostgreSQL** (Render) via Sequelize
- La reconnaissance faciale utilise des vecteurs chiffrés AES-256
- Le GPS background fonctionne via `expo-task-manager` sur mobile
- Les check-ins supportent 3 modes : facial, QR code, CIN manuel
- Les événements ont un système de **phases** (préparation → mise en place → pointage)
- Le `limit` pour `usersAPI.getAll()` doit être élevé (9999) pour charger tous les utilisateurs
