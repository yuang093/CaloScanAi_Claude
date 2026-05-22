# CaloScanAi Docker 部署指南

## 目錄結構

```
CaloScanAi/
├── docker-compose.yml    # Docker Compose 設定
├── docker/
│   └── Dockerfile        # 應用程式容器
├── nginx/
│   ├── nginx.conf       # Nginx 主設定
│   └── conf.d/
│       └── calo.conf   # 應用程式設定
├── scripts/
│   ├── init_db.sql      # 資料庫初始化
│   ├── backup.sh        # 自動備份腳本
│   └── restore.sh       # 還原腳本
├── uploads/              # 圖片上傳目錄（掛載）
├── backups/
│   └── db/              # 資料庫備份目錄
├── .env.example         # 環境變數範例
└── README.md            # 本檔案
```

## 快速開始

### 1. 複製環境變數

```bash
cp .env.example .env
# 編輯 .env 填入實際的值
```

### 2. 設定環境變數

編輯 `.env` 檔案，填入以下必要的值：

```env
DB_USER=caloscanai
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_minimum_32_characters
AI_API_KEY=your_ai_api_key
ADMIN_PASSWORD=your_admin_password
```

### 3. 啟動服務

```bash
docker-compose up -d
```

### 4. 檢查服務狀態

```bash
docker-compose ps
docker-compose logs -f app
```

## 服務 URL

| 服務 | URL |
|------|-----|
| 應用程式 | http://localhost:3002 |
| Nginx | http://localhost:80 |
| PostgreSQL | localhost:5432 |

## 常用指令

### 備份資料庫

```bash
./scripts/backup.sh
```

### 還原資料庫

```bash
./scripts/restore.sh caloscanai_backup_20260522_120000.dump.gz
```

### 停止服務

```bash
docker-compose down
```

### 重新建構

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 資料庫 Schema

| Table | 說明 |
|-------|------|
| users | 使用者帳號 |
| food_logs | 飲食紀錄 |
| barcode_dictionary | 條碼食物字典 |
| daily_quotes | 每日鼓勵語錄 |
| daily_progress | 每日進度追蹤 |

## 備份策略

- 自動備份：每日凌晨 3:00 執行（可透過 cron 設定）
- 保留份數：7 天
- 備份位置：`./backups/db/`
- 備份格式：`caloscanai_backup_YYYYMMDD_HHMMSS.dump.gz`