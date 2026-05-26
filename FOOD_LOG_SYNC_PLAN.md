# CaloScanAi 食物日誌同步問題修復藍圖

## 問題摘要

| # | 問題 | 影響 | 嚴重性 |
|---|------|------|--------|
| 1 | `copyFoodLog()` 只在本地新增，未寫入伺服器 | 複製的食物刷新後消失 | 🔴 高 |
| 2 | Server (UTC+9 日本) 與 Client (UTC+8 台北) 時區不一致 | 跨日凌晨日誌可能錯亂 | 🟡 中 |

---

## 問題 1：copyFoodLog() 本地新增未同步伺服器

### 問題根因

```javascript
// 錯誤的實作 (dashboard.html:2272-2299)
async function copyFoodLog(logId) {
  const entry = {
    id: Date.now(),  // 本地臨時 ID
    ...
  };
  foodLog.unshift(entry);  // 只加到本地，沒有寫入伺服器！
  renderFoodLog();
}
```

**後果：**
- 頁面刷新或 `loadFoodLog()` 執行時 → 本地資料消失
- 複製的食物永遠不會出現在隔天的日誌中

### 修復方案

改為呼叫 `/api/food/add-from-database` API，將複製的食物寫入伺服器。

**修改後：**
```javascript
async function copyFoodLog(logId) {
  try {
    const response = await fetch('/api/food/logs/' + logId, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    if (result.success && result.data) {
      const log = result.data;
      // 改為透過 API 新增，而非直接操作本地陣列
      const addResponse = await fetch('/api/food/add-from-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({
          name: log.description || '複製食物',
          calories: log.calories || 0,
          protein: log.protein || 0,
          carbs: log.carbs || 0,
          fat: log.fat || 0
        })
      });
      const addResult = await addResponse.json();
      if (addResult.success) {
        alert('已複製到日誌');
        loadFoodLog();  // 重新載入以顯示新增的項目
        closeFavoritesModal();
      } else {
        alert('複製失敗');
      }
    }
  } catch (error) {
    alert('複製失敗');
    console.error('Copy food log error:', error);
  }
}
```

### 技術細節

**修改檔案：** `dashboard.html` 的 `copyFoodLog()` 函式

**API 端點：** `POST /api/food/add-from-database`
- 目前只接受 `barcodeId` 和 `isFavorite`
- 需要擴充支援直接傳入食物資料（name, calories, protein, carbs, fat）

---

## 問題 2：Server 與 Client 時區不一致

### 問題根因

| 環境 | 時區 | UTC Offset |
|------|------|-----------|
| Client (你的電腦) | 台北 (Asia/Taipei) | UTC+8 |
| Server (VPS) | 日本 (Asia/Tokyo) | UTC+9 |

時差 1 小時可能導致：
- 接近 midnight (00:00) 時，client 和 server 對「今天」的定義不同
- 日誌查詢和寫入可能落在不同的日期

### 修復方案

**統一使用 UTC+8 (台北時間) 作為所有日期計算的基準：**

1. **Server 端 (`src/utils/date.js`)**
   - `getLocalDate()` 改為明確使用 UTC+8

2. **Client 端 (`dashboard.html`)**
   - `getLocalDate()` 改為明確使用 UTC+8

### 修改後的 getLocalDate()

```javascript
function getLocalDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);  // 轉換為 UTC 時間
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));  // UTC+8 = 台北時間
  return taiwanDate.toISOString().split('T')[0];  // YYYY-MM-DD
}
```

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/utils/date.js` | `getLocalDate()` 使用 UTC+8 |
| `dashboard.html` | `getLocalDate()` 使用 UTC+8 |
| `dashboard.html` | `copyFoodLog()` 改為呼叫 API |

---

## API 修改

### POST /api/food/add-from-database

**目前支援：**
- `barcodeId` + `isFavorite: true` → 從最愛新增

**需要擴充支援：**
- 直接傳入食物資料（無 barcode_id 時）
  ```json
  { "name": "蘋果", "calories": 52, "protein": 0.3, "carbs": 14, "fat": 0.2 }
  ```

**修改後的邏輯：**
```javascript
// 如果有 barcodeId 且 isFavorite=true → 從最愛新增
// 如果有 name 但沒有 barcodeId → 直接建立 food_log（不關聯 barcodes）
```

---

## 預估工作量

- API 擴充（支援直接傳入食物資料）：15 分鐘
- copyFoodLog() 修復：10 分鐘
- 時區統一修正：10 分鐘
- 測試驗證：15 分鐘

**總計：約 50 分鐘**

---

## 驗證方式

1. **copyFoodLog 測試：**
   - 從「最近的食物」複製一個項目
   - 刷新頁面
   - 確認複製的食物仍在日誌中

2. **時區測試：**
   - 在接近 midnight (00:00) 時測試新增食物
   - 確認翌日日誌是空的（只有當天新增的）