import express from 'express';
import bcrypt from 'bcryptjs';
import { UserDB, FoodLogDB, DailyProgressDB, QuoteDB, BarcodeDB } from '../services/database.js';
import { verifyToken } from '../middleware/auth.js';
import { getLocalDate } from '../utils/date.js';
import db from '../services/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const router = express.Router();

// Middleware to check admin role
const adminMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供認證令牌' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: '無效的認證令牌' });
    }

    // Check if user is admin via role field
    const user = UserDB.findById(decoded.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理員權限' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: '無效的認證令牌' });
  }
};

// GET /api/admin/users - Get all users (admin only)
router.get('/users', adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC').all();

  res.json({
    success: true,
    data: users
  });
});

// GET /api/admin/users/:id - Get specific user (admin only)
router.get('/users/:id', adminMiddleware, (req, res) => {
  const user = UserDB.findById(parseInt(req.params.id));

  if (!user) {
    return res.status(404).json({ error: '用戶不存在' });
  }

  const logCount = db.prepare('SELECT COUNT(*) as count FROM food_logs WHERE user_id = ?').get(req.params.id);

  res.json({
    success: true,
    data: {
      ...user,
      foodLogCount: logCount.count
    }
  });
});

// DELETE /api/admin/users/:id - Delete user (admin only)
router.delete('/users/:id', adminMiddleware, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '無法刪除自己的帳號' });
  }

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '用戶不存在' });
  }

  res.json({
    success: true,
    message: '用戶已刪除'
  });
});

// PUT /api/admin/users/:id/password - Update user password (admin only)
router.put('/users/:id/password', adminMiddleware, (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密碼至少需要 6 個字元' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '用戶不存在' });
  }

  res.json({
    success: true,
    message: '密碼已更新'
  });
});

// PUT /api/admin/users/:id/promote - 提升用戶為管理員 (admin only)
router.put('/users/:id/promote', adminMiddleware, (req, res) => {
  const userId = parseInt(req.params.id);

  if (userId === req.user.id) {
    return res.status(400).json({ error: '無法將自己降為管理員' });
  }

  const result = db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '用戶不存在' });
  }

  res.json({
    success: true,
    message: '已提升為管理員'
  });
});

// PUT /api/admin/users/:id/demote - 將管理員降為會員 (admin only)
router.put('/users/:id/demote', adminMiddleware, (req, res) => {
  const userId = parseInt(req.params.id);

  if (userId === req.user.id) {
    return res.status(400).json({ error: '無法將自己降為會員' });
  }

  const result = db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: '用戶不存在' });
  }

  res.json({
    success: true,
    message: '已降為會員'
  });
});

// GET /api/admin/stats - Get system statistics (admin only)
router.get('/stats', adminMiddleware, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalFoodLogs = db.prepare('SELECT COUNT(*) as count FROM food_logs').get().count;
  const totalCaloriesLogged = db.prepare('SELECT COALESCE(SUM(calories), 0) as total FROM food_logs').get().total;
  const avgCaloriesPerUser = totalUsers > 0 ? Math.round(totalCaloriesLogged / totalUsers) : 0;

  const topUsers = db.prepare(`
    SELECT u.id, u.name, u.username, COUNT(f.id) as log_count, COALESCE(SUM(f.calories), 0) as total_calories
    FROM users u
    LEFT JOIN food_logs f ON u.id = f.user_id
    GROUP BY u.id
    ORDER BY log_count DESC
    LIMIT 5
  `).all();

  const recentLogs = db.prepare(`
    SELECT f.*, u.name as user_name
    FROM food_logs f
    JOIN users u ON f.user_id = u.id
    ORDER BY f.created_at DESC
    LIMIT 10
  `).all();

  res.json({
    success: true,
    data: {
      summary: {
        totalUsers,
        totalFoodLogs,
        totalCaloriesLogged,
        avgCaloriesPerUser
      },
      topUsers,
      recentLogs
    }
  });
});

