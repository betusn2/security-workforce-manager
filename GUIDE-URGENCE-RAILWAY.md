# 🚨 GUIDE URGENCE - RAILWAY BACKEND DOWN

## SITUATION CRITIQUE
- ❌ APPLICATION COMPLÈTEMENT HORS LIGNE
- ❌ Backend Railway ne démarre pas
- ❌ Erreurs CORS = Serveur inaccessible

## SOLUTION IMMÉDIATE (2 minutes)

### 1. ALLER SUR RAILWAY
```
https://railway.app/project/9a1cdf85-af82-40cc-a922-a302b5a89c08
```

### 2. CLIQUER SUR LE SERVICE BACKEND
- NOM: "security-guard-deploy" 
- ICÔNE: Logo GitHub
- PAS le MySQL !

### 3. ONGLET "VARIABLES"
- Cliquez "Add Variable"
- Ajoutez une par une :

```
DB_HOST = mysql.railway.internal
DB_NAME = railway
DB_USER = root
DB_PORT = 3306
DB_PASSWORD = ${{MySQL.MYSQL_ROOT_PASSWORD}}
DB_SSL = false
NODE_ENV = production
```

### 4. DEPLOY
- Cliquez le bouton "Deploy"
- Attendez 30 secondes

## VÉRIFICATION
Logs doivent montrer :
```
✅ Connected to mysql at mysql.railway.internal:3306/railway
🚀 Server running on port 5000
```

## RÉSULTAT ATTENDU
- ✅ Frontend fonctionne
- ✅ Login possible  
- ✅ APIs accessibles
- ✅ Plus d'erreurs CORS

## SI PROBLÈME PERSISTE
- Vérifiez que MySQL service est "Online"
- Redéployez MySQL si nécessaire