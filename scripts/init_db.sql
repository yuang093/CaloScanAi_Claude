-- CaloScanAi 資料庫初始化腳本
-- PostgreSQL 16+
-- 建立所有必要的 Table

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: users (使用者表)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    daily_calorie_limit INTEGER DEFAULT 2000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：用於快速查詢使用者
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- Table: food_logs (飲食紀錄表)
-- ============================================
CREATE TABLE IF NOT EXISTS food_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR(500),
    food_name VARCHAR(255) NOT NULL,
    calories INTEGER NOT NULL,
    source VARCHAR(30) DEFAULT 'manual' CHECK (source IN ('ai_photo', 'nutrition_label', 'barcode', 'manual')),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：用於查詢使用者的飲食紀錄
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON food_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_log_date ON food_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, log_date);

-- ============================================
-- Table: barcode_dictionary (條碼食物字典表)
-- ============================================
CREATE TABLE IF NOT EXISTS barcode_dictionary (
    barcode VARCHAR(100) PRIMARY KEY,
    food_name VARCHAR(255) NOT NULL,
    calories INTEGER NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：用於搜尋
CREATE INDEX IF NOT EXISTS idx_barcode_category ON barcode_dictionary(category);
CREATE INDEX IF NOT EXISTS idx_barcode_food_name ON barcode_dictionary(food_name);

-- ============================================
-- Table: daily_quotes (鼓勵語錄表)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_quotes (
    id SERIAL PRIMARY KEY,
    quote_text TEXT NOT NULL,
    used_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引：用於隨機選擇
CREATE INDEX IF NOT EXISTS idx_daily_quotes_used_date ON daily_quotes(used_date);

-- ============================================
-- Table: daily_progress (每日進度表)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_calories INTEGER DEFAULT 0,
    remaining_calories INTEGER DEFAULT 0,
    goal_reached BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- 索引：用於查詢進度
CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);

-- ============================================
-- 插入預設管理員帳號
-- 密碼: admin123 (需要更換為實際密碼的 hash)
-- ============================================
INSERT INTO users (username, email, password_hash, role, daily_calorie_limit)
VALUES ('admin', 'admin@caloscanai.com', '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'admin', 2000)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- 插入 365 句鼓勵語錄（範例 10 句，其餘需要完整內容）
-- ============================================
INSERT INTO daily_quotes (quote_text) VALUES
('每一天的小進步，都是健康生活的大累積。堅持下去，你會遇見更好的自己。'),
('照顧好自己的身體，是送給自己最溫柔的禮物。'),
('健康不是目的，而是旅程。享受每一個當下。'),
('你值得擁有最好的版本的你。從今天開始投資自己。'),
('每一口食物都是選擇，選擇讓你更有能量的食物。'),
('不要追求完美，追求進步。今天比昨天更好就是勝利。'),
('健康是一種生活方式，不是節食。找到適合你的平衡。'),
('相信過程，相信改變。每一個小小的決定都會累積成大結果。'),
('你的身體是你靈魂的殿堂，好好照顧它。'),
('改變不需要很大，只要開始了，就已經成功了一半。')
ON CONFLICT DO NOTHING;

-- ============================================
-- 函數：自動更新 updated_at 時間戳
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 觸發器：自動更新 updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_food_logs_updated_at
    BEFORE UPDATE ON food_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_barcode_dictionary_updated_at
    BEFORE UPDATE ON barcode_dictionary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_progress_updated_at
    BEFORE UPDATE ON daily_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 權限設定
-- ============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO caloscanai_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO caloscanai_app;

COMMENT ON TABLE users IS '使用者帳號資料表';
COMMENT ON TABLE food_logs IS '飲食紀錄資料表';
COMMENT ON TABLE barcode_dictionary IS '條碼食物字典';
COMMENT ON TABLE daily_quotes IS '每日鼓勵語錄';
COMMENT ON TABLE daily_progress IS '使用者每日進度追蹤';