// GET /api/admin/food-logs - Get all food logs (admin only)
router.get('/food-logs', adminMiddleware, (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  const logs = db.prepare(`
    SELECT f.*, u.name as user_name, u.username as user_username
    FROM food_logs f
    JOIN users u ON f.user_id = u.id
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset));

  const total = db.prepare('SELECT COUNT(*) as count FROM food_logs').get().count;

  res.json({
    success: true,
    data: {
      logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  });
});

// PUT /api/admin/food-logs/:id - Update food log (admin only)
router.put('/food-logs/:id', adminMiddleware, (req, res) => {
  const { calories, protein, carbs, fat, description } = req.body;

  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return res.status(400).json({ error: '營養資料為必填欄位' });
  }

  const stmt = db.prepare(`
    UPDATE food_logs
    SET calories = ?, protein = ?, carbs = ?, fat = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const result = stmt.run(calories, protein, carbs, fat, description || null, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '食物記錄不存在' });
  }

  const updated = FoodLogDB.findById(parseInt(req.params.id));

  // Update daily progress
  const today = getLocalDate();
  const todayStats = FoodLogDB.getTodayStats(updated.user_id, today);
  DailyProgressDB.upsert(updated.user_id, today, {
    totalCalories: todayStats.total_calories,
    totalProtein: todayStats.total_protein,
    totalCarbs: todayStats.total_carbs,
    totalFat: todayStats.total_fat
  });

  res.json({
    success: true,
    message: '食物記錄已更新',
    data: updated
  });
});

// DELETE /api/admin/food-logs/:id - Delete food log (admin only)
router.delete('/food-logs/:id', adminMiddleware, (req, res) => {
  const log = FoodLogDB.findById(parseInt(req.params.id));
  if (!log) {
    return res.status(404).json({ error: '食物記錄不存在' });
  }

  const result = db.prepare('DELETE FROM food_logs WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '食物記錄不存在' });
  }

  // Update daily progress
  const today = getLocalDate();
  const todayStats = FoodLogDB.getTodayStats(log.user_id, today);
  DailyProgressDB.upsert(log.user_id, today, {
    totalCalories: todayStats.total_calories,
    totalProtein: todayStats.total_protein,
    totalCarbs: todayStats.total_carbs,
    totalFat: todayStats.total_fat
  });

  res.json({
    success: true,
    message: '食物記錄已刪除'
  });
});

// GET /api/admin/barcodes - Get all barcodes (food database) (admin only)
router.get('/barcodes', adminMiddleware, (req, res) => {
  const barcodes = db.prepare('SELECT * FROM barcodes ORDER BY created_at DESC').all();

  res.json({
    success: true,
    data: barcodes
  });
});

// PUT /api/admin/barcodes/:id - Update barcode (admin only)
router.put('/barcodes/:id', adminMiddleware, (req, res) => {
  const { barcode, name, brand, servingSize, calories, protein, carbs, fat } = req.body;
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: '無效的食物 ID' });
  }

  if (!name || calories === undefined) {
    return res.status(400).json({ error: '名稱和熱量為必填欄位' });
  }

  // Check for UNIQUE constraint violation before updating
  if (barcode) {
    const existing = db.prepare('SELECT id FROM barcodes WHERE barcode = ? AND id != ?').get(barcode, id);
    if (existing) {
      return res.status(400).json({ error: '條碼號碼已存在於其他記錄' });
    }
  }

  const stmt = db.prepare(`
    UPDATE barcodes
    SET barcode = ?, name = ?, brand = ?, serving_size = ?, calories = ?, protein = ?, carbs = ?, fat = ?
    WHERE id = ?
  `);
  const result = stmt.run(barcode || '', name, brand || '', servingSize || '', calories, protein || 0, carbs || 0, fat || 0, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '食物資料不存在' });
  }

  const updated = db.prepare('SELECT * FROM barcodes WHERE id = ?').get(id);

  res.json({
    success: true,
    message: '食物資料已更新',
    data: updated
  });
});

