# ============================================
# Import des tables via Railway CLI
# ============================================

Write-Host "🚀 Import via Railway CLI..." -ForegroundColor Cyan

# Vérifier Railway CLI
$railwayCLI = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayCLI) {
    Write-Host "❌ Railway CLI non installé" -ForegroundColor Red
    Write-Host "Installation:" -ForegroundColor Yellow
    Write-Host "npm install -g @railway/cli" -ForegroundColor Green
    Write-Host ""
    Write-Host "Puis exécutez: railway login" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Railway CLI trouvé" -ForegroundColor Green

# Se connecter au projet
Write-Host "🔗 Connexion au projet Railway..." -ForegroundColor Yellow
Write-Host "Si demandé, sélectionnez:" -ForegroundColor White
Write-Host "  Projet: security-guard-deploy" -ForegroundColor Cyan
Write-Host "  Service: MySQL" -ForegroundColor Cyan
Write-Host ""

# Lire le fichier SQL
$sqlFile = "RAILWAY-CREATE-ALL-TABLES.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Fichier $sqlFile introuvable" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Fichier SQL trouvé" -ForegroundColor Green
$sqlContent = Get-Content $sqlFile -Raw

# Créer un fichier temporaire sans commentaires pour l'import
$cleanSql = $sqlContent -replace '--[^\r\n]*', '' -replace '(?m)^\s*$', ''
$tempFile = "temp-import.sql"
$cleanSql | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "📊 Import des tables..." -ForegroundColor Cyan
Write-Host "Commande Railway:" -ForegroundColor Yellow
Write-Host "railway connect MySQL" -ForegroundColor Green
Write-Host ""

# Exécuter via Railway
try {
    $result = railway run --service mysql mysql -u root -p railway < $tempFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Import réussi!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Erreur lors de l'import" -ForegroundColor Yellow
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
} finally {
    # Nettoyer
    if (Test-Path $tempFile) {
        Remove-Item $tempFile
    }
}

Write-Host ""
Write-Host "📝 ALTERNATIVE MANUELLE:" -ForegroundColor Yellow
Write-Host "1. Exécutez: railway login" -ForegroundColor White
Write-Host "2. Exécutez: railway link" -ForegroundColor White
Write-Host "3. Sélectionnez votre projet et le service MySQL" -ForegroundColor White
Write-Host "4. Exécutez: railway connect MySQL" -ForegroundColor White
Write-Host "5. Une fois connecté, copiez-collez le contenu de $sqlFile" -ForegroundColor White
