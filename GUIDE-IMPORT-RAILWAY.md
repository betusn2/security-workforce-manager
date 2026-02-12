# 📊 Guide Import de Données Railway MySQL

## 🔑 Étape 1: Récupérer le mot de passe MySQL

1. **Ouvrez Railway Dashboard** : https://railway.app
2. **Sélectionnez votre projet** `security-guard-deploy`
3. **Cliquez sur le service MySQL**
4. **Allez dans l'onglet "Variables"**
5. **Copiez la valeur de** `MYSQL_ROOT_PASSWORD`

## 🚀 Étape 2: Import des données

### Option A: PowerShell (Recommandé)
```powershell
# 1. Modifiez le mot de passe dans le script
notepad import-data-to-railway.ps1

# 2. Remplacez la ligne:
$DB_PASSWORD = "VOTRE_MOT_DE_PASSE_RAILWAY_MYSQL"

# 3. Exécutez le script
.\import-data-to-railway.ps1
```

### Option B: Node.js
```bash
# 1. Installez les dépendances
npm install mysql2

# 2. Modifiez le mot de passe dans le script
notepad import-data-railway.js

# 3. Remplacez la ligne:
password: 'VOTRE_MOT_DE_PASSE_RAILWAY_MYSQL'

# 4. Exécutez le script
node import-data-railway.js
```

### Option C: Directement via Railway Dashboard
1. **Ouvrez Railway Dashboard → MySQL → Query**
2. **Copiez le contenu du fichier** `import-data-railway.sql`
3. **Collez dans l'éditeur de requêtes**
4. **Cliquez sur "Execute"**

## 📋 Données qui seront importées

### 👥 Utilisateurs (4)
- **Admin** : admin@security.com (mot de passe: admin123)
- **Superviseur** : tazi@security.com (CIN: A303730)
- **Agent 1** : youssef@security.com (CIN: BK517312)
- **Agent 2** : mohammed@security.com (CIN: AB123456)

### 🗺️ Zones (1)
- **Zone Centre Ville** : Casablanca (33.5731, -7.5898)

### 📅 Événements (1)
- **Surveillance Nocturne** : Morocco Mall (5 agents requis)

## ✅ Vérification

Après l'import, testez :
1. **Frontend** : https://security-guard-web.onrender.com
2. **Connexion** avec admin@security.com / admin123
3. **Page Affectations** pour tester le modal avec proximité

## 🔧 Dépannage

### Erreur de connexion
- Vérifiez le mot de passe MySQL
- Assurez-vous que le service est actif
- Vérifiez votre connexion internet

### Erreur "mysql command not found"
- Installez MySQL Client : https://dev.mysql.com/downloads/mysql/
- Ou utilisez l'option Node.js

### Données déjà existantes
- Le script utilise `ON DUPLICATE KEY UPDATE`
- Les données existantes ne seront pas dupliquées