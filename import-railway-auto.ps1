# ============================================
# SCRIPT AUTOMATIQUE D'IMPORTATION SQL
# Railway MySQL Database - 23 Tables
# ============================================

Write-Host "🚀 IMPORTATION AUTOMATIQUE - Railway Security Database" -ForegroundColor Cyan
Write-Host "=" -ForegroundColor Gray

# Configuration Railway
$RAILWAY_HOST = "mainline.proxy.rlwy.net"
$RAILWAY_PORT = "20601"
$RAILWAY_USER = "root"
$RAILWAY_PASSWORD = "lZSPaiVeXVPgcVbHQVehucJSdUuahlHS"
$RAILWAY_DB = "railway"
$SQL_FILE = "RAILWAY-ALL-TABLES.sql"

# Vérifier que le fichier SQL existe
if (-not (Test-Path $SQL_FILE)) {
    Write-Host "❌ ERREUR: Fichier $SQL_FILE introuvable!" -ForegroundColor Red
    Write-Host "📍 Assurez-vous d'être dans le bon répertoire." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Fichier SQL trouvé: $SQL_FILE" -ForegroundColor Green

# Option 1: Via Railway CLI (Recommandé)
Write-Host "`n📦 Vérification de Railway CLI..." -ForegroundColor Cyan

$railwayCli = Get-Command railway -ErrorAction SilentlyContinue
if ($railwayCli) {
    Write-Host "✅ Railway CLI installé" -ForegroundColor Green
    
    Write-Host "`n🔄 Méthode 1: Utilisation de Railway CLI..." -ForegroundColor Cyan
    Write-Host "📝 Commande: railway connect railway < $SQL_FILE" -ForegroundColor Gray
    
    $response = Read-Host "`n⚠️  Voulez-vous exécuter via Railway CLI? (o/n)"
    if ($response -eq "o" -or $response -eq "O") {
        Write-Host "🚀 Exécution en cours..." -ForegroundColor Yellow
        try {
            Get-Content $SQL_FILE | railway connect railway
            Write-Host "`n✅ IMPORTATION RÉUSSIE via Railway CLI!" -ForegroundColor Green
            exit 0
        }
        catch {
            Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "⚠️  Railway CLI non installé" -ForegroundColor Yellow
    Write-Host "📦 Installation: npm install -g @railway/cli" -ForegroundColor Gray
}

# Option 2: Via MySQL Client
Write-Host "`n📦 Vérification de MySQL Client..." -ForegroundColor Cyan

$mysqlCli = Get-Command mysql -ErrorAction SilentlyContinue
if ($mysqlCli) {
    Write-Host "✅ MySQL Client installé" -ForegroundColor Green
    
    Write-Host "`n🔄 Méthode 2: Utilisation de MySQL Client..." -ForegroundColor Cyan
    Write-Host "📝 Connexion: $RAILWAY_USER@$RAILWAY_HOST:$RAILWAY_PORT/$RAILWAY_DB" -ForegroundColor Gray
    
    $response = Read-Host "`n⚠️  Voulez-vous exécuter via MySQL Client? (o/n)"
    if ($response -eq "o" -or $response -eq "O") {
        Write-Host "🚀 Exécution en cours..." -ForegroundColor Yellow
        
        # Créer un fichier temporaire avec la config
        $tempConfig = "my_temp.cnf"
        $configContent = @"
[client]
host=$RAILWAY_HOST
port=$RAILWAY_PORT
user=$RAILWAY_USER
password=$RAILWAY_PASSWORD
database=$RAILWAY_DB
"@
        $configContent | Out-File -FilePath $tempConfig -Encoding ASCII
        
        try {
            mysql --defaults-extra-file=$tempConfig < $SQL_FILE
            Write-Host "`n✅ IMPORTATION RÉUSSIE via MySQL Client!" -ForegroundColor Green
            Remove-Item $tempConfig -Force
            exit 0
        }
        catch {
            Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
            Remove-Item $tempConfig -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "⚠️  MySQL Client non installé" -ForegroundColor Yellow
    Write-Host "📦 Installation: https://dev.mysql.com/downloads/mysql/" -ForegroundColor Gray
}

# Option 3: Méthode manuelle
Write-Host "`n📋 MÉTHODE MANUELLE (Recommandée si aucun outil installé):" -ForegroundColor Cyan
Write-Host "=" -ForegroundColor Gray

Write-Host "`n1️⃣  MYSQL WORKBENCH:" -ForegroundColor Yellow
Write-Host "   📍 Host: $RAILWAY_HOST" -ForegroundColor White
Write-Host "   📍 Port: $RAILWAY_PORT" -ForegroundColor White
Write-Host "   📍 User: $RAILWAY_USER" -ForegroundColor White
Write-Host "   📍 Password: $RAILWAY_PASSWORD" -ForegroundColor White
Write-Host "   📍 Database: $RAILWAY_DB" -ForegroundColor White
Write-Host "   📝 Ouvrir le fichier: $SQL_FILE" -ForegroundColor White
Write-Host "   ⚡ Exécuter le script (Ctrl+Shift+Enter)" -ForegroundColor White

Write-Host "`n2️⃣  RAILWAY DASHBOARD:" -ForegroundColor Yellow
Write-Host "   🌐 https://railway.app/dashboard" -ForegroundColor White
Write-Host "   📂 Projet: security-guard-deploy" -ForegroundColor White
Write-Host "   🗄️  Service: security-guard-db" -ForegroundColor White
Write-Host "   📝 Onglet 'Query'" -ForegroundColor White
Write-Host "   📋 Copier-coller le contenu de $SQL_FILE" -ForegroundColor White
Write-Host "   ▶️  Cliquer 'Run'" -ForegroundColor White

Write-Host "`n3️⃣  COPIER LES CREDENTIALS:" -ForegroundColor Yellow
$response = Read-Host "   Voulez-vous copier les credentials dans le presse-papier? (o/n)"
if ($response -eq "o" -or $response -eq "O") {
    $credentials = @"
Host: $RAILWAY_HOST
Port: $RAILWAY_PORT
User: $RAILWAY_USER
Password: $RAILWAY_PASSWORD
Database: $RAILWAY_DB
"@
    $credentials | Set-Clipboard
    Write-Host "   ✅ Credentials copiés dans le presse-papier!" -ForegroundColor Green
}

# Statistiques du fichier SQL
Write-Host "`n📊 STATISTIQUES DU FICHIER SQL:" -ForegroundColor Cyan
$sqlContent = Get-Content $SQL_FILE -Raw
$tableCount = ([regex]::Matches($sqlContent, "CREATE TABLE")).Count
$insertCount = ([regex]::Matches($sqlContent, "INSERT INTO")).Count
$fileSize = (Get-Item $SQL_FILE).Length / 1KB

Write-Host "   📦 Tables à créer: $tableCount" -ForegroundColor White
Write-Host "   📝 Instructions INSERT: $insertCount" -ForegroundColor White
Write-Host "   💾 Taille du fichier: $([math]::Round($fileSize, 2)) KB" -ForegroundColor White

Write-Host "`n✅ APRÈS L'EXÉCUTION, VÉRIFIEZ:" -ForegroundColor Green
Write-Host "   1. Se connecter au frontend: https://security-workforce-manager.vercel.app" -ForegroundColor White
Write-Host "   2. Email: admin@security.com" -ForegroundColor White
Write-Host "   3. Password: Admin123!" -ForegroundColor White
Write-Host "   4. Vérifier le dashboard et les fonctionnalités" -ForegroundColor White

Write-Host "`n🎉 Bonne chance avec votre importation!" -ForegroundColor Cyan
Write-Host "=" -ForegroundColor Gray

# Ouvrir le fichier SQL dans l'éditeur par défaut
$open = Read-Host "`n📝 Voulez-vous ouvrir le fichier SQL dans l'éditeur? (o/n)"
if ($open -eq "o" -or $open -eq "O") {
    Start-Process $SQL_FILE
}

Write-Host "`n✨ Script terminé." -ForegroundColor Cyan
