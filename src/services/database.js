import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/caloscanai.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  console.error('❌ 無法建立資料庫連線:', err.message);
  process.exit(1);
}

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema with error handling
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS daily_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote TEXT NOT NULL,
      author TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

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
  `);
} catch (err) {
  console.error('❌ 資料庫結構初始化失敗:', err.message);
  process.exit(1);
}

// ALTER TABLE for role column (SQLite doesn't auto-add to existing tables)
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin'))");
} catch (err) {
  // Column may already exist, ignore error
  if (!err.message.includes('duplicate column name')) {
    console.warn('⚠️ users.role 欄位設定警告:', err.message);
  }
}

// Migration: email column renamed to username (SQLite 支援)
try {
  const pragma = db.prepare("PRAGMA table_info(users)").all();
  const columns = pragma.map(c => c.name);

  if (columns.includes('email') && !columns.includes('username')) {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
    db.exec("UPDATE users SET username = email WHERE username IS NULL OR username = ''");
    console.log('✅ 資料庫遷移完成: email → username');
  }
} catch (err) {
  console.warn('⚠️ 資料庫遷移警告:', err.message);
}

// Create indexes
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON food_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_food_logs_created_at ON food_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);
  `);
} catch (err) {
  console.error('❌ 索引建立失敗:', err.message);
  process.exit(1);
}

// Seed default daily quotes if empty
const quoteCount = db.prepare('SELECT COUNT(*) as count FROM daily_quotes').get();
if (quoteCount.count === 0) {
  const defaultQuotes = [
    ['每天進步一點點，成就不一樣的自己。', '佚名'],
    ['食物是燃料，選擇好的燃料讓你更有活力。', '營養師'],
    ['健康不是目的，而是生活的態度。', '佚名'],
    ['每一餐都是愛護自己的機會。', '佚名'],
    ['持之以恆，你正在改變自己的未來。', '佚名']
  ];

  const insertQuote = db.prepare('INSERT INTO daily_quotes (quote, author) VALUES (?, ?)');
  for (const quote of defaultQuotes) {
    insertQuote.run(...quote);
  }
}

// User operations
export const UserDB = {
  create(username, password, name, role = 'user') {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
    const result = stmt.run(username, hashedPassword, name, role);
    return this.findById(result.lastInsertRowid);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  findById(id) {
    return db.prepare('SELECT id, username, name, role, created_at FROM users WHERE id = ?').get(id);
  },

  verifyPassword(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password)) return null;
    return { id: user.id, username: user.username, name: user.name, role: user.role };
  },

  setAdmin(userId) {
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    stmt.run('admin', userId);
  }
};

// Food log operations
export const FoodLogDB = {
  create(userId, data) {
    const stmt = db.prepare(`
      INSERT INTO food_logs (user_id, image_data, meal_type, calories, protein, carbs, fat, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      data.imageData || null,
      data.mealType || 'general',
      data.calories || 0,
      data.protein || 0,
      data.carbs || 0,
      data.fat || 0,
      data.description || null
    );
    return this.findById(result.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM food_logs WHERE id = ?').get(id);
  },

  findByUserId(userId, options = {}) {
    const { date, limit = 20, offset = 0 } = options;
    let query = 'SELECT * FROM food_logs WHERE user_id = ?';
    const params = [userId];

    if (date) {
      query += ' AND date(created_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params);
    const countQuery = db.prepare('SELECT COUNT(*) as total FROM food_logs WHERE user_id = ?' + (date ? ' AND date(created_at) = ?' : ''));
    const count = date
      ? countQuery.get(userId, date)
      : countQuery.get(userId);

    return { logs, total: count.total };
  },

  update(id, userId, data) {
    const fields = [];
    const values = [];

    if (data.mealType !== undefined) { fields.push('meal_type = ?'); values.push(data.mealType); }
    if (data.calories !== undefined) { fields.push('calories = ?'); values.push(data.calories); }
    if (data.protein !== undefined) { fields.push('protein = ?'); values.push(data.protein); }
    if (data.carbs !== undefined) { fields.push('carbs = ?'); values.push(data.carbs); }
    if (data.fat !== undefined) { fields.push('fat = ?'); values.push(data.fat); }

    if (fields.length === 0) return this.findById(id);

    values.push(id, userId);
    const stmt = db.prepare(`UPDATE food_logs SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`);
    stmt.run(...values);

    return this.findById(id);
  },

  delete(id, userId) {
    const stmt = db.prepare('DELETE FROM food_logs WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  getTodayStats(userId) {
    const today = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT
        COALESCE(SUM(calories), 0) as total_calories,
        COALESCE(SUM(protein), 0) as total_protein,
        COALESCE(SUM(carbs), 0) as total_carbs,
        COALESCE(SUM(fat), 0) as total_fat,
        COUNT(*) as meal_count
      FROM food_logs
      WHERE user_id = ? AND date(created_at) = ?
    `);
    return stmt.get(userId, today);
  }
};

