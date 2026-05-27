# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**CaloScanAi** - AI 智慧卡路里追蹤系統，使用者拍照即可自動辨識食物並計算熱量。

### 技術架構
- **前端**: HTML/CSS/JS (dashboard.html + src/js/*.js)
- **後端**: Express.js (src/server/index.js)
- **資料庫**: SQLite (src/services/database.js)
- **認證**: JWT (jsonwebtoken)

### 目錄結構

```
src/
├── server/index.js      # Express 應用程式 entry point
├── routes/              # API 路由 (food, auth, barcode, admin, progress, profile)
├── services/database.js # SQLite 資料庫操作
├── middleware/          # 認證與錯誤處理
├── utils/               # 日期工具與通用函式
├── js/                  # 前端模組 (dashboard-main/food/progress/modals.js)
└── styles/              # CSS 檔案

根目錄:
├── dashboard.html       # 主頁面
├── admin.html           # 管理員後台
├── index.html           # 登入頁面
├── uploads/             # 上傳圖片目錄
└── .env                 # 環境變數 (API keys, JWT_SECRET)
```

## 常用指令

### 開發
```bash
npm run dev      # 啟動開發伺服器 (with --watch)
npm start       # 啟動正式伺服器
```

### 部署 (VPS)
```bash
# 在 VPS 上執行
git pull && docker compose down --rmi all && docker compose up --build -d
```

### Git 提交
```bash
git add -A && git commit -m "訊息" && git push
```

## 開發規範

### 影像處理
- 所有上傳圖片必須先壓縮 (目標 < 300KB，最大 1200px，JPEG 品質 0.85 遞減至 0.4)
- 實作: `src/js/dashboard-food.js` 中的 `compressImage()`

### 環境變數
- API Key 與密碼必須從 `.env` 讀取，絕不硬編碼

### 安全護欄 (CRITICAL)
在執行以下高風險操作前，**必須先提醒開發者完成資料備份**：
- 刪除容器 (`docker rm`, `docker-compose down -v`)
- 移除檔案或目錄 (`rm -rf`)
- 大幅變更資料庫結構 (Drop Tables, Migrations)
- 不自動上傳 GitHub，需開發者明確指示才執行

### 程式碼修改流程
1. 本地端修改程式碼
2. 上傳 GitHub
3. 通知使用者在 VPS 部署

## API 路由結構

| 路由 | 說明 |
|------|------|
| `/api/auth` | 登入、註冊、認證 |
| `/api/food` | 食物上傳、分析、日誌管理 |
| `/api/barcode` | 條碼掃描與管理 |
| `/api/progress` | 每日進度追蹤 |
| `/api/admin` | 管理員功能 |
| `/api/profile` | 用戶個人資料 |

## 前端模組說明

| 檔案 | 責任 |
|------|------|
| `dashboard-main.js` | 初始化、認證檢查、主題切換 |
| `dashboard-food.js` | 圖片上傳、壓縮、分析加入日誌 |
| `dashboard-progress.js` | 進度條、統計圖表 |
| `dashboard-modals.js` | 所有彈窗 (食物詳情、最愛、條碼等) |

## 全域暴露模式

前端使用 `window.` 前綴暴露函式供 HTML onclick 使用：
- `window.loadFoodLog()` - 載入食物日誌
- `window.showFoodDetail(id)` - 顯示食物詳情
- `window.openAnalysisEditMode()` - 分析後編輯

## 版本管理
- 每次 commit 前檢查是否需要更新版本號
- 不在此專案適用的版本管理規則請忽略

---

## 行為準則

**優先謹慎而非速度**。適用於非簡單任務。

### 1. Coding 前先思考
- 不確定的假設要明確說明
- 多種解釋並存時先呈現不要默默選擇
- 有更簡單做法時要說出

### 2. 保持簡潔
- 不加入超出請求的功能
- 不為單次使用的程式碼建立抽象
- 問：「資深工程師會說這太複雜嗎？」若是，简化

### 3. 精準修改
- 只改必須改的
- 不要「改善」相鄰程式碼、註解或格式
- 你的修改造成的廢棄程式碼要移除

### 4. 目標導向
- 定義成功標準再動手
- 多步驟任務先說明计划

這些準則生效時：diff 不必要變更更少、 rewrites 更少、問題在錯誤發生前先問而非事後補救。