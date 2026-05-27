# CaloScanAi 資料庫重構與圖片儲存升級計畫

## 一、現況分析

### 1.1 現有資料庫結構

| 資料表 | 圖片欄位 | 說明 |
|--------|----------|------|
| `food_logs` | ✅ `image_data` (base64) | 儲存完整 base64 字串 |
| `barcodes` | ❌ 無 | 只有營養資料 |
| `favorites` | ❌ 無 | 僅文字資料 |

### 1.2 現有圖片處理流程

```
用戶上傳圖片 → compressImage() 壓縮 → /api/food/upload
→ base64 存入 food_logs.image_data → AI 分析 → 存入 barcodes
```

**問題**：
- base64 佔用資料庫空間（每次查詢都要傳輸大字串）
- barcodes/favorites 無法關聯圖片
- 圖片無法在「我的最愛」中顯示

### 1.3 現有上傳目錄

- 設定：`/uploads` (static route)
- 實際：`/c/cc/CaloScanAi/uploads/` (空，目錄存在但未使用)
- Docker 映射：`/opt/caloscanai/uploads/`

---

## 二、新版資料庫 Schema 設計

### 2.1 修改 `food_logs` 表

```sql
-- 移除 image_data，改用 image_path
ALTER TABLE food_logs DROP COLUMN image_data;
ALTER TABLE food_logs ADD COLUMN image_path TEXT;  -- 相對路徑如 "foods/2026/05/27/abc123.jpg"
```

### 2.2 修改 `barcodes` 表

```sql
-- 新增圖片路徑欄位
ALTER TABLE barcodes ADD COLUMN image_path TEXT;
ALTER TABLE barcodes ADD COLUMN thumbnail_path TEXT;  -- 縮圖路徑可選
```

### 2.3 修改 `favorites` 表

```sql
-- 新增圖片路徑欄位（可為 NULL）
ALTER TABLE favorites ADD COLUMN image_path TEXT;
```

---

## 三、圖片處理資料流（修改後）

### 3.1 新流程

```
1. 用戶上傳圖片
2. compressImage() 壓縮
3. 前端發送 base64 到 /api/food/upload
4. 後端：
   a. 將 base64 解碼為 Buffer
   b. 建立路徑：uploads/foods/YYYY/MM/DD/uuid.jpg
   c. 寫入檔案（fs.writeFile）
   d. 圖片路徑存入 food_logs.image_path
5. 如果是新食物，同時存入 barcodes.image_path
6. 回傳 image_path（不是 base64）
```

### 3.2 讀取流程

```javascript
// 前端讀取圖片
const imgSrc = item.image_path
  ? `/uploads/${item.image_path}`
  : 'data:image/svg+xml,...';
```

---

## 四、具體修改步驟（分階段）

### Phase 1: 圖片檔案系統重構

**修改檔案**：

1. **`src/routes/food.js`** - 修改上傳邏輯
   - `POST /upload` → 存檔並更新 image_path
   - `GET /logs` → 回傳 image_path（不是 base64）

2. **`src/js/dashboard-food.js`** - 修改顯示邏輯
   - `renderFoodLog()` → 使用 `/uploads/${image_path}`
   - `loadFoodLog()` → 處理 image_path 而非 image_data

3. **`src/js/dashboard-modals.js`** - 圖片顯示
   - `showFoodDetail()` → 使用 image_path

4. **`src/services/database.js`** - 新增 DB 操作
   - `FoodLogDB.create()` → 支援 image_path
   - `BarcodeDB.create()` → 支援 image_path

### Phase 2: 雙向連動（修改食物時同步更新 barcodes）

**修改檔案**：

1. **`src/routes/food.js`** - 修改 `PUT /logs/:id`
   - 當食物有對應 barcode_id 時，同時更新 `barcodes` 表

2. **`src/services/database.js`** - 新增 `BarcodeDB.updateNutrition()`

### Phase 3: 「我的最愛」邏輯重構

**修改檔案**：

1. **`src/routes/food.js`** - 修改 `GET /favorites`
   - 統計 `food_logs` 中各食物的食用次數
   - 新增 endpoint 取得「最常食用」排行

2. **`src/js/dashboard-modals.js`** - 修改 `loadFavorites()`
   - 從 food_logs 統計最常食用食物
   - 顯示食用次數

---

## 五、Phase 1 詳細實作（核心）

### 5.1 資料庫 Migration

```sql
-- 執行於 init 時
ALTER TABLE food_logs ADD COLUMN image_path TEXT;
ALTER TABLE barcodes ADD COLUMN image_path TEXT;
ALTER TABLE favorites ADD COLUMN image_path TEXT;
```

### 5.2 核心程式碼修改

**`src/services/database.js`** 新增：
```javascript
FoodLogDB.create(userId, data) {
  // image_path 取代 imageData
  const imagePath = data.imagePath || null;
  // INSERT into food_logs with image_path
}
```

**`src/routes/food.js`** 修改上傳：
```javascript
// 將 base64 存為檔案
const imageBuffer = Buffer.from(base64Data, 'base64');
const imagePath = `foods/${date}/$uuidv4().jpg`;
const fullPath = join(uploadsDir, imagePath);
fs.writeFileSync(fullPath, imageBuffer);

// 存入 DB
FoodLogDB.create(userId, { imagePath, ... });
```

**`src/js/dashboard-food.js`** 修改顯示：
```javascript
image: log.image_path
  ? `/uploads/${log.image_path}`
  : null
```

---

## 六、驗證方式

1. 上傳圖片，檢查 `uploads/foods/` 目錄有檔案
2. 檢查資料庫 `food_logs.image_path` 有正確路徑
3. 「今日紀錄」卡片正常顯示圖片
4. 「我的最愛」可顯示有圖片的最愛（如果有的話）
5. 編輯食物時，barcodes 表同步更新

---

## 七、相對路徑 vs 絕對路徑

| 方案 | 優點 | 缺點 |
|------|------|------|
| **相對路徑（推薦）** | 搬移時只需改 static route | 需要確保路徑一致性 |
| 絕對路徑 | 直接明確 | 部署環境不同會壞 |

**選擇**：使用 `foods/YYYY/MM/DD/uuid.jpg` 相對路徑

---

## 八、Phase 與優先順序

| Phase | 內容 | 複雜度 |
|-------|------|--------|
| 1 | 圖片檔案系統重構 | 高 |
| 2 | barcodes 新增 image_path | 中 |
| 3 | 雙向連動更新 | 中 |
| 4 | 我的最愛統計重構 | 低 |

---

## 九、需確認事項

1. **uploads 目錄掛載是否已設定？** - 確認 Docker Compose 有正確 mount
2. **現有資料是否需要遷移？** - 舊 base64 圖片要轉檔還是放棄？
3. **是否需要支援刪除舊圖片？** - 修改食物時舊圖片是否需要清理？

---

## 十、縮圖需求

是否需要同時產生縮圖？還是用 CSS `object-fit: cover` + 固定尺寸處理？

[等待確認後再執行修改]