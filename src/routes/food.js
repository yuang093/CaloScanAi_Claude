import express from 'express';
import { analyzeFoodImage, parseNutritionalData } from '../services/minimax.js';
import { authMiddleware } from '../middleware/auth.js';
import { FoodLogDB, DailyProgressDB, UserProfileDB, BarcodeDB, FavoritesDB, ShoppingDB } from '../services/database.js';
import db from '../services/database.js';
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

    // Also add to food database (barcodes table) - generate pseudo-barcode for AI analyzed foods
    const foodName = nutrition.name || nutrition.description || 'AI 分析食物';
    const pseudoBarcode = 'AI_' + Date.now();
    try {
      BarcodeDB.create({
        barcode: pseudoBarcode,
        name: foodName,
        brand: 'AI 分析',
        calories: nutrition.totalCalories || 0,
        protein: nutrition.totalProtein || 0,
        carbs: nutrition.totalCarbs || 0,
        fat: nutrition.totalFat || 0,
        servingSize: '1 份'
      });
      console.log('[Food] Food database entry created for:', foodName);
    } catch (e) {
      // Ignore if already exists
      console.log('[Food] Food database entry may already exist:', e.message);
    }

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
  const { mealType, calories, protein, carbs, fat, description } = req.body;

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
    fat,
    description
  });

  // Sync update to barcodes table if description matches
  if (description || calories !== undefined) {
    const foodName = description || existingLog.description;
    // Find barcodes entry by name (AI foods have barcode like 'AI_*')
    const barcodeEntry = db.prepare(`
      SELECT id FROM barcodes WHERE name = ? OR (barcode LIKE 'AI_%' AND name = ?)
    `).get(foodName, foodName);

    if (barcodeEntry) {
      BarcodeDB.update(barcodeEntry.id, {
        name: foodName,
        calories: calories !== undefined ? calories : existingLog.calories,
        protein: protein !== undefined ? protein : existingLog.protein,
        carbs: carbs !== undefined ? carbs : existingLog.carbs,
        fat: fat !== undefined ? fat : existingLog.fat
      });
      console.log('[Food] BarcodeDB synced for:', foodName);
    }
  }

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

// GET /api/food/search - Search food database (authenticated)
router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query;

  let results;
  if (!q || q.trim().length < 1) {
    // Return all barcodes when no query provided
    results = BarcodeDB.getAll();
  } else {
    const searchTerm = '%' + q.trim() + '%';
    results = BarcodeDB.search(searchTerm);
  }

  res.json({
    success: true,
    data: results
  });
});

