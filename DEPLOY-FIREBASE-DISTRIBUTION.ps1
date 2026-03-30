# ============================================================
# DEPLOY-FIREBASE-DISTRIBUTION.ps1
# Script de déploiement APK vers Firebase App Distribution
# Usage: .\DEPLOY-FIREBASE-DISTRIBUTION.ps1
# ============================================================

param(
    [string]$FirebaseAppId = $env:FIREBASE_APP_ID,
    [string]$FirebaseToken = $env:FIREBASE_TOKEN,
    [string]$Groups = "security-guards,supervisors,admins",
    [string]$ReleaseNotes = "Nouvelle version Security Guard Mobile"
)

# App ID Firebase par défaut si non fourni
if (-not $FirebaseAppId) {
    $FirebaseAppId = "1:380656927574:android:dd8f0f6182a5b162560cf7"
}

$APK_PATH = ".\build\security-guard.apk"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  SECURITY GUARD — Firebase App Distribution" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier Firebase CLI
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installation Firebase CLI..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

# Vérifier EAS CLI
if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installation EAS CLI..." -ForegroundColor Yellow
    npm install -g eas-cli
}

Write-Host "✅ Outils prêts" -ForegroundColor Green
Write-Host ""

# ÉTAPE 1 : Build APK
Write-Host "🔨 ÉTAPE 1/3 : Build APK universelle..." -ForegroundColor Yellow
Write-Host "   Profile: firebase (toutes architectures Android)" -ForegroundColor Gray
Write-Host ""

Set-Location "mobile-app"

$buildOutput = eas build --profile firebase --platform android --local --output "../build/security-guard.apk" 2>&1
if ($LASTEXITCODE -ne 0) {
    # Essayer sans --local (build EAS cloud)
    Write-Host "⚠️  Build local échoué, tentative build EAS cloud..." -ForegroundColor Yellow
    eas build --profile firebase --platform android
    Write-Host ""
    Write-Host "✅ Build soumis à EAS. Une fois terminé, télécharger l'APK depuis:" -ForegroundColor Green
    Write-Host "   https://expo.dev/accounts/ahmadi58/projects/security-guard-mobile/builds" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Puis relancer ce script avec l'APK téléchargé dans ./build/security-guard.apk" -ForegroundColor Yellow
    Set-Location ".."
    exit 0
}

Set-Location ".."
Write-Host "✅ APK générée : $APK_PATH" -ForegroundColor Green
Write-Host ""

# ÉTAPE 2 : Connexion Firebase
Write-Host "🔑 ÉTAPE 2/3 : Connexion Firebase..." -ForegroundColor Yellow

if (-not $FirebaseToken) {
    Write-Host "   Connexion via navigateur..." -ForegroundColor Gray
    firebase login
} else {
    Write-Host "   Utilisation du token d'environnement" -ForegroundColor Gray
}
Write-Host ""

# ÉTAPE 3 : Upload vers Firebase App Distribution
Write-Host "🚀 ÉTAPE 3/3 : Upload vers Firebase App Distribution..." -ForegroundColor Yellow
Write-Host "   App ID : $FirebaseAppId" -ForegroundColor Gray
Write-Host "   Groupes : $Groups" -ForegroundColor Gray
Write-Host "   Notes   : $ReleaseNotes" -ForegroundColor Gray
Write-Host ""

if (-not $FirebaseAppId) {
    $FirebaseAppId = "1:380656927574:android:dd8f0f6182a5b162560cf7"
}

$uploadArgs = @(
    "appdistribution:distribute", $APK_PATH,
    "--app", $FirebaseAppId,
    "--groups", $Groups,
    "--release-notes", $ReleaseNotes
)

if ($FirebaseToken) {
    $uploadArgs += @("--token", $FirebaseToken)
}

& firebase @uploadArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host "  ✅ APK DISTRIBUÉE AVEC SUCCÈS !" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📧 Les utilisateurs des groupes suivants ont reçu un email :" -ForegroundColor White
    Write-Host "   • security-guards" -ForegroundColor Gray
    Write-Host "   • supervisors" -ForegroundColor Gray
    Write-Host "   • admins" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📊 Voir les installations :" -ForegroundColor White
    Write-Host "   https://console.firebase.google.com → App Distribution" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'upload Firebase" -ForegroundColor Red
    Write-Host "   Vérifier les logs ci-dessus" -ForegroundColor Yellow
    exit 1
}
