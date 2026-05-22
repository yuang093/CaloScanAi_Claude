# 資料庫 Schema 建議

## 1. Users (使用者表)
- `id`: UUID (主鍵)
- `username`: String
- `password_hash`: String
- `role`: Enum ('admin', 'user')
- `daily_calorie_limit`: Integer (每日限制額度)
- `created_at`: Timestamp

## 2. FoodLogs (飲食紀錄表)
- `id`: UUID
- `user_id`: UUID (外鍵)
- `image_url`: String (壓縮後的圖片路徑)
- `food_name`: String (AI 辨識或手動輸入)
- `calories`: Integer
- `source`: Enum ('ai_photo', 'nutrition_label', 'barcode', 'manual')
- `log_date`: Date
- `created_at`: Timestamp

## 3. BarcodeDictionary (條碼食物字典表)
- `barcode`: String (主鍵)
- `food_name`: String
- `calories`: Integer
- `category`: String (分類，可搜尋查找)

## 4. DailyQuotes (鼓勵語錄表)
- `id`: Integer (主鍵 1~365)
- `quote_text`: String
- `used_date`: Date (記錄哪天用過，避免近期重複)