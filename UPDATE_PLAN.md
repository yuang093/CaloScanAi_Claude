# CaloScanAi 系統修改藍圖

## Step 1: 程式碼探勘結果摘要

| 項目 | 現有問題 | 根因位置 |
|------|----------|----------|
| Bug #1 | 分析食物第二次失效 | `currentPreview` 狀態未在特定流程清除 |
| Bug #2 | 今日紀錄修改不同步食物庫 | PUT 只更新 FoodLogDB，無 BarcodeDB 更新 |
| Bug #3 | TDEE 建議與目標不同步 | 建議用完整 TDEE 而非 goalCalories (TDEE×0.85) |
| Feature #4 | 我的最愛缺少排序 | 無 use_count 欄位，只有 created_at 排序 |
| Feature #5 | 購物清單用 prompt | 無表單 modal，一路用瀏覽器 prompt |
| Bug #6 | 勾選刪除無效 | 前端傳 index，資料庫用 item.id 比對 |
| Bug #7 | ID=17 無法修改 | UNIQUE constraint 冲突，silent failure |
| Feature #8 | 備份機制不完整 | 只備份 barcodes，缺 food_logs、使用者等 |

---

## 項目一：Bug 修復 - 分析食物功能第二次執行失效

### 問題根因分析

在 `dashboard.html` 中：

1. `handleFileSelect()` (lines 858-878) 處理圖片選擇
2. `analyzeImage()` (lines 1013-1044) 發送分析請求
3. `displayAnalysisResult()` (lines 1046-1058) 顯示結果並**隱藏**分析按鈕 (`display: 'none'`)
4. `resetUpload()` (lines 1157-1168) 重置所有狀態並**顯示**分析按鈕

**問題點：** 如果使用者選擇第一張圖後直接選第二張圖，狀態變數 (`currentPreview`, `currentImage`) 可能殘留舊值。此外 `file-input` 的 `onchange` 事件在相同檔案第二次選擇時不會觸發。

### 預計修改的檔案

- `C:\cc\CaloScanAi\dashboard.html`

### 解決方案

1. 在 `handleFileSelect()` 開始時立即清除舊狀態
2. 在 `<input type="file">` 加入 `event.target.value = ''` 在處理完成後強制重置
3. 在 `analyzeImage()` 入口處加入 `console.log` 除錯，並確保 `currentPreview` 不為 null

---

## 項目二：資料連動 - 今日紀錄修改時同步更新食物資料庫

### 問題根因分析

1. **前端無編輯 UI**：`showFoodDetail()` (line 2222) 只有檢視和刪除，無修改功能
2. **PUT endpoint 只更新 FoodLogDB**：`src/routes/food.js:176-232` 的 `PUT /api/food/logs/:id` 只呼叫 `FoodLogDB.update()`
3. **BarcodeDB.update() 存在但未使用**：`src/services/database.js:860-877`

### 預計修改的檔案

- `C:\cc\CaloScanAi\dashboard.html` — 新增食物詳情編輯 modal
- `C:\cc\CaloScanAi\src\routes\food.js` — PUT endpoint 增加同步更新 BarcodeDB 邏輯

### 解決方案與資料流設計

**Phase 1: 前端 UI 新增編輯功能**
- 在 `food-detail-modal` 中加入「編輯」按鈕
- 點擊後顯示可編輯的輸入框（熱量、蛋白質、碳水、脂肪）
- 確認後呼叫 `PUT /api/food/logs/:id` 並傳送更新資料

**Phase 2: 後端同步更新**
- `PUT /api/food/logs/:id` 接收更新資料後：
  1. 更新 `food_logs` 表
  2. 檢查該食物是否來自 `barcodes`（有 `barcode_id` 或名稱匹配）
  3. 若匹配，更新對應的 `barcodes` 記錄
- 需注意：並非所有 food_log 都有對應的 barcodes 記錄（AI 分析的食物可能沒有）

---

## 項目三：邏輯同步 - 減脂建議 TDEE 與目標攝取同步

### 問題根因分析

| 來源 | 計算方式 |
|------|----------|
| `goalCalories` (進度條) | `TDEE × 0.85` (85% 的 TDEE) |
| `generateRecommendation()` 中的 `tdee` | 完整 TDEE (100%) |

**位置：** `dashboard.html` lines 1773-1795 (TDEE 計算) 和 lines 1829-1831 (建議文字)

**問題：** 使用者看到「根據您的 TDEE (2000 kcal)...」但實際目標是 1700 kcal，造成混淆。

### 預計修改的檔案

- `C:\cc\CaloScanAi\dashboard.html` — `generateRecommendation()` 函式

### 解決方案