// DELETE /api/admin/barcodes/:id - Delete barcode (admin only)
router.delete('/barcodes/:id', adminMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM barcodes WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '食物資料不存在' });
  }

  res.json({
    success: true,
    message: '食物資料已刪除'
  });
});

// GET /api/admin/quotes - Get all quotes (admin only)
router.get('/quotes', adminMiddleware, (req, res) => {
  const quotes = QuoteDB.getAll();
  res.json({
    success: true,
    data: quotes
  });
});

// POST /api/admin/quotes - Add new quote (admin only)
router.post('/quotes', adminMiddleware, (req, res) => {
  const { quote, author } = req.body;

  if (!quote) {
    return res.status(400).json({ error: '名言內容為必填欄位' });
  }

  const result = db.prepare('INSERT INTO daily_quotes (quote, author) VALUES (?, ?)').run(quote, author || '佚名');

  res.json({
    success: true,
    data: {
      id: result.lastInsertRowid,
      quote,
      author: author || '佚名'
    }
  });
});

// DELETE /api/admin/quotes/:id - Delete quote (admin only)
router.delete('/quotes/:id', adminMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM daily_quotes WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '名言不存在' });
  }

  res.json({
    success: true,
    message: '名言已刪除'
  });
});

// GET /api/admin/backup - Get database backup (admin only)
router.get('/backup', adminMiddleware, (req, res) => {
  try {
    const backupData = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      tables: {
        barcodes: db.prepare('SELECT * FROM barcodes ORDER BY id').all(),
        users: db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY id').all(),
        user_profiles: db.prepare('SELECT * FROM user_profiles').all(),
        daily_quotes: db.prepare('SELECT * FROM daily_quotes ORDER BY id').all(),
        food_logs: db.prepare('SELECT * FROM food_logs ORDER BY id').all(),
        daily_progress: db.prepare('SELECT * FROM daily_progress ORDER BY id').all(),
        favorites: db.prepare('SELECT * FROM favorites ORDER BY id').all(),
        shopping_lists: db.prepare('SELECT * FROM shopping_lists ORDER BY id').all()
      }
    };

    res.json({
      success: true,
      data: backupData
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: '備份失敗' });
  }
});

