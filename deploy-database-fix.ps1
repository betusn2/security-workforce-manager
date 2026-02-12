# Deploy Database Connection Fix to Render
Write-Host "🔧 Deploying Database Connection Fix" -ForegroundColor Cyan
Write-Host ""

# Step 1: Commit changes
Write-Host "📦 Step 1: Committing database config updates..." -ForegroundColor Yellow
git add backend/src/config/database.js render-env-variables.txt
git commit -m "Fix: Add SSL and improved connection handling for Railway database"

# Step 2: Push to GitHub
Write-Host "📤 Step 2: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "✅ Code changes pushed!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Now update Render environment variables:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to https://dashboard.render.com" -ForegroundColor White
Write-Host "2. Select 'security-guard-backend' service" -ForegroundColor White
Write-Host "3. Click 'Environment' in left menu" -ForegroundColor White
Write-Host "4. Update/Add these variables:" -ForegroundColor White
Write-Host ""
Write-Host "   DB_HOST = centerbeam.proxy.rlwy.net" -ForegroundColor Cyan
Write-Host "   DB_PORT = 13158" -ForegroundColor Cyan
Write-Host "   DB_PASSWORD = qiKrxloVWBcLjxmnUpStvvNTqLyyPHWQ" -ForegroundColor Cyan
Write-Host "   DB_SSL = true" -ForegroundColor Green -BackgroundColor Black
Write-Host ""
Write-Host "5. Click 'Save Changes'" -ForegroundColor White
Write-Host "6. Wait for automatic redeploy" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Or manually deploy:" -ForegroundColor Yellow
Write-Host "   - Go to 'Manual Deploy' → 'Clear build cache & deploy'" -ForegroundColor White
Write-Host ""
