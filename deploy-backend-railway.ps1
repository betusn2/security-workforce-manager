# 🚂 Déploiement Railway Backend - Guide Rapide

Write-Host "🚂 Préparation du déploiement Backend sur Railway..." -ForegroundColor Cyan
Write-Host ""

# Commit les fichiers de configuration Railway
Write-Host "📦 Ajout des fichiers de configuration Railway..." -ForegroundColor Yellow
git add railway.json railway-backend-env.txt RAILWAY-BACKEND-DEPLOY.md
git commit -m "Add: Railway backend deployment configuration"
git push origin main

Write-Host ""
Write-Host "✅ Configuration Railway poussée sur GitHub!" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🎯 PROCHAINES ÉTAPES - Suivez attentivement:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

Write-Host "1️⃣  CRÉER LE SERVICE BACKEND SUR RAILWAY" -ForegroundColor Cyan
Write-Host ""
Write-Host "   a) Allez sur: https://railway.app" -ForegroundColor White
Write-Host "   b) Ouvrez votre projet: 'respectful-connection'" -ForegroundColor White
Write-Host "   c) Cliquez: [+ New Service]" -ForegroundColor Green
Write-Host "   d) Sélectionnez: [GitHub Repo]" -ForegroundColor Green
Write-Host "   e) Choisissez: moheshaimi-beep/security-guard-deploy" -ForegroundColor Green
Write-Host "   f) Cliquez: [Deploy]" -ForegroundColor Green
Write-Host ""

Write-Host "2️⃣  CONFIGURER LE ROOT DIRECTORY" -ForegroundColor Cyan
Write-Host ""
Write-Host "   a) Cliquez sur le nouveau service créé" -ForegroundColor White
Write-Host "   b) Allez dans: [Settings]" -ForegroundColor White
Write-Host "   c) Section 'Build':" -ForegroundColor White
Write-Host "      • Root Directory: backend" -ForegroundColor Cyan
Write-Host "      • Build Command: npm install" -ForegroundColor Cyan
Write-Host "      • Start Command: node src/server.js" -ForegroundColor Cyan
Write-Host "   d) Sauvegardez" -ForegroundColor White
Write-Host ""

Write-Host "3️⃣  CONFIGURER LES VARIABLES D'ENVIRONNEMENT" -ForegroundColor Cyan
Write-Host ""
Write-Host "   a) Onglet: [Variables]" -ForegroundColor White
Write-Host "   b) Cliquez: [Raw Editor]" -ForegroundColor White
Write-Host "   c) Copiez-collez le contenu de: railway-backend-env.txt" -ForegroundColor White
Write-Host "   d) Remplacez:" -ForegroundColor Yellow
Write-Host "      DB_HOST=" -NoNewline -ForegroundColor Gray
Write-Host "`${{MySQL.MYSQL_PRIVATE_URL}}" -ForegroundColor Magenta
Write-Host "      DB_USER=" -NoNewline -ForegroundColor Gray
Write-Host "`${{MySQL.MYSQLUSER}}" -ForegroundColor Magenta
Write-Host "      DB_PASSWORD=" -NoNewline -ForegroundColor Gray
Write-Host "`${{MySQL.MYSQLPASSWORD}}" -ForegroundColor Magenta
Write-Host "      DB_NAME=" -NoNewline -ForegroundColor Gray
Write-Host "`${{MySQL.MYSQLDATABASE}}" -ForegroundColor Magenta
Write-Host "   e) Cliquez: [Add]" -ForegroundColor White
Write-Host ""

Write-Host "4️⃣  GÉNÉRER UN DOMAINE PUBLIC" -ForegroundColor Cyan
Write-Host ""
Write-Host "   a) Onglet: [Settings]" -ForegroundColor White
Write-Host "   b) Section: [Networking]" -ForegroundColor White
Write-Host "   c) Cliquez: [Generate Domain]" -ForegroundColor Green
Write-Host "   d) Copiez l'URL générée (ex: xxx.railway.app)" -ForegroundColor Yellow
Write-Host ""

Write-Host "5️⃣  ATTENDRE LE DÉPLOIEMENT" -ForegroundColor Cyan
Write-Host ""
Write-Host "   a) Onglet: [Deployments]" -ForegroundColor White
Write-Host "   b) Attendez le statut: Success ✅" -ForegroundColor Green
Write-Host "   c) Vérifiez les logs pour:" -ForegroundColor White
Write-Host "      ✅ Database connection established successfully" -ForegroundColor Green
Write-Host ""

Write-Host "6️⃣  METTRE À JOUR LE FRONTEND RENDER" -ForegroundColor Cyan
Write-Host ""
Write-Host "   a) Render Dashboard → security-guard-web → Environment" -ForegroundColor White
Write-Host "   b) Modifiez:" -ForegroundColor White
Write-Host "      REACT_APP_API_URL = https://[RAILWAY-URL]/api" -ForegroundColor Cyan
Write-Host "      REACT_APP_SOCKET_URL = https://[RAILWAY-URL]" -ForegroundColor Cyan
Write-Host "   c) Save Changes" -ForegroundColor White
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Guide détaillé: RAILWAY-BACKEND-DEPLOY.md" -ForegroundColor Blue
Write-Host ""
Write-Host "💡 Astuce: Railway utilise le réseau privé pour MySQL =" -ForegroundColor Yellow
Write-Host "   Connexion ultra-rapide et garantie! 🚀" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Commencez par l'étape 1 ci-dessus!" -ForegroundColor Cyan
Write-Host ""