// POST /api/admin/restore - Restore database from backup (admin only)
router.post('/restore', adminMiddleware, (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !data.tables) {
      return res.status(400).json({ error: '無效的備份資料' });
    }

    const tables = data.tables;

    // Restore barcodes
    if (tables.barcodes && Array.isArray(tables.barcodes)) {
      db.exec('DELETE FROM barcodes');
      const barcodeStmt = db.prepare(`
        INSERT INTO barcodes (barcode, name, brand, calories, protein, carbs, fat, serving_size, image_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of tables.barcodes) {
        barcodeStmt.run(
          item.barcode, item.name, item.brand || '未知',
          item.calories || 0, item.protein || 0, item.carbs || 0, item.fat || 0,
          item.serving_size || '未知', item.image_path || null,
          item.created_at || new Date().toISOString()
        );
      }
    }

    // Restore users (password is hashed, so we skip password column for security)
    if (tables.users && Array.isArray(tables.users)) {
      // Remove existing non-admin users, keep admins
      db.exec("DELETE FROM users WHERE role = 'user'");
      const userStmt = db.prepare(`
        INSERT INTO users (username, name, role, created_at) VALUES (?, ?, ?, ?)
      `);
      for (const item of tables.users) {
        if (item.role === 'admin') {
          userStmt.run(item.username, item.name, item.role, item.created_at);
        }
      }
    }

    // Restore user_profiles
    if (tables.user_profiles && Array.isArray(tables.user_profiles)) {
      for (const item of tables.user_profiles) {
        const existing = db.prepare('SELECT id FROM user_profiles WHERE user_id = ?').get(item.user_id);
        if (!existing) {
          db.prepare(`
            INSERT INTO user_profiles (user_id, weight, height, age, gender, activity_level, goal_calories, custom_bmr, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.user_id, item.weight, item.height, item.age, item.gender, item.activity_level,
            item.goal_calories, item.custom_bmr, item.created_at);
        }
      }
    }

    // Restore daily_quotes
    if (tables.daily_quotes && Array.isArray(tables.daily_quotes)) {
      db.exec('DELETE FROM daily_quotes');
      const quoteStmt = db.prepare('INSERT INTO daily_quotes (quote, author, created_at) VALUES (?, ?, ?)');
      for (const item of tables.daily_quotes) {
        quoteStmt.run(item.quote, item.author || null, item.created_at);
      }
    }

    // Restore food_logs
    if (tables.food_logs && Array.isArray(tables.food_logs)) {
      for (const item of tables.food_logs) {
        const existing = db.prepare('SELECT id FROM food_logs WHERE id = ?').get(item.id);
        if (!existing) {
          db.prepare(`
            INSERT INTO food_logs (id, user_id, image_path, meal_type, calories, protein, carbs, fat, description, barcode_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.id, item.user_id, item.image_path || null, item.meal_type,
            item.calories || 0, item.protein || 0, item.carbs || 0, item.fat || 0,
            item.description, item.barcode_id, item.created_at);
        }
      }
    }

    // Restore daily_progress
    if (tables.daily_progress && Array.isArray(tables.daily_progress)) {
      for (const item of tables.daily_progress) {
        const existing = db.prepare('SELECT id FROM daily_progress WHERE id = ?').get(item.id);
        if (!existing) {
          db.prepare(`
            INSERT INTO daily_progress (id, user_id, date, total_calories, total_protein, total_carbs, total_fat, goal_calories, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.id, item.user_id, item.date, item.total_calories || 0,
            item.total_protein || 0, item.total_carbs || 0, item.total_fat || 0,
            item.goal_calories || 2000, item.created_at);
        }
      }
    }

    // Restore favorites
    if (tables.favorites && Array.isArray(tables.favorites)) {
      for (const item of tables.favorites) {
        const existing = db.prepare('SELECT id FROM favorites WHERE id = ?').get(item.id);
        if (!existing) {
          db.prepare(`
            INSERT INTO favorites (id, user_id, barcode_id, name, brand, calories, protein, carbs, fat, serving_size, use_count, image_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.id, item.user_id, item.barcode_id, item.name, item.brand,
            item.calories || 0, item.protein || 0, item.carbs || 0, item.fat || 0,
            item.serving_size, item.use_count || 0, item.image_path || null, item.created_at);
        }
      }
    }

    // Restore shopping_lists
    if (tables.shopping_lists && Array.isArray(tables.shopping_lists)) {
      for (const item of tables.shopping_lists) {
        const existing = db.prepare('SELECT id FROM shopping_lists WHERE id = ?').get(item.id);
        if (!existing) {
          db.prepare(`
            INSERT INTO shopping_lists (id, user_id, name, items, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(item.id, item.user_id, item.name, item.items || '[]', item.created_at);
        }
      }
    }

    res.json({
      success: true,
      message: '還原成功'
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: '還原失敗: ' + error.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 取得實際的 data 目錄路徑（從 server/index.js 往上两级）
const dataDir = join(process.cwd(), 'data');
const backupDir = join(dataDir, 'backups/db'); // 放在 data volume 內

// GET /api/admin/db/backup - 備份資料庫到 VPS
router.get('/db/backup', adminMiddleware, (req, res) => {
  try {
    const dbFile = join(dataDir, 'caloscanai.db');
    if (!fs.existsSync(dbFile)) {
      return res.status(404).json({ error: '資料庫檔案不存在' });
    }

    // 確保備份目錄存在
    fs.mkdirSync(backupDir, { recursive: true });

    const date = new Date();
    const dateStr = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `caloscanai_${dateStr}.db`;
    const destPath = join(backupDir, filename);

    // 使用 Node.js 直接複製檔案（無需 sqlite3 CLI）
    fs.copyFileSync(dbFile, destPath);

    const stats = fs.statSync(destPath);
    const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort().reverse();

    res.json({
      success: true,
      message: '資料庫備份成功',
      data: {
        filename,
        path: destPath,
        size: stats.size,
        createdAt: stats.mtime.toISOString(),
        backups: backups.slice(0, 10) // 最近 10 個備份
      }
    });
  } catch (error) {
    console.error('DB backup error:', error);
    res.status(500).json({ error: '備份失敗: ' + error.message });
  }
});

// GET /api/admin/db/list - 列出 VPS 上的備份
router.get('/db/list', adminMiddleware, (req, res) => {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stats = fs.statSync(join(backupDir, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: backups });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: '取得備份列表失敗' });
  }
});

// POST /api/admin/db/restore/:filename - 從 VPS 備份還原
router.post('/db/restore/:filename', adminMiddleware, (req, res) => {
  try {
    const filename = req.params.filename;
    // 允許字母、數字、底線、點、連字符、冒號（ISO時間格式）
    const safeFilename = filename.replace(/[^a-zA-Z0-9_.\-:]/g, '');
    const srcPath = join(backupDir, safeFilename);
    const dbFile = join(dataDir, 'caloscanai.db');

    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: '備份檔案不存在: ' + safeFilename });
    }

    // 先備份當前資料庫（以防萬一）
    fs.mkdirSync(backupDir, { recursive: true });
    const backupName = `before_restore_${Date.now()}.db`;
    fs.copyFileSync(dbFile, join(backupDir, backupName));

    // 複製備份檔案到資料庫位置（不關閉連接，讓 better-sqlite3 自行處理）
    fs.copyFileSync(srcPath, dbFile);

    res.json({
      success: true,
      message: '還原成功，已自動備份當前資料庫'
    });
  } catch (error) {
    console.error('DB restore error:', error);
    res.status(500).json({ error: '還原失敗: ' + error.message });
  }
});

