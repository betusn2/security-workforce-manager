# Switch to Render PostgreSQL Database
Write-Host "🔄 Switching to Render PostgreSQL Database" -ForegroundColor Cyan
Write-Host ""

# Step 1: Commit changes
Write-Host "📦 Step 1: Committing PostgreSQL support..." -ForegroundColor Yellow
git add backend/package.json backend/src/config/database.js RENDER-POSTGRES-SOLUTION.md
git commit -m "Add PostgreSQL support for Render database"

# Step 2: Push to GitHub
Write-Host "📤 Step 2: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "✅ Code changes pushed!" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📋 NEXT STEPS - Follow these carefully:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "🔷 STEP 1: Create PostgreSQL Database" -ForegroundColor Cyan
Write-Host "   1. Go to https://dashboard.render.com" -ForegroundColor White
Write-Host "   2. Click 'New +' → 'PostgreSQL'" -ForegroundColor White
Write-Host "   3. Settings:" -ForegroundColor White
Write-Host "      Name: security-guard-db" -ForegroundColor Gray
Write-Host "      Region: Frankfurt (EU Central)" -ForegroundColor Gray
Write-Host "      Plan: Free" -ForegroundColor Gray
Write-Host "   4. Click 'Create Database'" -ForegroundColor White
Write-Host "   5. Wait 2-3 minutes for database to be ready" -ForegroundColor White
Write-Host ""
Write-Host "🔷 STEP 2: Get Connection URL" -ForegroundColor Cyan
Write-Host "   1. On database page, find 'Internal Database URL'" -ForegroundColor White
Write-Host "   2. Copy the entire URL (starts with postgres://)" -ForegroundColor White
Write-Host ""
Write-Host "🔷 STEP 3: Update Backend Environment" -ForegroundColor Cyan
Write-Host "   1. Go to 'security-guard-backend' service" -ForegroundColor White
Write-Host "   2. Click 'Environment' in left menu" -ForegroundColor White
Write-Host "   3. DELETE these old variables:" -ForegroundColor Red
Write-Host "      - DB_HOST" -ForegroundColor Gray
Write-Host "      - DB_PORT" -ForegroundColor Gray
Write-Host "      - DB_USER" -ForegroundColor Gray
Write-Host "      - DB_PASSWORD" -ForegroundColor Gray
Write-Host "      - DB_NAME" -ForegroundColor Gray
Write-Host "      - DB_SSL" -ForegroundColor Gray
Write-Host "   4. ADD this NEW variable:" -ForegroundColor Green
Write-Host "      DATABASE_URL = [paste Internal Database URL]" -ForegroundColor Gray
Write-Host "   5. Click 'Save Changes'" -ForegroundColor White
Write-Host ""
Write-Host "🔷 STEP 4: Wait for Automatic Redeploy" -ForegroundColor Cyan
Write-Host "   • Render will automatically rebuild and redeploy" -ForegroundColor White
Write-Host "   • Check logs for:" -ForegroundColor White
Write-Host "     ✅ Database connection established successfully" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Full guide: RENDER-POSTGRES-SOLUTION.md" -ForegroundColor Blue
Write-Host ""
