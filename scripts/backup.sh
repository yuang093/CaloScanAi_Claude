#!/bin/bash
# CaloScanAi 自動備份腳本
# 使用方式: ./scripts/backup.sh
# 備份 SQLite 資料庫

set -e

# 設定變數
BACKUP_DIR="./backups/db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="caloscanai_backup_${DATE}.db"
DATA_DIR="./data"
DB_FILE="caloscanai.db"
RETENTION_DAYS=7

# 確保備份目錄存在
mkdir -p "${BACKUP_DIR}"

# 輸出開始訊息
echo "========================================"
echo "CaloScanAi 資料庫備份"
echo "時間: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 檢查資料庫檔案是否存在
if [ ! -f "${DATA_DIR}/${DB_FILE}" ]; then
    echo "❌ 資料庫檔案不存在: ${DATA_DIR}/${DB_FILE}"
    exit 1
fi

# 複製資料庫檔案（使用 VACUUM 確保完整性）
echo "正在備份資料庫..."
cp "${DATA_DIR}/${DB_FILE}" "${BACKUP_DIR}/${BACKUP_FILENAME}"

# 壓縮備份檔案
echo "壓縮備份檔案..."
gzip "${BACKUP_DIR}/${BACKUP_FILENAME}"

# 清理舊備份（保留天數）
echo "清理超過 ${RETENTION_DAYS} 天的備份..."
find "${BACKUP_DIR}" -name "caloscanai_backup_*.db.gz" -mtime +${RETENTION_DAYS} -delete

# 顯示結果
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILENAME}.gz" | cut -f1)
echo ""
echo "✅ 備份完成！"
echo "📁 檔案: ${BACKUP_DIR}/${BACKUP_FILENAME}.gz"
echo "📊 大小: ${BACKUP_SIZE}"
echo "🗂️  保留份數: 最近 ${RETENTION_DAYS} 天的備份"

# 列出所有備份檔案
echo ""
echo "📋 目前備份檔案列表:"
ls -lh "${BACKUP_DIR}"/caloscanai_backup_*.db.gz 2>/dev/null | tail -5

echo ""
echo "========================================"