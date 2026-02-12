# 🔍 VÉRIFIER CONNEXION BACKEND → MYSQL

## ❌ PROBLÈME DÉTECTÉ
Le backend Railway **ne se connecte pas** à MySQL.

## 📋 CHECKLIST DE VÉRIFICATION

### 1️⃣ Variables Railway configurées?

Aller sur: **Railway Dashboard → Backend Service → Variables**

Vérifier que **TOUTES** ces variables existent:
```
✅ DB_HOST=mainline.proxy.rlwy.net
✅ DB_PORT=20601
✅ DB_NAME=railway
✅ DB_USER=root
✅ DB_PASSWORD=lZSPaiVeXVPgcVbHQVehucJSdUuahlHS
✅ DB_DIALECT=mysql
```

**SI ELLES MANQUENT:**
1. Copier tout depuis [RAILWAY-VARIABLES-COPIER-COLLER.txt](RAILWAY-VARIABLES-COPIER-COLLER.txt)
2. Railway → Backend → Variables → "Raw Editor"
3. Coller
4. "Update Variables"
5. Attendre 2-3 min le redémarrage

---

### 2️⃣ Vérifier les logs Railway

**Railway Dashboard → Backend Service → Deployments → Logs**

**Chercher ces messages:**

✅ **Connexion réussie:**
```
🔌 Connecting to mysql at mainline.proxy.rlwy.net:20601/railway
✅ Database connection established successfully
```

❌ **Connexion échouée (erreurs possibles):**
```
❌ ECONNREFUSED - Port bloqué / service arrêté
❌ ETIMEDOUT - Timeout connexion
❌ ER_ACCESS_DENIED_ERROR - Mauvais mot de passe
❌ ER_DBACCESS_DENIED_ERROR - Base inexistante
❌ Unknown database 'railway' - DB non créée
```

---

### 3️⃣ Insérer les utilisateurs

**Si MySQL connecté mais pas d'utilisateurs:**

```bash
node import-tables-railway.js
```

Cela créera 4 utilisateurs de test:
- admin@security.com (admin123)
- tazi@security.com (supervisor123)
- youssef@security.com (agent123)
- mohammed@security.com (agent123)

---

### 4️⃣ Test direct MySQL

Vérifier que MySQL Railway fonctionne:

```bash
node -e "const mysql = require('mysql2/promise'); mysql.createConnection({host:'mainline.proxy.rlwy.net',port:20601,user:'root',password:'lZSPaiVeXVPgcVbHQVehucJSdUuahlHS',database:'railway'}).then(()=>console.log('✅ MySQL OK')).catch(e=>console.log('❌',e.message))"
```

---

## 🚀 SOLUTION RAPIDE

### SI VARIABLES MANQUENT:

1. **Copier** [RAILWAY-VARIABLES-COPIER-COLLER.txt](RAILWAY-VARIABLES-COPIER-COLLER.txt)
2. **Coller dans Railway** → Backend → Variables → Raw Editor
3. **Attendre 2-3 min** le redémarrage
4. **Retester**: `.\test-railway-complete.ps1`

### SI VARIABLES OK MAIS CONNEXION ÉCHOUE:

**Logs Railway montrent quoi?**
- Partage-moi l'erreur exacte des logs
- Je pourrai identifier le problème précis

---

## 📞 PROCHAINE ÉTAPE

**VA SUR RAILWAY DASHBOARD ET DIS-MOI:**

1. **Variables Backend** → Y a-t-il DB_HOST, DB_PORT, DB_PASSWORD?
2. **Logs Backend** → Quel message d'erreur MySQL apparaît?

Je t'aiderai à corriger en fonction de ce que tu vois! 🔧
