# ============================================
# TEST COMPLET - RAILWAY BACKEND
# ============================================
# Test de connexion MySQL + Socket.IO + API
# Usage: .\test-railway-complete.ps1
# ============================================

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "🧪 TEST COMPLET - RAILWAY BACKEND" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$BACKEND_URL = "https://security-guard-deploy-production.up.railway.app"

# ============================================
# TEST 1: API HEALTH CHECK
# ============================================
Write-Host "`n📡 TEST 1: API Health Check..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "$BACKEND_URL/api/health" -Method Get -ErrorAction Stop
    Write-Host "✅ API en ligne!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ API inaccessible: $_" -ForegroundColor Red
    Write-Host "   Vérifiez que le service Railway est déployé" -ForegroundColor Yellow
}

# ============================================
# TEST 2: CONNEXION BASE DE DONNÉES
# ============================================
Write-Host "`n🗄️  TEST 2: Connexion MySQL..." -ForegroundColor Yellow

try {
    $dbCheck = Invoke-RestMethod -Uri "$BACKEND_URL/api/auth/setup-admin" -Method Get -ErrorAction Stop
    Write-Host "✅ Connexion MySQL OK!" -ForegroundColor Green
    Write-Host "   Message: $($dbCheck.message)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erreur connexion MySQL" -ForegroundColor Red
    Write-Host "   Vérifiez les variables DB_* dans Railway" -ForegroundColor Yellow
}

# ============================================
# TEST 3: AUTHENTIFICATION
# ============================================
Write-Host "`n🔐 TEST 3: Authentification..." -ForegroundColor Yellow

$loginBody = @{
    email = "admin@security.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "$BACKEND_URL/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    
    if ($login.success) {
        Write-Host "✅ Authentification réussie!" -ForegroundColor Green
        Write-Host "   Utilisateur: $($login.data.user.firstName) $($login.data.user.lastName)" -ForegroundColor Gray
        Write-Host "   Rôle: $($login.data.user.role)" -ForegroundColor Gray
        $token = $login.data.accessToken
    } else {
        Write-Host "❌ Échec authentification: $($login.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur authentification: $_" -ForegroundColor Red
    Write-Host "   Assurez-vous que les utilisateurs sont créés dans MySQL" -ForegroundColor Yellow
}

# ============================================
# TEST 4: SOCKET.IO ENDPOINT
# ============================================
Write-Host "`n🔌 TEST 4: Socket.IO Endpoint..." -ForegroundColor Yellow

try {
    $socket = Invoke-WebRequest -Uri "$BACKEND_URL/socket.io/" -Method Get -ErrorAction Stop
    
    if ($socket.Content -match "Transport unknown") {
        Write-Host "✅ Socket.IO endpoint accessible!" -ForegroundColor Green
        Write-Host "   Status Code: $($socket.StatusCode)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Socket.IO endpoint inaccessible: $_" -ForegroundColor Red
    Write-Host "   Vérifiez les variables SOCKET_* dans Railway" -ForegroundColor Yellow
}

# ============================================
# TEST 5: VÉRIFICATION DES TABLES
# ============================================
Write-Host "`n📊 TEST 5: Tables MySQL..." -ForegroundColor Yellow

if ($token) {
    try {
        # Test avec un endpoint qui nécessite l'authentification
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        
        $profile = Invoke-RestMethod -Uri "$BACKEND_URL/api/auth/profile" -Method Get -Headers $headers -ErrorAction Stop
        Write-Host "✅ Tables MySQL accessibles!" -ForegroundColor Green
        Write-Host "   Profile récupéré: $($profile.data.email)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Erreur accès tables: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Impossible de tester (pas de token)" -ForegroundColor Yellow
}

# ============================================
# RÉSUMÉ
# ============================================
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "📋 RÉSUMÉ DES TESTS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host "`n✅ Tests à vérifier:" -ForegroundColor Green
Write-Host "   [ ] API Health Check accessible" -ForegroundColor White
Write-Host "   [ ] Connexion MySQL fonctionnelle" -ForegroundColor White
Write-Host "   [ ] Authentification réussie" -ForegroundColor White
Write-Host "   [ ] Socket.IO endpoint actif" -ForegroundColor White
Write-Host "   [ ] Tables MySQL lisibles" -ForegroundColor White

Write-Host "`n🔧 Si des tests échouent:" -ForegroundColor Yellow
Write-Host "   1. Vérifiez les variables dans Railway Dashboard" -ForegroundColor Gray
Write-Host "   2. Redéployez le service backend" -ForegroundColor Gray
Write-Host "   3. Attendez 2-3 minutes le démarrage" -ForegroundColor Gray
Write-Host "   4. Relancez ce script" -ForegroundColor Gray

Write-Host "`n📝 Fichiers de configuration:" -ForegroundColor Cyan
Write-Host "   - railway-variables.env (toutes les variables)" -ForegroundColor Gray
Write-Host "   - CONFIGURE-RAILWAY-VARIABLES.md (documentation)" -ForegroundColor Gray
Write-Host "   - SOCKET-IO-RAILWAY-GUIDE.md (guide Socket.IO)" -ForegroundColor Gray

Write-Host "`n🧪 Pour tester Socket.IO avec Node.js:" -ForegroundColor Cyan
Write-Host "   node test-socket-railway.js" -ForegroundColor White

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host ""
