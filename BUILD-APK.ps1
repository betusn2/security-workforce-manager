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

# ── 4. Vérifier / Login Expo ──────────────────────────────────────────────────
Write-Host "`n[4/5] Vérification du compte Expo..." -ForegroundColor Yellow

$whoami = eas whoami 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Déjà connecté en tant que : $whoami" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Non connecté — lancement du login..." -ForegroundColor Gray
    Write-Host "ℹ️  Compte : ahmadi58  (https://expo.dev)" -ForegroundColor Gray
    eas login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Login échoué. Réessayer avec : eas login" -ForegroundColor Red
        exit 1
    }
}

# ── 5. Build APK ──────────────────────────────────────────────────────────────
Write-Host "`n[5/5] Build APK Android (profil: preview)..." -ForegroundColor Yellow
Write-Host "⏳ La compilation prend ~10-15 minutes dans le cloud Expo..." -ForegroundColor Gray

eas build --platform android --profile preview --non-interactive

Write-Host "`n✅ Build lancé !" -ForegroundColor Green
Write-Host "📊 Suivre : https://expo.dev/accounts/ahmadi58/projects/security-guard-mobile/builds" -ForegroundColor Cyan
Write-Host "📱 Le lien de téléchargement APK sera disponible à la fin du build." -ForegroundColor Green
