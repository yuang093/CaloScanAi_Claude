# CaloScanAi 部署指南

## 前置需求

- VPS (Ubuntu 24.04 LTS)
- Docker & Docker Compose
- 網域：calo_C.yuang093.cc（已設定 Cloudflare 應用程式路由）

## 部署步驟

### 1. 上傳專案到 VPS

```bash
# 在本機打包
cd C:\cc\CaloScanAi
tar -czvf caloscanai.tar.gz --exclude='node_modules' --exclude='.git' .

# 上傳到 VPS
scp caloscanai.tar.gz user@your-vps:/home/user/
```

### 2. 在 VPS 上解壓縮並設定

```bash
# SSH 登入 VPS
ssh user@your-vps

# 解壓縮
mkdir -p caloscanai && tar -xzvf caloscanai.tar.gz -C caloscanai
cd caloscanai

# 複製環境變數範例
cp .env.example .env

# 編輯 .env 填入實際值
nano .env
```

### 3. 啟動服務

```bash
# 建置並啟動 Docker 容器
docker-compose up -d --build

# 檢查服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f app
```

### 4. 驗證部署

```bash
# 健康檢查
curl http://localhost/health

# 檢查 Nginx
curl http://localhost/api/auth/status
```

## Cloudflare 設定

1. 前往 Cloudflare Dashboard
2. 建立應用程式路由：
   - 網域：calo_C.yuang093.cc
   - 目標：VPS IP:80
   - 類型：HTTP

## 管理指令

```bash
# 重啟服務
docker-compose restart

# 停止服務
docker-compose down

# 更新並重新部署
git pull && docker-compose up -d --build

# 進入容器
docker exec -it caloscanai_app sh

# 查看資料庫（使用 ESM import）
docker exec -it caloscanai_app node -e "import('./src/services/database.js').then(m => console.log(m.default.prepare('SELECT COUNT(*) as c FROM users').get()));"

# 或使用 SQLite CLI 直接查詢
docker exec -it caloscanai_app sqlite3 /app/data/caloscanai.db "SELECT COUNT(*) FROM users;"
```

## 資料備份

```bash
# 備份資料庫
docker exec caloscanai_app sh -c 'cp /app/data/caloscanai.db /app/backups/db/backup-$(date +%Y%m%d).db'

# 複製備份到主機
docker cp caloscanai_app:/app/backups/db/backup-*.db ./backups/
```

## 疑難排解

### 容器無法啟動
```bash
docker-compose logs app
docker-compose exec app ls -la
```

### 資料庫連線錯誤
```bash
docker exec -it caloscanai_app node -e "import('./src/services/database.js').then(m => console.log('DB Connected:', !!m.default));"
```

### Nginx 502 錯誤
```bash
docker-compose logs nginx
docker-compose exec app curl -I http://localhost:3000/health
```

## 升級

```bash
cd caloscanai
git pull origin main
docker-compose up -d --build
docker image prune -f  # 清理舊的 Docker 映像
```