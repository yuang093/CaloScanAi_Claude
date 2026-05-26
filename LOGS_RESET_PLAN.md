# CaloScanAi 日誌顯示問題修復藍圖

## 問題描述

**Bug：今日食物記錄到隔天沒有清空**

使用者在今天可以看到前幾天甚至更久之前的食物日誌記錄，這不是預期的行為。每個新的日期應該只顯示當天的食物記錄。

---

## 問題根因分析

| 環節 | 位置 | 問題 |
|------|------|------|
| 前端 API 呼叫 | `dashboard.html:loadFoodLog()` | **沒有傳入 `date` 參數** |
| API 端點 | `src/routes/food.js:GET /logs` | 接收 `date` 但未強制要求 |
| 資料庫查詢 | `src/services/database.js:findByUserId()` | 當 `date=undefined` 時不回溯日期過濾 |

**關鍵問題：** `loadFoodLog()` 呼叫 API 時不帶 `date` 參數，導致 API 返回「該用户所有歷史日誌（最多50筆）」，而不是只返回「今天」的日誌。

---

## 解決方案

### 方案：前端呼叫 API 時強制帶入 `date` 參數

**修改位置：** `dashboard.html` 的 `loadFoodLog()` 函式

**修改方式：**
```javascript
// 錯誤（目前）
fetch('/api/food/logs?limit=50', { ... })

// 正確（修復後）
fetch('/api/food/logs?date=' + getLocalDate() + '&limit=50', { ... })
```

**使用的工具函式：**
```javascript
// 已經存在，位置：src/utils/date.js
export function getLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  return localDate.toISOString().split('T')[0];
}
```

---

## 修改的檔案

| 檔案 | 變更 |
|------|------|
| `dashboard.html` | 修改 `loadFoodLog()` 帶入 `date` 參數 |

---

## 預估工作量

- 前端修改：1 行程式碼
- 測試：5 分鐘

---

## 驗證方式

1. 查看昨天的食物日誌
2. 刷新頁面，確認昨天顯示的內容與今天不同
3. 確認「今日」只顯示當天 00:00 ~ 23:59 的日誌

---

## 附加發現：進度條數值計算

如果日誌沒有按日期過濾，則「今日進度」也可能計算了歷史日誌的總和。需要確認 `FoodLogDB.getTodayStats()` 是否也有同樣的問題。

**檢查結果：** `getTodayStats()` 使用 `getLocalDate()` 過濾當天日誌，**是正確的**。所以進度條數值是正確的，只是日誌列表顯示不正確。

---

## 預估工作量

- 程式碼修改：5 分鐘
- 測試驗證：10 分鐘
