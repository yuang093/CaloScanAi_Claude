#!/bin/bash
# CaloScanAi 資料庫還原腳本
# 使用方式: ./scripts/restore.sh <backup_file>

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查參數
if [ -z "$1" ]; then
    echo -e "${RED}錯誤: 請指定備份檔案${NC}"
    echo "使用方式: $0 <backup_file>"
    echo ""
    echo "可用備份檔案:"
    ls -lh ./backups/db/caloscanai_backup_*.dump.gz 2>/dev/null || echo "沒有找到備份檔案"
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="caloscanai_db"
DB_NAME="caloscanai"
DB_USER="caloscanai"

# 檢查檔案是否存在
if [ ! -f "${BACKUP_FILE}" ]; then
    # 嘗試在預設目錄尋找
    if [ -f "./backups/db/${BACKUP_FILE}" ]; then
        BACKUP_FILE="./backups/db/${BACKUP_FILE}"
    else
        echo -e "${RED}錯誤: 找不到備份檔案: ${BACKUP_FILE}${NC}"
        exit 1
    fi
fi

# 確認副檔名
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo -e "${YELLOW}偵測到壓縮檔案，正在解壓縮...${NC}"
    TEMP_FILE=$(mktemp)
    gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
    BACKUP_FILE="${TEMP_FILE}"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}CaloScanAi 資料庫還原${NC}"
echo -e "${GREEN}時間: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 警告
echo -e "${YELLOW}⚠️  警告：此操作將覆蓋目前的資料庫！${NC}"
echo -e "${YELLOW}   所有目前的資料將會被刪除！${NC}"
echo ""
read -p "確認繼續？(yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "取消還原作業"
    exit 0
fi

# 執行還原
echo ""
echo "正在還原資料庫..."
echo "備份檔案: ${BACKUP_FILE}"

docker exec -i ${CONTAINER_NAME} pg_restore -U ${DB_USER} -d ${DB_NAME} --clean --if-exists < "${BACKUP_FILE}"

# 檢查是否成功
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 還原成功！${NC}"
else
    echo ""
    echo -e "${RED}❌ 還原失敗，請檢查錯誤訊息${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}還原完成！${NC}"
echo -e "${GREEN}========================================${NC}"