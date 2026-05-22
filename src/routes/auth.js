import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';
import { UserDB } from '../services/database.js';

const router = express.Router();

// POST /api/auth/register - 註冊新用戶
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: '請填寫所有必填欄位' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密碼至少需要 6 個字元' });
    }

    // Check if user exists
    const existingUser = UserDB.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: '此電子郵件已被註冊' });
    }

    // Create user
    const user = UserDB.create(email, password, name);

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name
    });

    res.status(201).json({
      success: true,
      message: '註冊成功',
      data: {
        user: {
          id: user.id,
          email: user.email,
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
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: '請填寫電子郵件和密碼' });
    }

    // Verify password
    const user = UserDB.verifyPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: '電子郵件或密碼錯誤' });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name
    });

    res.json({
      success: true,
      message: '登入成功',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - 獲取當前用戶資訊
router.get('/me', async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供認證令牌' });
  }

  const token = authHeader.split(' ')[1];
  const { verifyToken } = await import('../middleware/auth.js');

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: '無效的認證令牌' });
    }

    const user = UserDB.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: '用戶不存在' });
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