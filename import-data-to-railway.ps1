# ============================================
# Import Sample Data to Railway MySQL Database
# ============================================

Write-Host "🚀 Import des données vers Railway MySQL..." -ForegroundColor Cyan

# Variables Railway
$DB_HOST = "mainline.proxy.rlwy.net"
$DB_PORT = "20601"
$DB_NAME = "railway"
$DB_USER = "root"
$DB_PASSWORD = "lZSPaiVeXVPgcVbHQVehucJSdUuahlHS"

Write-Host "📋 Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier si mysql client est installé
$mysqlPath = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlPath) {
    Write-Host "❌ Client MySQL non trouvé. Installation requise..." -ForegroundColor Red
    Write-Host "💡 Téléchargez MySQL depuis: https://dev.mysql.com/downloads/mysql/" -ForegroundColor Yellow
    exit 1
}

# Vérifier si le fichier SQL existe
$sqlFile = "import-data-railway.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Fichier $sqlFile non trouvé" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prérequis validés" -ForegroundColor Green

# Test de connexion
Write-Host "🔗 Test de connexion à Railway MySQL..." -ForegroundColor Yellow
$testQuery = "SELECT 1 as test;"
$testResult = & mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -D $DB_NAME -e $testQuery 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de connexion à Railway:" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "🔧 Vérifiez:" -ForegroundColor Yellow
    Write-Host "   - Le mot de passe MySQL dans Railway Dashboard" -ForegroundColor White
    Write-Host "   - L'accès réseau depuis votre IP" -ForegroundColor White
    Write-Host "   - Le statut du service MySQL sur Railway" -ForegroundColor White
    exit 1
}

Write-Host "✅ Connexion Railway réussie" -ForegroundColor Green

# Import des données
Write-Host "📊 Import des données vers Railway..." -ForegroundColor Cyan
$importResult = Get-Content $sqlFile -Raw | & mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -D $DB_NAME 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de l'import:" -ForegroundColor Red
    Write-Host $importResult -ForegroundColor Red
    exit 1
}

Write-Host "✅ Import terminé avec succès!" -ForegroundColor Green

# Vérification des données
Write-Host "🔍 Vérification des données importées..." -ForegroundColor Yellow

$queries = @(
    "SELECT COUNT(*) as users FROM users;",
    "SELECT COUNT(*) as zones FROM zones;", 
    "SELECT COUNT(*) as events FROM events;"
)

foreach ($query in $queries) {
    $result = & mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD -D $DB_NAME -e $query 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $result" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎉 Import Railway terminé avec succès!" -ForegroundColor Green
Write-Host "📊 Données disponibles:" -ForegroundColor Cyan
Write-Host "   - 1 Admin (admin@security.com)" -ForegroundColor White
Write-Host "   - 1 Superviseur (tazi@security.com)" -ForegroundColor White
Write-Host "   - 2 Agents (youssef@security.com, mohammed@security.com)" -ForegroundColor White
Write-Host "   - 1 Zone (Centre Ville)" -ForegroundColor White
Write-Host "   - 1 Événement (Surveillance Nocturne)" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Testez votre application:" -ForegroundColor Yellow
Write-Host "   Frontend: https://security-guard-web.onrender.com" -ForegroundColor Cyan
Write-Host "   Backend: https://security-guard-backend.onrender.com" -ForegroundColor Cyan