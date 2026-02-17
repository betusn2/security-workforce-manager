# 🚀 GUIDE D'EXÉCUTION SQL - Railway Database

## ✅ VOTRE FICHIER SQL COMPLET

**Fichier:** `RAILWAY-ALL-TABLES.sql`

✨ **CONTIENT TOUTES LES 23 TABLES:**
- ✅ 3 Tables Core (users, events, zones)
- ✅ 2 Tables Affectations (assignments, attendance)
- ✅ 4 Tables Tracking GPS (geo_tracking, gps_tracking, tracking_alerts, sos_alerts)
- ✅ 3 Tables Communication (notifications, conversations, messages)
- ✅ 4 Tables Sécurité (fraud_attempts, liveness_logs, activity_logs, incidents)
- ✅ 3 Tables Gamification (badges, user_badges, permissions)
- ✅ 2 Tables Permissions (role_permissions, user_permissions)
- ✅ 2 Tables Documents (user_documents, scheduled_backups)

---

## 🎯 MÉTHODE 1 : MySQL Workbench (RECOMMANDÉE)

### Connexion Railway:
```
Host: mainline.proxy.rlwy.net
Port: 20601
User: root
Password: lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
Database: railway
```

### Étapes:
1. **Ouvrir MySQL Workbench**
2. **Nouvelle connexion:**
   - Connection Name: `Railway Security DB`
   - Hostname: `mainline.proxy.rlwy.net`
   - Port: `20601`
   - Username: `root`
   - Password: `lZSPaiVeXVPgcVbHQVehucJSdUuahlHS`

3. **Tester la connexion** → OK

4. **Ouvrir le fichier SQL:**
   - File → Open SQL Script
   - Sélectionner `RAILWAY-ALL-TABLES.sql`

5. **Exécuter:**
   - Clic sur l'icône ⚡ "Execute"
   - Ou `Ctrl+Shift+Enter`

6. **Vérifier:**
   ```sql
   SHOW TABLES;
   SELECT COUNT(*) FROM users;
   ```

---

## 🎯 MÉTHODE 2 : Railway CLI

```powershell
# Installation Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link projet
railway link

# Connecter au shell MySQL
railway connect railway

# Puis copier-coller le contenu du fichier SQL
# Ou exécuter directement:
Get-Content RAILWAY-ALL-TABLES.sql | railway connect railway
```

---

## 🎯 MÉTHODE 3 : Dashboard Railway

1. **Aller sur Railway Dashboard:** https://railway.app/dashboard
2. **Votre projet:** security-guard-deploy
3. **Service:** security-guard-db
4. **Onglet "Query"**
5. **Copier-coller le contenu de** `RAILWAY-ALL-TABLES.sql`
6. **Cliquer "Run"**

---

## 🎯 MÉTHODE 4 : PowerShell Direct

```powershell
# Utiliser mysql client (si installé)
mysql -h mainline.proxy.rlwy.net -P 20601 -u root -p railway < RAILWAY-ALL-TABLES.sql

# Entrer le password quand demandé:
# lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
```

---

## ✅ VÉRIFICATION POST-EXÉCUTION

### 1. Vérifier les tables:
```sql
-- Compter les tables
SELECT COUNT(*) AS total_tables 
FROM information_schema.tables 
WHERE table_schema = 'railway';
-- Résultat attendu: 23

-- Liste des tables
SHOW TABLES;
```

### 2. Vérifier l'admin:
```sql
SELECT cin, name, email, role, status 
FROM users 
WHERE role = 'admin';
-- Email: admin@security.com
-- Password: Admin123!
```

### 3. Vérifier les permissions:
```sql
SELECT COUNT(*) FROM permissions;
-- Résultat attendu: 14+

SELECT COUNT(*) FROM badges;
-- Résultat attendu: 4+
```

---

## 🔐 COMPTE ADMIN PAR DÉFAUT

```
Email: admin@security.com
Password: Admin123!
Rôle: admin
CIN: ADMIN001
```

⚠️ **IMPORTANT:** Changez le mot de passe après la première connexion!

---

## 🚨 EN CAS DE PROBLÈME

### Erreur "Table already exists"
```sql
-- Supprimer toutes les tables d'abord:
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS user_badges, role_permissions, user_permissions, 
  user_documents, scheduled_backups, messages, conversations, notifications,
  tracking_alerts, sos_alerts, incidents, liveness_logs, fraud_attempts, 
  activity_logs, gps_tracking, geo_tracking, attendance, assignments, 
  zones, badges, permissions, events, users;
SET FOREIGN_KEY_CHECKS = 1;

-- Puis ré-exécuter RAILWAY-ALL-TABLES.sql
```

### Erreur de connexion
- Vérifier que l'IP est autorisée (Railway accepte toutes IPs par défaut)
- Vérifier les credentials
- Essayer l'alternative: `nozomi.proxy.rlwy.net:23833`

### Timeout
- Le script peut prendre 1-2 minutes
- Attendre la fin complète

---

## 📊 APRÈS L'EXÉCUTION

### 1. Tester le backend Render
```bash
curl https://security-workforce-manager.onrender.com/health
# Devrait retourner: {"status":"healthy"}
```

### 2. Se connecter au frontend
```
URL: https://security-workforce-manager.vercel.app
Email: admin@security.com
Password: Admin123!
```

### 3. Vérifier le Dashboard
- Voir les statistiques
- Créer un nouvel événement
- Créer un agent
- Tester l'affectation

---

## 🎉 C'EST PRÊT!

Une fois le SQL exécuté avec succès:
- ✅ 23 tables créées
- ✅ Admin créé
- ✅ Permissions configurées
- ✅ Badges initialisés
- ✅ Application fonctionnelle

**Votre plateforme Security Workforce Manager est maintenant COMPLÈTE!** 🚀
