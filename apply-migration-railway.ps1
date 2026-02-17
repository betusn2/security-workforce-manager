# Script pour migrer les colonnes TEXT vers LONGTEXT sur Railway
# Raison: Les photos base64 dépassent la limite de 64KB de TEXT

Write-Host "🔧 Migration des colonnes photos vers LONGTEXT..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si le fichier SQL existe
if (-not (Test-Path "migrate-photos-to-longtext.sql")) {
    Write-Host "❌ Fichier migrate-photos-to-longtext.sql introuvable" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Migration SQL à appliquer:" -ForegroundColor Yellow
Get-Content "migrate-photos-to-longtext.sql" | Write-Host -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. Connectez-vous à Railway: https://railway.app/" -ForegroundColor White
Write-Host "2. Ouvrez votre projet 'security-workforce-manager'" -ForegroundColor White
Write-Host "3. Cliquez sur le service MySQL" -ForegroundColor White
Write-Host "4. Onglet 'Data' → 'Query'" -ForegroundColor White
Write-Host "5. Copiez le contenu du fichier SQL ci-dessus" -ForegroundColor White
Write-Host "6. Collez dans l'éditeur Query et cliquez 'Run'" -ForegroundColor White
Write-Host ""

Write-Host "📄 Contenu SQL copié dans le presse-papier!" -ForegroundColor Green

# Copier dans le presse-papier
Get-Content "migrate-photos-to-longtext.sql" | Set-Clipboard

Write-Host ""
Write-Host "✅ Migration prête - Collez dans Railway Query Editor" -ForegroundColor Green
Write-Host ""
Write-Host "Appuyez sur une touche pour ouvrir Railway Dashboard..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Start-Process "https://railway.app/project"

Write-Host "🚀 Après la migration, le backend se redéploiera automatiquement" -ForegroundColor Cyan
