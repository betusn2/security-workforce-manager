################################################################################
# BUILD-APK-LOCAL.ps1 — Build APK Android en LOCAL (sans EAS Cloud)
# Prérequis : Android Studio + SDK installés, JAVA_HOME configuré
# Usage    : .\BUILD-APK-LOCAL.ps1 [-Release] [-Bundle]
################################################################################
param(
    [switch]$Release,    # Build Release signé (APK de production)
    [switch]$Bundle,     # Build AAB (Google Play Store)
    [switch]$Clean       # Nettoyer avant de builder
)

$MobileDir = "$PSScriptRoot\mobile-app"
$AndroidDir = "$MobileDir\android"

function Write-Step($n, $total, $msg) {
    Write-Host "`n[$n/$total] $msg" -ForegroundColor Yellow
}
function Write-OK($msg)  { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-ERR($msg) { Write-Host "❌ $msg" -ForegroundColor Red; exit 1 }
function Write-INFO($msg){ Write-Host "ℹ️  $msg" -ForegroundColor Cyan }

$TOTAL_STEPS = 6

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       Security Guard Mobile — Build APK LOCAL (Gradle)      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
if ($Release) { Write-INFO "Mode : RELEASE (APK signé)" }
elseif ($Bundle) { Write-INFO "Mode : BUNDLE AAB (Google Play)" }
else { Write-INFO "Mode : DEBUG (test rapide)" }

# ── 1. Vérifications prérequis ──────────────────────────────────────────────
Write-Step 1 $TOTAL_STEPS "Vérification des prérequis..."

# Node.js
node --version 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-ERR "Node.js introuvable — https://nodejs.org" }
Write-OK "Node.js : $(node --version)"

# Java
java -version 2>&1 | Select-Object -First 1 | Out-Null
if ($LASTEXITCODE -ne 0 -and -not $env:JAVA_HOME) {
    Write-ERR "Java introuvable. Installer JDK 17+ ou configurer JAVA_HOME"
}
Write-OK "Java détecté"

# Android SDK
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    Write-Host "⚠️  ANDROID_HOME non défini. Cherche Android Studio..." -ForegroundColor Magenta
    $defaultSDK = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $defaultSDK) {
        $env:ANDROID_HOME = $defaultSDK
        $env:ANDROID_SDK_ROOT = $defaultSDK
        $env:PATH += ";$defaultSDK\tools;$defaultSDK\platform-tools"
        Write-OK "Android SDK trouvé : $defaultSDK"
    } else {
        Write-Host "⚠️  Android SDK introuvable. Certaines étapes peuvent échouer." -ForegroundColor Magenta
        Write-INFO "Installer Android Studio : https://developer.android.com/studio"
    }
}

# ── 2. Installation dépendances npm ─────────────────────────────────────────
Write-Step 2 $TOTAL_STEPS "Installation des dépendances npm..."
Set-Location $MobileDir
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) { Write-ERR "npm install échoué" }
Write-OK "Dépendances installées"

# ── 3. Expo Prebuild (régénère le code natif Android) ──────────────────────
Write-Step 3 $TOTAL_STEPS "Expo Prebuild — génération du code natif Android..."
Write-INFO "Ceci synchronise app.json ↔ android/ (permissions, icons, splash...)"

npx expo prebuild --platform android --no-install 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Prebuild signale des avertissements — on continue" -ForegroundColor Magenta
}
Write-OK "Prebuild terminé"

# ── 4. Nettoyage (optionnel) ─────────────────────────────────────────────────
if ($Clean) {
    Write-Step 4 $TOTAL_STEPS "Nettoyage Gradle (clean)..."
    Set-Location $AndroidDir
    .\gradlew clean
    Write-OK "Clean terminé"
} else {
    Write-INFO "Étape 4/6 — Nettoyage ignoré (utiliser -Clean pour forcer)"
}

# ── 5. Build ─────────────────────────────────────────────────────────────────
Write-Step 5 $TOTAL_STEPS "Compilation Android avec Gradle..."
Set-Location $AndroidDir

if ($Bundle) {
    Write-INFO "Build AAB (bundle) — pour Google Play Store..."
    .\gradlew bundleRelease
    if ($LASTEXITCODE -ne 0) { Write-ERR "Gradle bundleRelease échoué" }
    $OUTPUT = "app\build\outputs\bundle\release\app-release.aab"
    $ARTIFACT_TYPE = "AAB"
} elseif ($Release) {
    Write-INFO "Build APK Release signé..."
    .\gradlew assembleRelease
    if ($LASTEXITCODE -ne 0) { Write-ERR "Gradle assembleRelease échoué" }
    $OUTPUT = "app\build\outputs\apk\release\app-release.apk"
    $ARTIFACT_TYPE = "APK Release"
} else {
    Write-INFO "Build APK Debug (rapide)..."
    .\gradlew assembleDebug
    if ($LASTEXITCODE -ne 0) { Write-ERR "Gradle assembleDebug échoué" }
    $OUTPUT = "app\build\outputs\apk\debug\app-debug.apk"
    $ARTIFACT_TYPE = "APK Debug"
}
Write-OK "Compilation Gradle réussie"

# ── 6. Résultat ──────────────────────────────────────────────────────────────
Write-Step 6 $TOTAL_STEPS "Fichier généré..."
$FullOutputPath = Join-Path $AndroidDir $OUTPUT

if (Test-Path $FullOutputPath) {
    $size = (Get-Item $FullOutputPath).Length / 1MB
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ BUILD RÉUSSI — $ARTIFACT_TYPE" -ForegroundColor Green
    Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  📦 Taille  : $([math]::Round($size, 1)) MB" -ForegroundColor White
    Write-Host "  📂 Fichier : $FullOutputPath" -ForegroundColor White
    Write-Host ""

    # Copier vers la racine du projet pour accès rapide
    $DestName = if ($Bundle) { "security-guard.aab" } elseif ($Release) { "security-guard-release.apk" } else { "security-guard-debug.apk" }
    $Dest = "$PSScriptRoot\$DestName"
    Copy-Item $FullOutputPath $Dest -Force
    Write-Host "  📱 Copié   : $Dest" -ForegroundColor Cyan
    Write-Host ""

    if (-not $Bundle) {
        Write-Host "  Pour installer sur un téléphone connecté en USB :" -ForegroundColor Gray
        Write-Host "    adb install -r `"$Dest`"" -ForegroundColor Gray
    }
} else {
    Write-ERR "Fichier de sortie introuvable : $FullOutputPath"
}

Set-Location $PSScriptRoot
