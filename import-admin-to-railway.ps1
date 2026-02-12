# Import Admin User to Railway MySQL Database
Write-Host "🔄 Importing admin user to Railway MySQL..." -ForegroundColor Cyan

# Railway MySQL Connection Details
$DB_HOST = "centerbeam.proxy.rlwy.net"
$DB_PORT = "13158"
$DB_USER = "root"
$DB_PASSWORD = "qiKrxloVWBcLjxmnUpStvvNTqLyyPHWQ"
$DB_NAME = "railway"

# Check if mysql client is available
$mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue

if (-not $mysqlCommand) {
    Write-Host "❌ MySQL client not found. Installing via chocolatey..." -ForegroundColor Yellow
    Write-Host "Please install MySQL client manually or via: choco install mysql" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Use Railway Dashboard → MySQL → Query tab" -ForegroundColor Green
    Write-Host "Run this SQL directly:" -ForegroundColor Green
    Write-Host ""
    Get-Content -Path "test-admin-query.sql"
    exit 1
}

# Import admin user
Write-Host "📥 Importing admin user..." -ForegroundColor Yellow

# Execute SQL file
$env:MYSQL_PWD = $DB_PASSWORD
Get-Content -Path "test-admin-query.sql" | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Admin user imported successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Login credentials:" -ForegroundColor Cyan
    Write-Host "Email: admin@example.com" -ForegroundColor White
    Write-Host "Password: (use the password from your backend)" -ForegroundColor White
    Write-Host "CIN: ADMIN001" -ForegroundColor White
} else {
    Write-Host "❌ Import failed. Error code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host ""
    Write-Host "Use Railway Dashboard → MySQL → Query tab instead:" -ForegroundColor Yellow
    Write-Host ""
    Get-Content -Path "test-admin-query.sql"
}

# Clear password from environment
$env:MYSQL_PWD = $null
