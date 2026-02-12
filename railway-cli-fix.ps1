# ============================================
# Solution Alternative - Railway CLI 
# ============================================

Write-Host "🚀 Solution alternative via Railway CLI" -ForegroundColor Cyan

# Test si Railway CLI est installé
$railwayCLI = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayCLI) {
    Write-Host "⚠️ Railway CLI non installé" -ForegroundColor Yellow
    Write-Host "Installation rapide:" -ForegroundColor White
    Write-Host "npm install -g @railway/cli" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ou utilisez l'interface web Railway Dashboard" -ForegroundColor White
    exit 1
}

Write-Host "✅ Railway CLI détecté" -ForegroundColor Green

# Configuration des variables via CLI
Write-Host "🔧 Configuration variables Railway..." -ForegroundColor Yellow

$projectId = "9a1cdf85-af82-40cc-a922-a302b5a89c08"
$serviceId = "496745d2-04b8-4a6d-bc93-5b22f25a8c4c"

# Variables critiques - Utilisant les références Railway MySQL
$variables = @(
    "DB_HOST=mainline.proxy.rlwy.net",
    "DB_PORT=20601",
    "DB_NAME=railway", 
    "DB_USER=root",
    "DB_PASSWORD=lZSPaiVeXVPgcVbHQVehucJSdUuahlHS",
    "DB_SSL=false",
    "NODE_ENV=production",
    "PORT=5000",
    "FRONTEND_URL=https://security-guard-web.onrender.com",
    "SOCKET_CORS_ORIGIN=https://security-guard-web.onrender.com"
)

Write-Host "📋 Variables à configurer:" -ForegroundColor White
foreach ($var in $variables) {
    Write-Host "   $var" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🚨 EXECUTEZ CES COMMANDES UNE PAR UNE:" -ForegroundColor Red
Write-Host ""

foreach ($var in $variables) {
    $varParts = $var.Split("=", 2)
    $key = $varParts[0]
    $value = $varParts[1]
    
    Write-Host "railway variables --set $key=`"$value`"" -ForegroundColor Green
}

Write-Host ""
Write-Host "Puis redéployez:" -ForegroundColor Yellow  
Write-Host "railway redeploy" -ForegroundColor Green

Write-Host ""
Write-Host "⚠️ Si Railway CLI ne fonctionne pas:" -ForegroundColor Yellow
Write-Host "   Utilisez l'interface web Railway Dashboard" -ForegroundColor White