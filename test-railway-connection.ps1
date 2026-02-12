# 🔄 Connexion Railway MySQL - Configuration Optimisée

Write-Host "🔄 Optimisation connexion Railway MySQL..." -ForegroundColor Cyan
Write-Host ""

git add backend/src/config/database.js
git commit -m "Fix: Optimize Railway MySQL connection with extended timeouts and retries"
git push origin main

Write-Host ""
Write-Host "✅ Code déployé!" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🔍 VÉRIFIEZ RAILWAY - Connexions Publiques" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "1. Sur Railway, dans MySQL → Settings → Networking" -ForegroundColor White
Write-Host "   Vérifiez que vous voyez:" -ForegroundColor White
Write-Host ""
Write-Host "   ✅ Public Networking: ENABLED" -ForegroundColor Green
Write-Host "   ✅ TCP Proxy: centerbeam.proxy.rlwy.net:13158" -ForegroundColor Green
Write-Host ""
Write-Host "2. Testez la connexion depuis votre PC:" -ForegroundColor White
Write-Host ""
Write-Host "   mysql -h centerbeam.proxy.rlwy.net -P 13158 -u root -p" -ForegroundColor Cyan
Write-Host "   # Entrez le mot de passe: qiKrxloVWBcLjxmnUpStvvNTqLyyPHWQ" -ForegroundColor Gray
Write-Host ""
Write-Host "   Si ça fonctionne depuis votre PC mais pas depuis Render," -ForegroundColor Yellow
Write-Host "   Railway bloque peut-être les IPs de Render." -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "⚙️  VARIABLES RENDER (Vérifiez qu'elles sont exactes)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "DB_HOST=centerbeam.proxy.rlwy.net" -ForegroundColor Cyan
Write-Host "DB_PORT=13158" -ForegroundColor Cyan
Write-Host "DB_USER=root" -ForegroundColor Cyan
Write-Host "DB_PASSWORD=qiKrxloVWBcLjxmnUpStvvNTqLyyPHWQ" -ForegroundColor Cyan
Write-Host "DB_NAME=railway" -ForegroundColor Cyan
Write-Host "DB_DIALECT=mysql" -ForegroundColor Cyan
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🚨 SOLUTION ALTERNATIVE" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "Si Railway continue de refuser Render, vous avez 2 options:" -ForegroundColor White
Write-Host ""
Write-Host "Option 1: Déployer le BACKEND aussi sur Railway" -ForegroundColor Yellow
Write-Host "   • Backend Railway ↔ MySQL Railway (même réseau privé)" -ForegroundColor Gray
Write-Host "   • Frontend Render OR Vercel" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Utiliser PostgreSQL Render (déjà créé)" -ForegroundColor Yellow
Write-Host "   • Backend Render ↔ PostgreSQL Render (même réseau)" -ForegroundColor Gray
Write-Host "   • Garanti de fonctionner" -ForegroundColor Gray
Write-Host ""
Write-Host "Voulez-vous essayer l'Option 1 (Backend sur Railway)? 🤔" -ForegroundColor Cyan
Write-Host ""
