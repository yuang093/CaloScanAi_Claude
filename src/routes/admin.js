import express from 'express';
import bcrypt from 'bcryptjs';
import { UserDB, FoodLogDB, DailyProgressDB, QuoteDB } from '../services/database.js';
import { verifyToken } from '../middleware/auth.js';
import { getLocalDate } from '../utils/date.js';
import db from '../services/database.js';

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
  const todayStats = FoodLogDB.getTodayStats(updated.user_id);
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

export default router;