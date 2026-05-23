import express from 'express';
import { analyzeFoodImage, parseNutritionalData } from '../services/minimax.js';
import { authMiddleware } from '../middleware/auth.js';
import { FoodLogDB, DailyProgressDB, UserProfileDB } from '../services/database.js';
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
    console.log('[Food/analyze] Calling analyzeFoodImage, image length:', base64Data?.length);
    const result = await analyzeFoodImage(base64Data, prompt);
    console.log('[Food/analyze] analyzeFoodImage result:', JSON.stringify(result));

    if (!result.success) {
      console.log('[Food/analyze] Failed:', result.error);
      return res.status(500).json({ error: result.error });
    }

    const content = result.data.content;
    console.log('[Food/analyze] AI content:', content);
    const nutrition = parseNutritionalData(content);

    res.json({
      success: true,
      analysis: {
        rawResponse: content,
        ...nutrition
      }
    });
  } catch (error) {
    console.error('[Food/analyze] Catch error:', error);
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
    console.log('[Food/upload] Calling analyzeFoodImage, image length:', base64Data?.length);
    const result = await analyzeFoodImage(base64Data, prompt);
    console.log('[Food/upload] analyzeFoodImage result:', JSON.stringify(result));

    if (!result.success) {
      console.log('[Food/upload] Failed:', result.error);
      return res.status(500).json({ error: result.error });
    }

    const content = result.data.content;
    console.log('[Food/upload] AI content:', content);
    const nutrition = parseNutritionalData(content);

    // Store in database
    const logEntry = FoodLogDB.create(req.user.id, {
      imageData: base64Data, // Store full base64 image
      mealType,
      calories: nutrition.totalCalories || 0,
      protein: nutrition.totalProtein || 0,
      carbs: nutrition.totalCarbs || 0,
      fat: nutrition.totalFat || 0,
      description: nutrition.name || nutrition.description || 'AI 分析食物'
    });

    console.log('[Food] Food log created:', {
      id: logEntry?.id,
      hasImage: !!base64Data,
      imageLength: base64Data?.length
    });

    // Update daily progress with TDEE goal
    const today = getLocalDate();
    const todayStats = FoodLogDB.getTodayStats(req.user.id);

    // Get user's TDEE from profile for goal_calories
    let goalCalories = 2000;
    try {
      const userProfile = UserProfileDB.findByUserId(req.user.id);
      if (userProfile) {
        const { custom_bmr, activity_level, weight, height, age, gender } = userProfile;
        let bmr = custom_bmr;
        if (!bmr) {
          if (gender === 'male') bmr = 10 * weight + 6.25 * height - 5 * age + 5;
          else if (gender === 'female') bmr = 10 * weight + 6.25 * height - 5 * age - 161;
          else bmr = 10 * weight + 6.25 * height - 5 * age;
        }
        const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
        const tdee = Math.round(bmr * (multipliers[activity_level] || 1.2));
        goalCalories = Math.round(tdee * 0.85);
      }
    } catch (e) {
      console.error('Failed to get TDEE for goal:', e.message);
    }

    DailyProgressDB.upsert(req.user.id, today, {
      totalCalories: todayStats.total_calories,
      totalProtein: todayStats.total_protein,
      totalCarbs: todayStats.total_carbs,
      totalFat: todayStats.total_fat,
      goalCalories
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

  // Calculate goalCalories for daily progress
  const calcGoalCalories = () => {
    let goal = 2000;
    try {
      const profile = UserProfileDB.findByUserId(req.user.id);
      if (profile) {
        const { custom_bmr, activity_level, weight, height, age, gender } = profile;
        let bmr = custom_bmr;
        if (!bmr) {
          if (gender === 'male') bmr = 10 * weight + 6.25 * height - 5 * age + 5;
          else if (gender === 'female') bmr = 10 * weight + 6.25 * height - 5 * age - 161;
          else bmr = 10 * weight + 6.25 * height - 5 * age;
        }
        const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
        const tdee = Math.round(bmr * (mults[activity_level] || 1.2));
        goal = Math.round(tdee * 0.85);
      }
    } catch (e) {
      console.error('Failed to get goal:', e.message);
    }
    return goal;
  };

  // Update daily progress
  const today = getLocalDate();
  const todayStats = FoodLogDB.getTodayStats(req.user.id);
  DailyProgressDB.upsert(req.user.id, today, {
    totalCalories: todayStats.total_calories,
    totalProtein: todayStats.total_protein,
    totalCarbs: todayStats.total_carbs,
    totalFat: todayStats.total_fat,
    goalCalories: calcGoalCalories()
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
      totalFat: todayStats.total_fat,
      goalCalories: 2000
    });
  }

  res.json({
    success: true,
    message: '刪除成功'
  });
});

export default router;