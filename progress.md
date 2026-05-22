# 開發日誌 (Daily Progress Log)

## 2026-05-22
- **Decision**: 確認部署架構為 VPS (Ubuntu 24.04 LTS) + Docker
- **Decision**: 對外網域使用 `calo_C.yuang093.cc`，透過 Cloudflare 應用程式路由（無需 port）
- **Decision**: 內部使用 `http://frontend:3002` 連接
- **Decision**: 圖片儲存於 VPS 本地 `/opt/caloscanai/uploads/`
- **Decision**: GitHub 分支：專案 + HTML 提案分開管理
- **Decision**: 拖曳卡片優先序排程器獨立放在 Claude_HTML repo

## 2026-05-21
- **Added**: 建立專案基礎文件 (`CLAUDE.md`, `AGENTS.md`, `PROJECT_BRIEF.md`, `PROJECT_CONTEXT.md` 等)。
- **Decision**: 確定專案名稱為 `CaloScanAi`。
- **Decision**: 暫緩決定最終 UI/UX 與儀表板版面，改為先由 AI 生成 6 個 HTML 原型後再做決策。
- **Todo Next**: 指派 Agent 執行 Vercel HTML 原型開發任務。