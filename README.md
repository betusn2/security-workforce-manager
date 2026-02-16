# 🏢 Security Workforce Manager

> Système complet de gestion et de suivi des agents de sécurité avec tracking GPS en temps réel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/betusn2/security-workforce-manager)
[![Deploy on Render](https://render.com/images/deploy-to-render-button.svg)](https://dashboard.render.com)

## 🚀 Déploiement Production

### ⭐ Configuration Recommandée (Architecture Hybride)
- **Database**: MySQL → **Railway** (Déjà configuré)
- **Backend**: Node.js API + WebSocket → **Render** (Frankfurt)
- **Frontend**: React Dashboard → **Vercel** (CDN Global)

**Pourquoi cette architecture ?**
- ✅ Railway : MySQL natif, pas de migration nécessaire
- ✅ Render : Backend stable, WebSocket performant
- ✅ Vercel : Frontend ultra-rapide, CDN mondial gratuit
- 💰 Coût : ~$5-10/mois

### 📚 Guides de Déploiement

| Architecture | Guide | Temps | Description |
|--------------|-------|-------|-------------|
| **Railway DB + Render + Vercel** ⭐ | [Quick Start](DEPLOY-HYBRID-QUICKSTART.md) | 25 min | **Recommandé** - Architecture optimale |
| **Railway DB + Render + Vercel** | [Guide Complet](DEPLOY-HYBRID-GUIDE.md) | - | Documentation détaillée hybride |
| Railway Complet | [Railway Quick](DEPLOY-RAILWAY-QUICKSTART.md) | 15 min | Tout sur Railway |
| Railway Complet | [Railway Guide](DEPLOY-RAILWAY-VERCEL-GUIDE.md) | - | Guide Railway détaillé |
| Render + Vercel | [Render Quick](DEPLOY-QUICKSTART.md) | 25 min | Render avec PostgreSQL |
| Render + Vercel | [Render Guide](DEPLOY-VERCEL-RENDER-GUIDE.md) | - | Guide Render détaillé |

### ⚡ Déploiement Rapide (Architecture Recommandée)

```bash
# Prérequis : Railway DB MySQL déjà configuré ✅

# 1. Backend sur Render
# → https://dashboard.render.com → New Web Service
# → Repo: betusn2/security-workforce-manager
# → Root: backend/
# → Variables: Utiliser infos Railway DB

# 2. Frontend sur Vercel  
# → https://vercel.com/new
# → Root: web-dashboard/
# → Variables: URL Render

# 3. Mettre à jour les URLs croisées

# 4. Créer l'admin
# → Render Shell: node create-first-admin.js
```

---

## ✨ Fonctionnalités

### Application Mobile (React Native/Expo)
- ✅ Authentification des agents et responsables
- ✅ Pointage via reconnaissance faciale
- ✅ Géolocalisation en temps réel
- ✅ Notifications automatiques WhatsApp/SMS
- ✅ Historique des présences et absences

### Backend API (Node.js + Express)
- ✅ CRUD Agents, Responsables, Événements
- ✅ Stockage sécurisé des vecteurs faciaux (AES encryption)
- ✅ Gestion des présences et retards
- ✅ Envoi automatique de notifications (Twilio)
- ✅ Authentification JWT et contrôle d'accès par rôle
- ✅ Logs d'activités complets
- ✅ WebSocket pour temps réel

### Dashboard Web (React.js)
- ✅ Gestion des utilisateurs, événements et affectations
- ✅ Visualisation des présences et géolocalisation
- ✅ Rapports PDF/Excel
- ✅ Historique et logs d'activité
- ✅ Interface responsive

### Base de données (MySQL)
- ✅ users (agents et responsables)
- ✅ events (événements)
- ✅ assignments (affectations agents)
- ✅ attendance (pointages)
- ✅ notifications (messages)
- ✅ activity_logs (audit)

### Sécurité
- ✅ Hashing mots de passe (bcrypt - 12 rounds)
- ✅ Cryptage vecteurs faciaux (AES-256)
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ Audit logs complets

## 🏗 Architecture

```
security-guard-management/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── config/         # Configuration DB
│   │   ├── controllers/    # Contrôleurs API
│   │   ├── middlewares/    # Auth, validation, logs
│   │   ├── models/         # Modèles Sequelize
│   │   ├── routes/         # Routes API
│   │   ├── services/       # Services métier
│   │   └── server.js       # Point d'entrée
│   ├── migrations/         # Scripts SQL
│   └── package.json
│
├── web-dashboard/          # Dashboard React.js
│   ├── src/
│   │   ├── components/     # Composants React
│   │   ├── pages/          # Pages
│   │   ├── services/       # API calls
│   │   └── hooks/          # Hooks personnalisés
│   └── package.json
│
├── mobile-app/             # App React Native/Expo
│   ├── src/
│   │   ├── screens/        # Écrans
│   │   ├── components/     # Composants
│   │   └── services/       # API & state
│   └── package.json
│
└── index.html              # Page d'accueil projet
```

## 📦 Prérequis

- **XAMPP** avec Apache et MySQL
- **Node.js** v18+ et npm
- **Expo CLI** (pour l'app mobile)

## 🚀 Installation

### 1. Base de données MySQL

1. Démarrez XAMPP (Apache et MySQL)
2. Ouvrez http://localhost/phpmyadmin
3. Exécutez le script SQL:
   ```
   backend/migrations/001-create-tables-mysql.sql
   ```

### 2. Backend API

```bash
cd C:\xampp\htdocs\security-guard-management\backend
npm install
npm run dev
```

Le serveur démarre sur http://localhost:5000

### 3. Dashboard Web

```bash
cd C:\xampp\htdocs\security-guard-management\web-dashboard
npm install
npm start
```

Le dashboard est accessible sur http://localhost:3000

### 4. Application Mobile (optionnel)

```bash
cd C:\xampp\htdocs\security-guard-management\mobile-app
npm install
npx expo start
```

Scannez le QR code avec l'app Expo Go sur votre téléphone.

## ⚙️ Configuration

### Variables d'environnement Backend (.env)

```env
# Server
NODE_ENV=development
PORT=5000

# MySQL (XAMPP)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=security_guard_db
DB_USER=root
DB_PASSWORD=

# JWT
JWT_SECRET=votre_cle_secrete_jwt
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=votre_cle_32_caracteres

# Twilio (optionnel)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_NUMBER=
```

### Configuration Mobile

Éditez `mobile-app/src/services/api.js` et remplacez l'IP par celle de votre PC:

```javascript
const API_URL = 'http://192.168.1.XXX:5000/api';
```

## 👤 Identifiants par défaut

- **Email:** admin@securityguard.com
- **Mot de passe:** Admin@123

## 🔌 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/profile` - Profil utilisateur

### Utilisateurs
- `GET /api/users` - Liste des utilisateurs
- `POST /api/users` - Créer un utilisateur
- `GET /api/users/:id` - Détails utilisateur
- `PUT /api/users/:id` - Modifier utilisateur
- `DELETE /api/users/:id` - Supprimer utilisateur

### Événements
- `GET /api/events` - Liste des événements
- `POST /api/events` - Créer un événement
- `GET /api/events/:id` - Détails événement
- `PUT /api/events/:id` - Modifier événement
- `DELETE /api/events/:id` - Supprimer événement

### Affectations
- `GET /api/assignments` - Liste des affectations
- `POST /api/assignments` - Créer une affectation
- `POST /api/assignments/bulk` - Affectations multiples
- `POST /api/assignments/:id/respond` - Confirmer/Refuser

### Présences
- `POST /api/attendance/check-in` - Pointage arrivée
- `POST /api/attendance/check-out/:id` - Pointage départ
- `GET /api/attendance` - Liste des présences
- `GET /api/attendance/stats` - Statistiques

### Rapports
- `GET /api/reports/dashboard` - Stats dashboard
- `GET /api/reports/attendance/pdf` - Rapport PDF
- `GET /api/reports/attendance/excel` - Rapport Excel

## 🔒 Rôles et Permissions

| Rôle | Permissions |
|------|-------------|
| `admin` | Accès complet à toutes les fonctionnalités |
| `supervisor` | Gestion des agents, événements, affectations |
| `agent` | Pointage, consultation de ses données |

## 📱 Captures d'écran

Accédez à http://localhost/security-guard-management/ pour voir la présentation du projet.

## 🛠 Technologies utilisées

- **Backend:** Node.js, Express, Sequelize, MySQL
- **Frontend:** React.js, Tailwind CSS, Recharts
- **Mobile:** React Native, Expo
- **Auth:** JWT, bcrypt
- **Notifications:** Twilio (SMS/WhatsApp), Nodemailer
- **Real-time:** Socket.IO
- **Reports:** PDFKit, ExcelJS

## 📄 Licence

Ce projet est fourni à des fins éducatives et de démonstration.
