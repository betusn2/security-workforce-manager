################################################################################
# BUILD-APK.ps1  —  Build Android APK via EAS Build (Expo Application Services)
# Usage: .\BUILD-APK.ps1
################################################################################

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Security Guard Mobile — Build APK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Aller dans le dossier mobile
Set-Location "$PSScriptRoot\mobile-app"

# ── 1. Vérifier Node.js ───────────────────────────────────────────────────────
Write-Host "`n[1/5] Vérification Node.js..." -ForegroundColor Yellow
node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js non trouvé. Installer depuis https://nodejs.org" -ForegroundColor Red
    exit 1
}

# ── 2. Installer les dépendances ──────────────────────────────────────────────
Write-Host "`n[2/5] Installation dépendances npm..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install échoué" -ForegroundColor Red
    exit 1
}

# ── 3. Installer eas-cli globally ─────────────────────────────────────────────
Write-Host "`n[3/5] Installation EAS CLI..." -ForegroundColor Yellow
npm install -g eas-cli
eas --version

# ── 4. Login Expo ─────────────────────────────────────────────────────────────
Write-Host "`n[4/5] Login compte Expo (nécessaire pour EAS Build)..." -ForegroundColor Yellow
Write-Host "ℹ️  Créer un compte gratuit sur https://expo.dev si besoin" -ForegroundColor Gray
eas login

# ── 5. Build APK ──────────────────────────────────────────────────────────────
Write-Host "`n[5/5] Build APK Android (profil: preview)..." -ForegroundColor Yellow
Write-Host "⏳ La compilation prend ~10-15 minutes dans le cloud Expo..." -ForegroundColor Gray

eas build --platform android --profile preview --non-interactive

Write-Host "`n✅ Build lancé ! Suivre la progression sur https://expo.dev/accounts/[compte]/projects/security-guard-mobile/builds" -ForegroundColor Green
Write-Host "📱 Le lien de téléchargement APK sera disponible à la fin du build." -ForegroundColor Green
