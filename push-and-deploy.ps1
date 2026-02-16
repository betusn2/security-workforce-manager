# ============================================================
# SCRIPT DE PUSH GITHUB ET PREPARATION DEPLOIEMENT
# ============================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     🚀 PUSH GITHUB + PREPARATION DEPLOIEMENT           ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Vérifier Git
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host "❌ Git n'est pas installé!" -ForegroundColor Red
    exit 1
}

# Statut Git
Write-Host "📋 Statut actuel:" -ForegroundColor Yellow
git status --short

# Demander confirmation
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
$message = Read-Host "📝 Message de commit (ou Enter pour 'Update deployment config')"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update deployment configuration for Vercel and Render"
}

Write-Host "`n🔄 Ajout des fichiers..." -ForegroundColor Yellow
git add .

Write-Host "💾 Commit..." -ForegroundColor Yellow
git commit -m $message

Write-Host "📤 Push vers GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Code poussé sur GitHub avec succès!" -ForegroundColor Green
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "📚 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan
    
    Write-Host "1️⃣  RENDER (Backend):" -ForegroundColor Cyan
    Write-Host "    → https://dashboard.render.com" -ForegroundColor White
    Write-Host "    → New + > Web Service" -ForegroundColor Gray
    Write-Host "    → Repository: betusn2/security-workforce-manager" -ForegroundColor Gray
    Write-Host "    → Root Directory: backend`n" -ForegroundColor Gray
    
    Write-Host "2️⃣  VERCEL (Frontend):" -ForegroundColor Cyan
    Write-Host "    → https://vercel.com/new" -ForegroundColor White
    Write-Host "    → Import: betusn2/security-workforce-manager" -ForegroundColor Gray
    Write-Host "    → Root Directory: web-dashboard`n" -ForegroundColor Gray
    
    Write-Host "3️⃣  GUIDE COMPLET:" -ForegroundColor Cyan
    Write-Host "    → Voir: DEPLOY-VERCEL-RENDER-GUIDE.md" -ForegroundColor White
    Write-Host "    → Quick: DEPLOY-QUICKSTART.md`n" -ForegroundColor White
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "🎉 Prêt pour le déploiement!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Erreur lors du push!" -ForegroundColor Red
    Write-Host "Vérifiez votre connexion et réessayez." -ForegroundColor Yellow
}

Write-Host "`nAppuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
