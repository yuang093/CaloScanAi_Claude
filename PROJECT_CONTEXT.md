# 專案背景與脈絡 (Project Context)

## 專案緣起
現代人注重健康與體態管理，但傳統的卡路里紀錄 APP 往往需要手動輸入、搜尋食物，過程繁瑣難以堅持。本專案 **CaloScanAi** 旨在透過 AI 影像辨識技術，將「紀錄」這個動作簡化為「拍照」，大幅降低使用者的摩擦力。

## 開發策略：AI 輔助與原型驅動 (Prototype-Driven)
- **前端視覺**：UI/UX 風格與後台儀表板將先由 AI Agent 產出 6 組純 HTML/CSS/JS 的靜態原型（部署於 Vercel），經開發者確認後，再進行正式的框架整合。
- **技術決策**：
  - AI 辨識：優先考慮支援 Vision 的大語言模型 API (如 minimax M2.7)。
  - 部署環境：Vercel (前端與無伺服器 API)。
  - 儲存：需具備獨立備份與還原機制的關聯式資料庫。

## 部署架構
- **主機環境**：VPS (Ubuntu 24.04 LTS) + Docker
- **對外網域**：calo_C.yuang093.cc（Cloudflare 應用程式路由，無需 port）
- **內部服務連接**：http://frontend:3002
- **圖片儲存**：VPS 本地 `/opt/caloscanai/uploads/`（Docker volume 掛載）
- **資料庫**：PostgreSQL（pg_dump -Fc 自訂格式備份）
- **GitHub 分支**：
  - 專案：https://github.com/yuang093/CaloScanAi_Claude.git
  - HTML 提案：https://github.com/yuang093/Claude_HTML.git

## 關鍵技術限制與護欄
1. **圖片傳輸成本**：前端必須實作嚴格的圖片壓縮機制 (Max 1200px, 逐步壓縮至低於 300KB)，以節省 AI API 傳輸時間與儲存成本。
2. **無資料啟動**：系統必須具備自我修復能力，當偵測到全新環境時，自動初始化資料表與欄位。