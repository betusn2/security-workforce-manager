# ============================================  
# Fix Railway Backend Connection to MySQL
# ============================================

Write-Host "🔧 Configuration variables Railway Backend" -ForegroundColor Cyan

Write-Host ""
Write-Host "📋 Variables à configurer dans Railway Dashboard :" -ForegroundColor Yellow
Write-Host "   Backend Service → Variables → Add Variable" -ForegroundColor White
Write-Host ""

$env_vars = @"
# Variables de base de données Railway
DB_HOST=mysql.railway.internal
DB_PORT=3306
DB_NAME=railway
DB_USER=root
DB_PASSWORD=${'$'}{{'$'}{MySQL.MYSQL_ROOT_PASSWORD}}
DB_SSL=false

# Variables d'application
NODE_ENV=production
PORT=5000
JWT_SECRET=security_guard_secret_key_2024_very_secure
JWT_EXPIRES_IN=7d
SESSION_SECRET=BrO9YoRyMtAX21QSNWdbusZKGP6wz3geLmhFcCI4HTnV5jkJ7qUlEa0ipfDvx8
ENCRYPTION_KEY=12345678901234567890123456789012

# Variables frontend
FRONTEND_URL=https://security-guard-web.onrender.com
SOCKET_CORS_ORIGIN=https://security-guard-web.onrender.com

# Variables reconnaissance faciale
FACE_RECOGNITION_MODE=local
FACE_MATCH_THRESHOLD=0.45
FACE_DETECTION_CONFIDENCE=0.8
"@

Write-Host "Variables d'environnement :" -ForegroundColor Green
Write-Host $env_vars -ForegroundColor White

Write-Host ""
Write-Host "🎯 Actions à faire MAINTENANT :" -ForegroundColor Red
Write-Host "1. Allez dans Railway Dashboard" -ForegroundColor Yellow
Write-Host "2. Sélectionnez votre Backend Service (pas MySQL)" -ForegroundColor Yellow  
Write-Host "3. Onglet Variables" -ForegroundColor Yellow
Write-Host "4. Ajoutez TOUTES les variables ci-dessus" -ForegroundColor Yellow
Write-Host "5. Pour DB_PASSWORD, utilisez : " -NoNewline -ForegroundColor Yellow
Write-Host "${'$'}{{'$'}{MySQL.MYSQL_ROOT_PASSWORD}}" -ForegroundColor Cyan
Write-Host "6. Cliquez Deploy pour redémarrer le backend" -ForegroundColor Yellow

Write-Host ""
Write-Host "⚠️  IMPORTANT: Le backend et MySQL doivent être dans le MÊME projet Railway" -ForegroundColor Red
Write-Host ""

# Créer un fichier avec les variables pour copier-coller
$env_vars | Out-File -FilePath "railway-backend-variables-fix.txt" -Encoding UTF8

Write-Host "💾 Variables sauvées dans: railway-backend-variables-fix.txt" -ForegroundColor Green
Write-Host "   Vous pouvez copier-coller depuis ce fichier" -ForegroundColor White