// DELETE /api/admin/db/:filename - 刪除 VPS 備份
router.delete('/db/:filename', adminMiddleware, (req, res) => {
  try {
    const filename = req.params.filename;
    const safeFilename = filename.replace(/[^a-zA-Z0-9_.\-:]/g, '');
    const filePath = join(backupDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '備份檔案不存在' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: '刪除成功' });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({ error: '刪除失敗: ' + error.message });
  }
});

// GET /api/admin/db/download - 下載資料庫到電腦
router.get('/db/download', adminMiddleware, (req, res) => {
  try {
    const dbFile = join(dataDir, 'caloscanai.db');
    if (!fs.existsSync(dbFile)) {
      return res.status(404).json({ error: '資料庫檔案不存在' });
    }

    // 讀取檔案為緩衝區（避免 sendFile 被鎖定）
    const fileBuffer = fs.readFileSync(dbFile);
    const filename = `caloscanai_${new Date().toISOString().slice(0, 10)}.db`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Length', fileBuffer.length);
    res.end(fileBuffer);
  } catch (error) {
    console.error('DB download error:', error);
    res.status(500).json({ error: '下載失敗: ' + error.message });
  }
});

// POST /api/admin/db/upload - 上傳資料庫檔案還原
router.post('/db/upload', adminMiddleware, (req, res) => {
  try {
    if (!req.body || !req.body.dbData) {
      return res.status(400).json({ error: '未提供資料庫檔案' });
    }

    const buffer = Buffer.from(req.body.dbData, 'base64');
    const dbFile = join(dataDir, 'caloscanai.db');

    // 先備份當前資料庫
    fs.mkdirSync(backupDir, { recursive: true });
    const backupName = `before_upload_${Date.now()}.db`;
    fs.copyFileSync(dbFile, join(backupDir, backupName));

    // 關閉資料庫連接
    db.close();

    // 寫入新資料庫檔案
    fs.writeFileSync(dbFile, buffer);

    res.json({
      success: true,
      message: '上傳還原成功，已自動備份當前資料庫'
    });
  } catch (error) {
    console.error('DB upload error:', error);
    res.status(500).json({ error: '上傳失敗: ' + error.message });
  }
});

export default router;