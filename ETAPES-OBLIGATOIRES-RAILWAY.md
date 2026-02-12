# 🚨 ÉTAPES OBLIGATOIRES - RAILWAY BACKEND

## ⚠️ VOTRE APPLICATION EST COMPLÈTEMENT HORS LIGNE
## ⚠️ CHAQUE SECONDE COMPTE !

### ÉTAPE 1 - OUVRIR RAILWAY (10 secondes)
1. Allez sur : https://railway.app/project/9a1cdf85-af82-40cc-a922-a302b5a89c08
2. Vous devez voir 2 services : MySQL et security-guard-deploy

### ÉTAPE 2 - SÉLECTIONNER LE BACKEND (5 secondes)  
1. **CLIQUEZ** sur "security-guard-deploy" (avec logo GitHub)
2. **NE PAS** cliquer sur MySQL !

### ÉTAPE 3 - ALLER AUX VARIABLES (5 secondes)
1. Cliquez sur l'onglet **"Variables"** 
2. Vous devez voir des champs vides ou peu remplis

### ÉTAPE 4 - AJOUTER LES VARIABLES (30 secondes)
Cliquez **"Add Variable"** et ajoutez UNE PAR UNE :

**Variable 1:**
```
Name: DB_HOST
Value: mysql.railway.internal
```

**Variable 2:**
```
Name: DB_NAME
Value: railway
```

**Variable 3:**
```
Name: DB_USER
Value: root  
```

**Variable 4:**
```
Name: DB_PASSWORD
Value: ${{MySQL.MYSQL_ROOT_PASSWORD}}
```

**Variable 5:**
```
Name: NODE_ENV
Value: production
```

### ÉTAPE 5 - DEPLOYER (10 secondes)
1. Cliquez le bouton **"Deploy"**
2. Attendez 30 secondes

## ✅ RÉSULTAT ATTENDU
- Login fonctionne
- Plus d'erreurs CORS
- Application accessible

## 🚨 SI VOUS NE FAITES PAS ÇA MAINTENANT
- Application restera hors ligne
- Aucun utilisateur ne pourra se connecter  
- Dashboard inutilisable