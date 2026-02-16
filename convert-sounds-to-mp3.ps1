# Script PowerShell pour convertir les sons WAV en MP3
# Nécessite FFmpeg installé: choco install ffmpeg

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎵 CONVERSION WAV → MP3" -ForegroundColor Cyan
Write-Host "   Security Workforce Manager - Sons Login/Logout" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Vérifier si FFmpeg est installé
$ffmpegInstalled = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (-not $ffmpegInstalled) {
    Write-Host "❌ FFmpeg n'est pas installé!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 Installation avec Chocolatey (recommandé):" -ForegroundColor Yellow
    Write-Host "   1. Installer Chocolatey: https://chocolatey.org/install" -ForegroundColor Gray
    Write-Host "   2. Exécuter: choco install ffmpeg" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📥 OU télécharger manuellement:" -ForegroundColor Yellow
    Write-Host "   https://ffmpeg.org/download.html" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ FFmpeg détecté" -ForegroundColor Green
Write-Host ""

# Liste des fichiers à convertir
$files = @(
    "login-start.wav",
    "login-success.wav",
    "login-error.wav",
    "logout.wav"
)

# Vérifier que les fichiers WAV existent
$allFilesExist = $true
foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Fichier manquant: $file" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host ""
    Write-Host "⚠️  Générez d'abord les sons WAV:" -ForegroundColor Yellow
    Write-Host "   node generate-login-sounds.js" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "📁 Fichiers WAV trouvés:" -ForegroundColor Cyan
foreach ($file in $files) {
    $size = (Get-Item $file).Length / 1KB
    Write-Host "   ✅ $file ($([math]::Round($size, 1)) KB)" -ForegroundColor Gray
}
Write-Host ""

# Créer le dossier de sortie si nécessaire
$outputDir = "frontend\public\sounds"
if (-not (Test-Path $outputDir)) {
    Write-Host "📂 Création du dossier: $outputDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "🔄 Conversion en cours..." -ForegroundColor Cyan
Write-Host ""

$totalConverted = 0
$totalFailed = 0

foreach ($file in $files) {
    $outputFile = $file -replace "\.wav$", ".mp3"
    $outputPath = Join-Path $outputDir $outputFile
    
    Write-Host "   🎵 $file → $outputFile" -NoNewline
    
    # Conversion avec FFmpeg
    # -i: input file
    # -b:a 128k: bitrate audio 128 kbps
    # -ar 44100: sample rate 44.1 kHz
    # -ac 1: mono channel
    # -y: overwrite output file
    $process = Start-Process -FilePath "ffmpeg" `
        -ArgumentList "-i `"$file`" -b:a 128k -ar 44100 -ac 1 -y `"$outputPath`"" `
        -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput "nul" `
        -RedirectStandardError "error.log"
    
    if ($process.ExitCode -eq 0) {
        $mp3Size = (Get-Item $outputPath).Length / 1KB
        Write-Host " ✅ ($([math]::Round($mp3Size, 1)) KB)" -ForegroundColor Green
        $totalConverted++
    } else {
        Write-Host " ❌ Erreur" -ForegroundColor Red
        $totalFailed++
        
        # Afficher l'erreur
        if (Test-Path "error.log") {
            $errorContent = Get-Content "error.log" -Raw
            Write-Host "     Erreur: $errorContent" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "   ✅ Convertis: $totalConverted fichiers" -ForegroundColor Green
if ($totalFailed -gt 0) {
    Write-Host "   ❌ Échoués: $totalFailed fichiers" -ForegroundColor Red
}
Write-Host ""
Write-Host "📂 Fichiers MP3 disponibles dans:" -ForegroundColor Cyan
Write-Host "   $outputDir" -ForegroundColor Gray
Write-Host ""

if ($totalConverted -gt 0) {
    # Liste des fichiers MP3 créés
    Get-ChildItem -Path $outputDir -Filter "*.mp3" | ForEach-Object {
        $size = $_.Length / 1KB
        Write-Host "   📄 $($_.Name) - $([math]::Round($size, 1)) KB" -ForegroundColor Gray
    }
    Write-Host ""
}

# Clean up
if (Test-Path "error.log") {
    Remove-Item "error.log" -Force
}

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 PROCHAINES ÉTAPES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Mettre à jour soundEffects.js:" -ForegroundColor Yellow
Write-Host "   Ajouter les nouveaux sons dans le fichier:" -ForegroundColor Gray
Write-Host "   frontend/src/utils/soundEffects.js" -ForegroundColor Gray
Write-Host ""
Write-Host "   Exemple:" -ForegroundColor Gray
Write-Host "   const sounds = {" -ForegroundColor DarkGray
Write-Host "     'login-start': new Audio('/sounds/login-start.mp3')," -ForegroundColor DarkGray
Write-Host "     'login-success': new Audio('/sounds/login-success.mp3')," -ForegroundColor DarkGray
Write-Host "     'login-error': new Audio('/sounds/login-error.mp3')," -ForegroundColor DarkGray
Write-Host "     'logout': new Audio('/sounds/logout.mp3')" -ForegroundColor DarkGray
Write-Host "   };" -ForegroundColor DarkGray
Write-Host ""
Write-Host "2. Intégrer dans Login.jsx:" -ForegroundColor Yellow
Write-Host "   import soundEffects from '../utils/soundEffects';" -ForegroundColor Gray
Write-Host "   soundEffects.play('login-start'); // Au clic login" -ForegroundColor Gray
Write-Host "   soundEffects.play('login-success'); // Après succès" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Tester dans le browser:" -ForegroundColor Yellow
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Déployer sur Vercel:" -ForegroundColor Yellow
Write-Host "   git add frontend/public/sounds/*.mp3" -ForegroundColor Gray
Write-Host "   git commit -m `"Add login/logout sound effects`"" -ForegroundColor Gray
Write-Host "   git push" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Documentation complète dans:" -ForegroundColor Green
Write-Host "   RECAP-LOGIN-SONS-APPS.md" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Conversion terminée avec succès!" -ForegroundColor Green
Write-Host ""
