# 🚀 DÉPLOIEMENT AUTOMATIQUE RENDER - TRACKING ENRICHI
# PowerShell script pour déployer sur Render

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🚀 DÉPLOIEMENT RENDER - TRACKING ENRICHI             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Vérifier qu'on est dans le bon dossier
if (!(Test-Path ".\backend") -or !(Test-Path ".\web-dashboard")) {
    Write-Host "❌ Erreur: Exécutez ce script depuis la racine du projet" -ForegroundColor Red
    exit 1
}

# ÉTAPE 1: Git status
Write-Host "📁 ÉTAPE 1: Vérification des modifications Git" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
git status --short
Write-Host ""

# ÉTAPE 2: Ajouter tous les fichiers
Write-Host "➕ ÉTAPE 2: Ajout des fichiers modifiés" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
git add .
Write-Host "✅ Tous les fichiers ajoutés" -ForegroundColor Green
Write-Host ""

# ÉTAPE 3: Commit
Write-Host "💾 ÉTAPE 3: Commit des modifications" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray

$commitMessage = @"
🎉 Add enriched real-time tracking system

Features:
- Battery API complete (charging, time remaining)
- Network info (WiFi/4G, speed, latency)
- Device info (OS, browser, screen state)
- Real-time statistics (distance, speed, consumption)
- Agent path tracking (polyline on map)
- AgentInfoPanel component with all enriched data
- Database migration for 21 new columns

Files:
- deviceInfoService.js (frontend)
- trackingStatsService.js (frontend & backend)
- AgentInfoPanel.jsx + CSS
- GeoTracking model updated
- EventDetails.jsx integrated
- Migration script
- Deployment guides
"@

git commit -m $commitMessage
Write-Host "✅ Commit effectué" -ForegroundColor Green
Write-Host ""

# ÉTAPE 4: Push GitHub
Write-Host "☁️  ÉTAPE 4: Push vers GitHub" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Code pushé sur GitHub avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors du push GitHub" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ÉTAPE 5: Instructions migration BDD
Write-Host "🗄️  ÉTAPE 5: Migration Base de Données" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  ACTION MANUELLE REQUISE:" -ForegroundColor Magenta
Write-Host ""
Write-Host "1. Ouvrir https://dashboard.render.com/" -ForegroundColor White
Write-Host "2. Aller sur votre service BACKEND" -ForegroundColor White
Write-Host "3. Cliquer sur l'onglet 'Shell'" -ForegroundColor White
Write-Host "4. Exécuter la commande suivante:" -ForegroundColor White
Write-Host ""
Write-Host "   cd /opt/render/project/src/backend" -ForegroundColor Cyan
Write-Host "   node src/migrations/add-enriched-tracking-columns.js" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Vérifier que vous voyez:" -ForegroundColor White
Write-Host "   ✅ Toutes les colonnes ont été ajoutées avec succès!" -ForegroundColor Green
Write-Host "   🎉 Migration terminée avec succès!" -ForegroundColor Green
Write-Host ""

$response = Read-Host "Avez-vous exécuté la migration ? (o/n)"
if ($response -ne "o") {
    Write-Host ""
    Write-Host "⏸️  Déploiement en pause. Exécutez la migration puis relancez ce script." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "✅ Migration confirmée" -ForegroundColor Green
Write-Host ""

# ÉTAPE 6: Redéploiement Render
Write-Host "🔄 ÉTAPE 6: Redéploiement Render" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  ACTION MANUELLE REQUISE:" -ForegroundColor Magenta
Write-Host ""
Write-Host "BACKEND:" -ForegroundColor Cyan
Write-Host "1. Dashboard Render → Backend Service" -ForegroundColor White
Write-Host "2. Cliquer 'Manual Deploy' → 'Deploy latest commit'" -ForegroundColor White
Write-Host "3. Attendre ~5 minutes (surveiller les logs)" -ForegroundColor White
Write-Host ""
Write-Host "FRONTEND:" -ForegroundColor Cyan
Write-Host "1. Dashboard Render → Frontend Service" -ForegroundColor White
Write-Host "2. Cliquer 'Manual Deploy' → 'Deploy latest commit'" -ForegroundColor White
Write-Host "3. Attendre ~10-15 minutes (build React)" -ForegroundColor White
Write-Host ""

$response = Read-Host "Déploiement terminé ? (o/n)"
if ($response -ne "o") {
    Write-Host ""
    Write-Host "⏸️  En attente du déploiement..." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "✅ Déploiement confirmé" -ForegroundColor Green
Write-Host ""

# ÉTAPE 7: Instructions test
Write-Host "🧪 ÉTAPE 7: Test de l'application" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Ouvrir dans votre navigateur:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   https://security-guard-web.onrender.com/events/c6b21e45-b24b-4b60-8f97-e61dbf00889a" -ForegroundColor Green
Write-Host ""
Write-Host "✅ VÉRIFICATIONS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   [ ] Indicateur '🟢 Suivi Temps Réel Actif' visible" -ForegroundColor White
Write-Host "   [ ] Tableau des agents affiché" -ForegroundColor White
Write-Host "   [ ] Clic sur un agent en ligne fonctionne" -ForegroundColor White
Write-Host "   [ ] Panneau d'infos s'ouvre à droite" -ForegroundColor White
Write-Host "   [ ] 5 sections visibles (GPS, Batterie, Réseau, Appareil, Stats)" -ForegroundColor White
Write-Host "   [ ] Données se mettent à jour en temps réel" -ForegroundColor White
Write-Host ""

# ÉTAPE 8: Récapitulatif
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🎉 DÉPLOIEMENT TERMINÉ !                             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Nouvelles fonctionnalités disponibles:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   ✅ Tracking GPS complet (altitude, vitesse, direction)" -ForegroundColor White
Write-Host "   ✅ Batterie complète (charge, temps restant)" -ForegroundColor White
Write-Host "   ✅ Réseau détaillé (type, vitesse, latence)" -ForegroundColor White
Write-Host "   ✅ Appareil complet (OS, navigateur, écran)" -ForegroundColor White
Write-Host "   ✅ Statistiques temps réel (distance, vitesse, etc.)" -ForegroundColor White
Write-Host "   ✅ Trajet sur carte (polyline)" -ForegroundColor White
Write-Host "   ✅ Panneau d'infos enrichies (AgentInfoPanel)" -ForegroundColor White
Write-Host ""
Write-Host "🌐 URLs Production:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Frontend:  https://security-guard-web.onrender.com" -ForegroundColor Green
Write-Host "   Backend:   https://security-guard-backend.onrender.com" -ForegroundColor Green
Write-Host "   EventDetails: /events/c6b21e45-b24b-4b60-8f97-e61dbf00889a" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   - TRACKING-ENRICHI-GUIDE.md (guide complet)" -ForegroundColor White
Write-Host "   - DEPLOY-RENDER-TRACKING-ENRICHI.md (déploiement)" -ForegroundColor White
Write-Host ""
Write-Host "💡 Prochaines étapes:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Tester avec de vrais agents" -ForegroundColor White
Write-Host "   2. Former les superviseurs" -ForegroundColor White
Write-Host "   3. Analyser les données collectées" -ForegroundColor White
Write-Host ""
Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""

# Ouvrir le navigateur automatiquement
Write-Host "🌐 Ouverture automatique du navigateur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "https://security-guard-web.onrender.com/events/c6b21e45-b24b-4b60-8f97-e61dbf00889a"

Write-Host ""
Write-Host "✅ Script terminé avec succès !" -ForegroundColor Green
Write-Host ""
