-- CaloScanAi 資料庫初始化腳本
-- SQLite3
-- 建立所有必要的 Table

-- ============================================
-- Table: users (使用者表)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: food_logs (飲食紀錄表)
-- ============================================
CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_data TEXT,
    meal_type TEXT DEFAULT 'general',
    calories INTEGER DEFAULT 0,
    protein REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    fat REAL DEFAULT 0,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- Table: daily_progress (每日進度表)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    total_calories INTEGER DEFAULT 0,
    total_protein REAL DEFAULT 0,
    total_carbs REAL DEFAULT 0,
    total_fat REAL DEFAULT 0,
    goal_calories INTEGER DEFAULT 2000,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

-- ============================================
-- Table: daily_quotes (鼓勵語錄表)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote TEXT NOT NULL,
    author TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: barcodes (條碼食物字典)
-- ============================================
CREATE TABLE IF NOT EXISTS barcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    calories INTEGER DEFAULT 0,
    protein REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    fat REAL DEFAULT 0,
    serving_size TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 索引：用於快速查詢
-- ============================================
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON food_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_created_at ON food_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);
CREATE INDEX IF NOT EXISTS idx_barcodes_barcode ON barcodes(barcode);

-- ============================================
-- 預設鼓勵語錄
-- ============================================
INSERT OR IGNORE INTO daily_quotes (quote, author) VALUES
('每天進步一點點，成就不一樣的自己。', '佚名'),
('食物是燃料，選擇好的燃料讓你更有活力。', '營養師'),
('健康不是目的，而是生活的態度。', '佚名'),
('每一餐都是愛護自己的機會。', '佚名'),
('持之以恆，你正在改變自己的未來。', '佚名');

-- ============================================
-- 預設條碼資料
-- ============================================
INSERT OR IGNORE INTO barcodes (barcode, name, brand, calories, protein, carbs, fat, serving_size) VALUES
('4710138000014', '義美小泡芙', '義美', 140, 2, 18, 6, '30g'),
('4710595600011', '泰山八寶粥', '泰山', 180, 4, 30, 4, '250g'),
('4901234567890', '可口可樂', '可口可樂', 140, 0, 35, 0, '330ml'),
('4712345678901', '乖乖', '乖乖', 200, 3, 25, 10, '45g'),
('6920202888888', '維他奶', '維他奶', 100, 5, 12, 3, '250ml');