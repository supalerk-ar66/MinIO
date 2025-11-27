Write-Host "=== MARKET PROJECT AUTO SETUP ===" -ForegroundColor Cyan

# ---- 1. ตรวจสอบ Node ----
Write-Host "`nChecking Node.js version..."
$nodeVersion = node -v
if ($nodeVersion) {
    Write-Host "Node.js detected: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "ERROR: Node.js not found. Install Node 18+ first." -ForegroundColor Red
    exit 1
}

# ---- 2. ตรวจสอบ Docker ----
Write-Host "`nChecking Docker Desktop..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker Desktop not installed." -ForegroundColor Red
    exit 1
}

# ---- 3. ตรวจสอบ Git ----
Write-Host "`nChecking Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed." -ForegroundColor Red
    exit 1
}

# ---- 4. Clone โปรเจกต์ ถ้ายังไม่มี ----
$projectDir = "market"

if (-Not (Test-Path $projectDir)) {
    Write-Host "`nCloning project repository..."
    git clone https://github.com/supalerk-ar66/MinIO.git
} else {
    Write-Host "`nProject directory already exists. Skipping clone." -ForegroundColor Yellow
}

Set-Location market

# ---- 5. ติดตั้ง dependencies ----
Write-Host "`nRunning npm install..."
npm install

# ---- 6. ติดตั้ง Prisma CLI ----
Write-Host "`nInstalling Prisma CLI..."
npm install prisma --save-dev

# ---- 7. รัน Prisma migration ----
Write-Host "`nApplying Prisma migrations..."
npx prisma migrate dev --name init

# ---- 8. รัน Docker services ----
Write-Host "`nStarting Docker services (MinIO + Elasticsearch + Kibana)..."
docker-compose up -d minio elasticsearch kibana

# ---- 9. เสร็จสิ้น ----
Write-Host "`nAll setup complete!" -ForegroundColor Green
Write-Host "To start Nuxt dev server, run: npm run dev"
