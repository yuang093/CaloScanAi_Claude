#!/bin/bash
# CaloScanAi 快速部署腳本

set -e

echo "=========================================="
echo "CaloScanAi 部署腳本"
echo "=========================================="

# 檢查 Docker
if ! command -v docker &> /dev/null; then
    echo "錯誤：需要 Docker 才能部署"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "錯誤：需要 Docker Compose 才能部署"
    exit 1
fi

# 建立必要的目錄
echo "建立目錄結構..."
mkdir -p uploads backups/db

# 檢查 .env
if [ ! -f .env ]; then
    echo "複製 .env.example 到 .env..."
    cp .env.example .env
    echo "請編輯 .env 填入實際的 API Key 和密碼"
fi

# 建置並啟動
echo "建置 Docker 映像..."
docker-compose up -d --build

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "服務狀態："
docker-compose ps
echo ""
echo "查看日誌：docker-compose logs -f"
echo "進入容器：docker exec -it caloscanai_app sh"
echo "停止服務：docker-compose down"
echo ""
echo "應用程式：http://localhost:3000"
echo "API：http://localhost:3000/health"