將建議文字中的 `tdee` 改為參考 `goalCalories`：
- 當攝取 < goalCalories 時：顯示「落後進度」
- 當攝取 > TDEE 時：顯示「超過 TDEE」
- 建議文字應改為「您的每日目標是 {goalCalories} kcal（TDEE 的 85%）」

---

## 項目四：功能優化 - 我的最愛排序邏輯

### 問題根因分析

1. **無 use_count 欄位**：`favorites` 資料表只有 `created_at`，無法追蹤使用頻率
2. **目前排序**：只按 `created_at DESC`（最新新增優先）
3. **loadFavorites 之前錯用 API**：已修正為使用 `/api/food/search`

### 預計修改的檔案

- `C:\cc\CaloScanAi\src\services\database.js` — FavoritesDB
- `C:\cc\CaloScanAi\src\routes\food.js` — GET /favorites endpoint
- `C:\cc\CaloScanAi\dashboard.html` — loadFavorites 函式

### 解決方案

**資料庫變更：**
```sql
ALTER TABLE favorites ADD COLUMN use_count INTEGER DEFAULT 0;
```

**新增 API 參數：**
```
GET /api/food/favorites?sort=recent|most_used|name
```

**排序邏輯：**
- `recent`: `ORDER BY created_at DESC`（現有）
- `most_used`: `ORDER BY use_count DESC`
- `name`: `ORDER BY name ASC`

**使用次數更新：**
- 當從最愛加入日誌時，更新 `use_count = use_count + 1`

---

## 項目五：UI/UX 優化 - 購物清單表單

### 問題根因分析

目前使用 `prompt()` 對話框：
- `openCreateShoppingList()` (line 1494) — 一個 prompt 輸入清單名稱
- `addItemToShoppingList()` (line 1516) — 兩個 prompt（物品名稱、熱量）

無專屬 modal UI，完全依賴瀏覽器 prompt。

### 預計修改的檔案

- `C:\cc\CaloScanAi\dashboard.html` — 新增購物清單 modal、修改函式

### 解決方案

**新增 Modal HTML：**
```html
<div id="shopping-form-modal" class="modal" onclick="if(event.target===this)closeShoppingFormModal()">
  <div style="..." onclick="event.stopPropagation()">
    <button onclick="closeShoppingFormModal()">×</button>
    <h3 id="shopping-form-title">新增購物清單</h3>
    <input type="text" id="shopping-list-name-input" placeholder="清單名稱">
    <!-- 或 for addItem: -->
    <input type="text" id="shopping-item-name-input" placeholder="物品名稱">
    <input type="number" id="shopping-item-cal-input" placeholder="熱量（可選）">
    <button onclick="submitShoppingForm()">確認</button>
  </div>
</div>
```

**函式修改：**
- `openCreateShoppingList()` → 開啟 modal，輸入清單名稱
- `addItemToShoppingList(listId)` → 開啟 modal，輸入物品名稱和熱量

---

## 項目六：Bug 修復 - 勾選並刪除無效

### 問題根因分析

**參數錯配：**

| 位置 | 預期 | 實際 |
|------|------|------|
| 前端 renderShoppingItems (line 1486) | 傳 `${index}` (陣列索引) | 正確 |
| toggleShoppingItem / removeShoppingItem | 接收 `itemIndex` | 正確 |
| 資料庫 toggleItem / removeItem | 用 `items.find(i => i.id === itemId)` | **問題在此** |

**範例：**
```
items = [{id: 1748264809745, name: "蘋果"}, {id: 1748264809750, name: "香蕉"}]
前端傳 index=0 → 資料庫找 id=0 → 找不到（真實 id 是 timestamp）
```

### 預計修改的檔案

- `C:\cc\CaloScanAi\dashboard.html` — `renderShoppingItems()` 函式

### 解決方案

**修改 `renderShoppingItems()`：**

前端應傳送 item 的真實 `id` 而非陣列 index：

```javascript
// 改為
<input type="checkbox" onchange="toggleShoppingItem(${listId}, ${item.id})"
<button onclick="removeShoppingItem(${listId}, ${item.id})"
// 而不是 ${index}
```

---

## 項目七：Bug 修復 - ID=17 無法修改

### 問題根因分析

**UNIQUE constraint 冲突：**

`barcodes` 表的 `barcode` 欄位有 `UNIQUE` 約束。

當更新 ID=17 時：
1. `admin.js:298` 執行 `UPDATE barcodes SET barcode = ? ... WHERE id = 17`
2. 如果 ID=17 的 `barcode` 值为空字串 `''`，而另一筆記錄也是 `''`
3. SQLite 發現 UNIQUE 冲突，更新失敗
4. `result.changes === 0` → 回傳 404「食物資料不存在」

**另一可能：** ID=17 的 `barcode` 欄位值與其他記錄重複。

### 預計修改的檔案

