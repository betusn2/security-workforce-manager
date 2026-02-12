# 🔄 Tentative de connexion Railway MySQL depuis Render

Write-Host "🔄 Configuration pour Railway MySQL..." -ForegroundColor Cyan
Write-Host ""

# Commit changes
git add backend/src/config/database.js render-env-variables.txt
git commit -m "Config: Optimize Railway MySQL connection from Render"
git push origin main

Write-Host ""
Write-Host "✅ Code déployé!" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "⚙️  CONFIGURATION RENDER - Variables Backend" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "1. Allez sur: https://dashboard.render.com" -ForegroundColor White
Write-Host "2. Cliquez: security-guard-backend → Environment" -ForegroundColor White
Write-Host ""
Write-Host "3. SUPPRIMEZ la variable:" -ForegroundColor Red
Write-Host "   ❌ DATABASE_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "4. AJOUTEZ/MODIFIEZ ces variables:" -ForegroundColor Green
Write-Host ""
Write-Host "   DB_HOST = centerbeam.proxy.rlwy.net" -ForegroundColor Cyan
Write-Host "   DB_PORT = 13158" -ForegroundColor Cyan
Write-Host "   DB_USER = root" -ForegroundColor Cyan
Write-Host "   DB_PASSWORD = qiKrxloVWBcLjxmnUpStvvNTqLyyPHWQ" -ForegroundColor Cyan
Write-Host "   DB_NAME = railway" -ForegroundColor Cyan
Write-Host "   DB_DIALECT = mysql" -ForegroundColor Cyan
Write-Host ""
Write-Host "   FRONTEND_URL = https://security-guard-web.onrender.com" -ForegroundColor Cyan
Write-Host "   SOCKET_CORS_ORIGIN = https://security-guard-web.onrender.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Cliquez: Save Changes" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  ATTENTION:" -ForegroundColor Yellow
Write-Host "   Railway tier gratuit peut bloquer les connexions externes." -ForegroundColor White
Write-Host "   Si ça ne fonctionne pas, vous devrez:" -ForegroundColor White
Write-Host "   • Soit passer Railway à un plan payant" -ForegroundColor White
Write-Host "   • Soit utiliser PostgreSQL Render (gratuit, même réseau)" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Vérifier les logs après déploiement:" -ForegroundColor Yellow
Write-Host "   Render Dashboard → security-guard-backend → Logs" -ForegroundColor White
Write-Host ""
Write-Host "✅ Succès attendu:" -ForegroundColor Green
Write-Host "   'Database connection established successfully'" -ForegroundColor Gray
Write-Host ""
Write-Host "❌ Si erreur ETIMEDOUT ou ECONNREFUSED:" -ForegroundColor Red
Write-Host "   Railway bloque la connexion externe" -ForegroundColor Gray
Write-Host "   → Utilisez PostgreSQL Render à la place" -ForegroundColor Gray
Write-Host ""
