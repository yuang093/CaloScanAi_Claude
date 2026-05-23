import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { UserDB } from '../services/database.js';

const router = express.Router();

// POST /api/auth/register - 註冊新用戶
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, name } = req.body;

    // Validation
    if (!username || !password || !name) {
      return res.status(400).json({ success: false, error: '請填寫所有必填欄位' });
    }

    if (username.length < 3) {
      return res.status(400).json({ success: false, error: '帳號至少需要 3 個字元' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: '密碼至少需要 6 個字元' });
    }

    // Check if user exists
    const existingUser = UserDB.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({ success: false, error: '此帳號已被註冊' });
    }

    // Create user
    const user = UserDB.create(username, password, name);

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      name: user.name
    });

    res.status(201).json({
      success: true,
      message: '註冊成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - 登入
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '請填寫帳號和密碼' });
    }

    // Verify password
    const user = UserDB.verifyPassword(username, password);
    if (!user) {
      return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      name: user.name
    });

    res.json({
      success: true,
      message: '登入成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - 獲取當前用戶資訊
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = UserDB.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用戶不存在' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

export default router;