- `C:\cc\CaloScanAi\src\routes\admin.js` — PUT /api/admin/barcodes/:id

### 解決方案

1. **在執行 UPDATE 前檢查 UNIQUE 约束**：如果新的 barcode 值與其他記錄衝突，回傳明確錯誤訊息
2. **區分「找不到」vs「UNIQUE冲突」**：
   ```javascript
   // 檢查 barcodes 是否衝突
   if (barcode) {
     const existing = db.prepare('SELECT id FROM barcodes WHERE barcode = ? AND id != ?').get(barcode, req.params.id);
     if (existing) {
       return res.status(400).json({ error: '條碼號碼已存在於其他記錄' });
     }
   }
   ```
3. **提供更具體的錯誤訊息**，而非統一的 404

---

## 項目八：架構重構討論 - 資料庫備份與還原

### 現況分析

| 項目 | 現況 |
|------|------|
| 資料庫類型 | SQLite (`better-sqlite3`) |
| 資料庫位置 | `C:\cc\CaloScanAi\data\caloscanai.db` |
| 圖片儲存 | Base64 直接存在 `food_logs.image_data` 欄位 |
| 備份格式 | JSON |
| 備份內容 | 只限 `barcodes`, `users`（有限欄位）, `user_profiles`, `daily_quotes` |
| **未備份** | `food_logs`（含圖片）, `daily_progress`, `favorites`, `shopping_lists` |
| 還原功能 | 只還原 `barcodes` |

### 資料庫選項評估

| 選項 | 優點 | 缺點 |
|------|------|------|
| **SQLite** (現有) | 簡單、單檔、備份容易 | 多人同時寫入效能差、無網路遠端存取 |
| **PostgreSQL** | 關聯式完整、支援備份、多人同時存取、GIS 擴展 | 需要額外伺服器、遷移成本 |
| **MySQL/MariaDB** | 廣泛使用、成熟穩定 | 類似 PostgreSQL，但免費版功能較少 |
| **MongoDB** | 文件型、適合 JSON 資料、圖片可存 GridFS | 不支援 SQL 查詢、學習曲線 |

### 建議

**短期（維持 SQLite）：**
- 改進備份機制，包含所有資料表
- 圖片在備份時單獨匯出為檔案（從 base64 解碼）

**長期（PostgreSQL）：**
- 若系統規模擴大（多人同時使用、需要網路存取），遷移到 PostgreSQL
- 使用 Docker 容器化管理資料庫

---

### 完整備份還原流程設計（包含圖檔）

**備份流程：**
```
1. 匯出資料庫為 .db 檔案（SQLite 原始檔）
2. 匯出所有 food_logs.image_data 為獨立檔案
   - 建立資料夾 /backups/images/{timestamp}/
   - 每張圖片存為 {log_id}.jpg
3. 匯出 JSON 中繼資料（用於跨資料庫遷移）
4. 打包為 .zip（包含 .db + images/ + metadata.json）
```

**還原流程：**
```
1. 解壓縮 .zip
2. 還原 SQLite 檔案到新位置
3. 讀取 images/ 資料夾
4. 對於每個 food_logs 記錄，解碼圖片並寫入資料庫
   - 或維持圖片在檔案系統，資料庫只存檔案路徑（推薦大型部署）
```

**SQLite 備份指令（線上備份不鎖資料庫）：**
```bash
sqlite3 caloscanai.db ".backup '/path/to/backup/caloscanai.db'"
```

**PostgreSQL 備份指令：**
```bash
pg_dump -Fc caloscanai > backup.dump
```

---

## 修改優先順序建議

| 優先序 | 項目 | 原因 |
|--------|------|------|
| 1 | Bug #1 (分析失效) | 影響核心功能使用 |
| 2 | Bug #6 (刪除無效) | 使用者體驗傷害 |
| 3 | Feature #5 (購物表單) | UI 改進 |
| 4 | Bug #7 (ID=17) | 資料庫完整性 |
| 5 | Feature #4 (最愛排序) | 功能新增 |
| 6 | Bug #2 (資料連動) | 需要前後端配合，複雜度較高 |
| 7 | Bug #3 (TDEE同步) | 單一檔案修改，相對簡單 |
| 8 | Feature #8 (備份) | 架構層級，需長期規劃 |

---

## 待確認事項

1. **項目二（資料連動）**：是否所有食物日誌都需要與食物資料庫同步？還是只同步有明確條碼的項目？
2. **項目四（最愛排序）**：是否需要新增「使用次數」欄位？還是只有「最近新增」排序就足夠？
3. **項目八（資料庫選項）**：是否考虑在近期內遷移到 PostgreSQL？還是先改進現有 SQLite 備份機制？

請審閱後給予「核准」或「修正意見」。 💕