// POST /api/food/add-from-database - Add food from database to log (authenticated)
router.post('/add-from-database', authMiddleware, async (req, res, next) => {
  try {
    const { barcodeId, isFavorite } = req.body;

    if (!barcodeId) {
      return res.status(400).json({ error: '食物 ID 為必填欄位' });
    }

    let food;
    if (isFavorite) {
      const favorite = FavoritesDB.findById(parseInt(barcodeId));
      if (!favorite || favorite.user_id !== req.user.id) {
        return res.status(404).json({ error: '找不到此最愛項目' });
      }
      food = {
        name: favorite.name,
        calories: favorite.calories,
        protein: favorite.protein,
        carbs: favorite.carbs,
        fat: favorite.fat
      };
    } else {
      food = BarcodeDB.findById(parseInt(barcodeId));
      if (!food) {
        return res.status(404).json({ error: '找不到此食物資料' });
      }
    }

    // Create food log entry
    const logEntry = FoodLogDB.create(req.user.id, {
      imageData: '',
      mealType: 'general',
      calories: food.calories || 0,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
      description: food.name
    });

    // Increment use_count for favorite items
    if (isFavorite && barcodeId) {
      FavoritesDB.incrementUseCount(parseInt(barcodeId));
    }

    // Update daily progress
    const today = getLocalDate();
    const todayStats = FoodLogDB.getTodayStats(req.user.id);

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
      message: '已加入日誌',
      data: logEntry
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/food/favorites - Get user's favorites (authenticated)
router.get('/favorites', authMiddleware, async (req, res) => {
  const { sort = 'recent' } = req.query;
  const validSorts = ['recent', 'most_used', 'name'];
  const sortParam = validSorts.includes(sort) ? sort : 'recent';
  const favorites = FavoritesDB.findByUserId(req.user.id, { sort: sortParam });
  res.json({
    success: true,
    data: favorites
  });
});

// POST /api/food/favorites - Add to favorites (authenticated)
router.post('/favorites', authMiddleware, async (req, res) => {
  const { barcodeId, name, brand, calories, protein, carbs, fat, servingSize } = req.body;

  if (!name) {
    return res.status(400).json({ error: '食物名稱為必填欄位' });
  }

  const favorite = FavoritesDB.create(req.user.id, {
    barcodeId,
    name,
    brand: brand || '',
    calories: calories || 0,
    protein: protein || 0,
    carbs: carbs || 0,
    fat: fat || 0,
    servingSize: servingSize || ''
  });

  res.json({
    success: true,
    message: '已加入最愛',
    data: favorite
  });
});

// DELETE /api/food/favorites/:id - Remove from favorites (authenticated)
router.delete('/favorites/:id', authMiddleware, async (req, res) => {
  const result = FavoritesDB.delete(parseInt(req.params.id), req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '找不到此最愛項目' });
  }

  res.json({
    success: true,
    message: '已移除最愛'
  });
});

// GET /api/food/shopping-lists - Get user's shopping lists (authenticated)
router.get('/shopping-lists', authMiddleware, async (req, res) => {
  const lists = ShoppingDB.findByUserId(req.user.id);
  res.json({
    success: true,
    data: lists.map(l => ({
      ...l,
      items: JSON.parse(l.items || '[]')
    }))
  });
});

// POST /api/food/shopping-lists - Create shopping list (authenticated)
router.post('/shopping-lists', authMiddleware, async (req, res) => {
  const { name, items } = req.body;
  const list = ShoppingDB.create(req.user.id, { name, items: items || [] });
  res.json({
    success: true,
    data: { ...list, items: JSON.parse(list.items || '[]') }
  });
});

// PUT /api/food/shopping-lists/:id - Update shopping list (authenticated)
router.put('/shopping-lists/:id', authMiddleware, async (req, res) => {
  const { name, items } = req.body;
  const list = ShoppingDB.update(parseInt(req.params.id), req.user.id, { name, items: items || [] });
  if (!list) return res.status(404).json({ error: '找不到此購物清單' });
  res.json({
    success: true,
    data: { ...list, items: JSON.parse(list.items || '[]') }
  });
});

// DELETE /api/food/shopping-lists/:id - Delete shopping list (authenticated)
router.delete('/shopping-lists/:id', authMiddleware, async (req, res) => {
  const result = ShoppingDB.delete(parseInt(req.params.id), req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: '找不到此購物清單' });
  res.json({ success: true, message: '已刪除' });
});

// POST /api/food/shopping-lists/:id/items - Add item to list (authenticated)
router.post('/shopping-lists/:id/items', authMiddleware, async (req, res) => {
  const { name, calories } = req.body;
  const list = ShoppingDB.addItem(parseInt(req.params.id), req.user.id, { name, calories });
  if (!list) return res.status(404).json({ error: '找不到此購物清單' });
  res.json({
    success: true,
    data: { ...list, items: JSON.parse(list.items || '[]') }
  });
});

// PUT /api/food/shopping-lists/:id/items/:itemId - Toggle item (authenticated)
router.put('/shopping-lists/:id/items/:itemId', authMiddleware, async (req, res) => {
  const list = ShoppingDB.toggleItem(parseInt(req.params.id), req.user.id, parseInt(req.params.itemId));
  if (!list) return res.status(404).json({ error: '找不到此項目' });
  res.json({
    success: true,
    data: { ...list, items: JSON.parse(list.items || '[]') }
  });
});

// DELETE /api/food/shopping-lists/:id/items/:itemId - Remove item (authenticated)
router.delete('/shopping-lists/:id/items/:itemId', authMiddleware, async (req, res) => {
  const list = ShoppingDB.removeItem(parseInt(req.params.id), req.user.id, parseInt(req.params.itemId));
  if (!list) return res.status(404).json({ error: '找不到此項目' });
  res.json({
    success: true,
    data: { ...list, items: JSON.parse(list.items || '[]') }
  });
});

// GET /api/food/recent - Get recent food logs to copy (authenticated)
router.get('/recent', authMiddleware, async (req, res) => {
  const { limit = 10 } = req.query;
  const result = FoodLogDB.findByUserId(req.user.id, {
    limit: parseInt(limit),
    offset: 0
  });

  res.json({
    success: true,
    data: result.logs
  });
});

export default router;