// Daily progress operations
export const DailyProgressDB = {
  upsert(userId, date, data) {
    const stmt = db.prepare(`
      INSERT INTO daily_progress (user_id, date, total_calories, total_protein, total_carbs, total_fat, goal_calories)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        total_calories = excluded.total_calories,
        total_protein = excluded.total_protein,
        total_carbs = excluded.total_carbs,
        total_fat = excluded.total_fat,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
      userId,
      date,
      data.totalCalories || 0,
      data.totalProtein || 0,
      data.totalCarbs || 0,
      data.totalFat || 0,
      data.goalCalories || 2000
    );
    return this.findByUserAndDate(userId, date);
  },

  findByUserAndDate(userId, date) {
    return db.prepare('SELECT * FROM daily_progress WHERE user_id = ? AND date = ?').get(userId, date);
  },

  findByUserId(userId, options = {}) {
    const { startDate, endDate, limit = 30 } = options;
    let query = 'SELECT * FROM daily_progress WHERE user_id = ?';
    const params = [userId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC LIMIT ?';
    params.push(limit);

    return db.prepare(query).all(...params);
  }
};

// Daily quotes operations
export const QuoteDB = {
  getRandom() {
    return db.prepare('SELECT * FROM daily_quotes ORDER BY RANDOM() LIMIT 1').get();
  },

  getAll() {
    return db.prepare('SELECT * FROM daily_quotes ORDER BY id').all();
  }
};

// Barcode operations
export const BarcodeDB = {
  findByBarcode(barcode) {
    return db.prepare('SELECT * FROM barcodes WHERE barcode = ?').get(barcode);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO barcodes (barcode, name, brand, calories, protein, carbs, fat, serving_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.barcode,
      data.name,
      data.brand || '未知',
      data.calories || 0,
      data.protein || 0,
      data.carbs || 0,
      data.fat || 0,
      data.servingSize || '未知'
    );
    return this.findByBarcode(data.barcode);
  },

  upsert(data) {
    const existing = this.findByBarcode(data.barcode);
    if (existing) {
      const stmt = db.prepare(`
        UPDATE barcodes SET name = ?, brand = ?, calories = ?, protein = ?, carbs = ?, fat = ?, serving_size = ?
        WHERE barcode = ?
      `);
      stmt.run(data.name, data.brand || '未知', data.calories || 0, data.protein || 0, data.carbs || 0, data.fat || 0, data.servingSize || '未知', data.barcode);
    } else {
      this.create(data);
    }
    return this.findByBarcode(data.barcode);
  }
};

// Seed default barcodes if empty
const barcodeCount = db.prepare('SELECT COUNT(*) as count FROM barcodes').get();
if (barcodeCount.count === 0) {
  const defaultBarcodes = [
    { barcode: '4710138000014', name: '義美小泡芙', brand: '義美', calories: 140, protein: 2, carbs: 18, fat: 6, servingSize: '30g' },
    { barcode: '4710595600011', name: '泰山八寶粥', brand: '泰山', calories: 180, protein: 4, carbs: 30, fat: 4, servingSize: '250g' },
    { barcode: '4901234567890', name: '可口可樂', brand: '可口可樂', calories: 140, protein: 0, carbs: 35, fat: 0, servingSize: '330ml' },
    { barcode: '4712345678901', name: '乖乖', brand: '乖乖', calories: 200, protein: 3, carbs: 25, fat: 10, servingSize: '45g' },
    { barcode: '6920202888888', name: '維他奶', brand: '維他奶', calories: 100, protein: 5, carbs: 12, fat: 3, servingSize: '250ml' }
  ];

  for (const bc of defaultBarcodes) {
    BarcodeDB.create(bc);
  }
}

export default db;