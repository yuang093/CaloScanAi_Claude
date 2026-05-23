import express from 'express';
import { analyzeFoodImage, parseNutritionalData } from '../services/minimax.js';
import { authMiddleware } from '../middleware/auth.js';
import { FoodLogDB, DailyProgressDB } from '../services/database.js';
import { getLocalDate } from '../utils/date.js';

const router = express.Router();

// POST /api/food/analyze - Analyze food image (public endpoint)
router.post('/analyze', async (req, res, next) => {
  try {
    const { image, prompt } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const result = await analyzeFoodImage(base64Data, prompt);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    const content = result.data.content;
    const nutrition = parseNutritionalData(content);

    res.json({
      success: true,
      analysis: {
        rawResponse: content,
        ...nutrition
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/food/upload - Upload and analyze food image (authenticated)
router.post('/upload', authMiddleware, async (req, res, next) => {
  try {
    const { image, mealType = 'general', prompt } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const result = await analyzeFoodImage(base64Data, prompt);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    const content = result.data.content;
    const nutrition = parseNutritionalData(content);

    // Store in database
    const logEntry = FoodLogDB.create(req.user.id, {
      imageData: base64Data, // Store full base64 image
      mealType,
      calories: nutrition.totalCalories || 0,
      protein: nutrition.totalProtein || 0,
      carbs: nutrition.totalCarbs || 0,
      fat: nutrition.totalFat || 0,
      description: content.substring(0, 500)
    });

    // Update daily progress
    const today = getLocalDate();
    const todayStats = FoodLogDB.getTodayStats(req.user.id);
    DailyProgressDB.upsert(req.user.id, today, {
      totalCalories: todayStats.total_calories,
      totalProtein: todayStats.total_protein,
      totalCarbs: todayStats.total_carbs,
      totalFat: todayStats.total_fat
    });

    res.json({
      success: true,
      data: logEntry
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/food/logs - Get user's food logs (authenticated)
router.get('/logs', authMiddleware, async (req, res) => {
  const { date, limit = 20, offset = 0 } = req.query;

  const result = FoodLogDB.findByUserId(req.user.id, {
    date,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: result
  });
});

// GET /api/food/logs/:id - Get specific food log (authenticated)
router.get('/logs/:id', authMiddleware, async (req, res) => {
  const log = FoodLogDB.findById(parseInt(req.params.id));

  if (!log || log.user_id !== req.user.id) {
    return res.status(404).json({ error: '找不到指定的食物記錄' });
  }

  res.json({
    success: true,
    data: log
  });
});

// PUT /api/food/logs/:id - Update food log (authenticated)
router.put('/logs/:id', authMiddleware, async (req, res) => {
  const { mealType, calories, protein, carbs, fat } = req.body;

  // Check ownership
  const existingLog = FoodLogDB.findById(parseInt(req.params.id));
  if (!existingLog || existingLog.user_id !== req.user.id) {
    return res.status(404).json({ error: '找不到指定的食物記錄' });
  }

  const updatedLog = FoodLogDB.update(parseInt(req.params.id), req.user.id, {
    mealType,
    calories,
    protein,
    carbs,
    fat
  });

  // Update daily progress
  const today = getLocalDate();
  const todayStats = FoodLogDB.getTodayStats(req.user.id);
  DailyProgressDB.upsert(req.user.id, today, {
    totalCalories: todayStats.total_calories,
    totalProtein: todayStats.total_protein,
    totalCarbs: todayStats.total_carbs,
    totalFat: todayStats.total_fat
  });

  res.json({
    success: true,
    data: updatedLog
  });
});

// DELETE /api/food/logs/:id - Delete food log (authenticated)
router.delete('/logs/:id', authMiddleware, async (req, res) => {
  // Check ownership
  const existingLog = FoodLogDB.findById(parseInt(req.params.id));
  if (!existingLog || existingLog.user_id !== req.user.id) {
    return res.status(404).json({ error: '找不到指定的食物記錄' });
  }

  const deleted = FoodLogDB.delete(parseInt(req.params.id), req.user.id);

  if (deleted) {
    // Update daily progress
    const today = getLocalDate();
    const todayStats = FoodLogDB.getTodayStats(req.user.id);
    DailyProgressDB.upsert(req.user.id, today, {
      totalCalories: todayStats.total_calories,
      totalProtein: todayStats.total_protein,
      totalCarbs: todayStats.total_carbs,
      totalFat: todayStats.total_fat
    });
  }

  res.json({
    success: true,
    message: '刪除成功'
  });
});

export default router;