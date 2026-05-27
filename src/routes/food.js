import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { analyzeFoodImage, parseNutritionalData } from '../services/minimax.js';
import { authMiddleware } from '../middleware/auth.js';
import { FoodLogDB, DailyProgressDB, UserProfileDB, BarcodeDB, FavoritesDB, ShoppingDB } from '../services/database.js';
import db from '../services/database.js';
import { getLocalDate } from '../utils/date.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = join(__dirname, '../../uploads');
const router = express.Router();

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
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

    // Store image to file system
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '/'); // YYYY/MM/DD
    const subDir = 'foods/' + dateStr;
    const targetDir = join(UPLOADS_DIR, subDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filename = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.jpg';
    const imagePath = subDir + '/' + filename;
    const fullPath = join(UPLOADS_DIR, imagePath);

    // Write image file
    const imageBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(fullPath, imageBuffer);
    console.log('[Food/upload] Image saved to:', fullPath);

    // Also add to food database (barcodes table) - generate pseudo-barcode for AI analyzed foods
    const foodName = nutrition.name || nutrition.description || 'AI 分析食物';
    const pseudoBarcode = 'AI_' + Date.now();
    let barcodeId = null;
    try {
      const barcodeEntry = BarcodeDB.create({
        barcode: pseudoBarcode,
        name: foodName,
        brand: 'AI 分析',
        calories: nutrition.totalCalories || 0,
        protein: nutrition.totalProtein || 0,
        carbs: nutrition.totalCarbs || 0,
        fat: nutrition.totalFat || 0,
        servingSize: '1 份',
        imagePath: imagePath
      });
      barcodeId = barcodeEntry?.id;
      console.log('[Food] Food database entry created for:', foodName, 'barcodeId:', barcodeId);
    } catch (e) {
      // Ignore if already exists
      console.log('[Food] Food database entry may already exist:', e.message);
    }

    // Store in database - with barcode_id correlation (using imagePath instead of base64)
    const logEntry = FoodLogDB.create(req.user.id, {
      imagePath: imagePath,
      mealType,
      calories: nutrition.totalCalories || 0,
      protein: nutrition.totalProtein || 0,
      carbs: nutrition.totalCarbs || 0,
      fat: nutrition.totalFat || 0,
      description: nutrition.name || nutrition.description || 'AI 分析食物',
      barcodeId: barcodeId
    });

    console.log('[Food] Food log created:', {
      id: logEntry?.id,
      hasImage: !!base64Data,
      imageLength: base64Data?.length,
      barcodeId: barcodeId
    });

    // Update daily progress with TDEE goal
    const today = getLocalDate();
    const todayStats = FoodLogDB.getTodayStats(req.user.id, today);

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

  // 精準同步：透過 barcode_id 更新 barcodes 表
  try {
    const currentLog = FoodLogDB.findById(parseInt(req.params.id));
    if (currentLog && currentLog.barcode_id) {
      const stmt = db.prepare(`
        UPDATE barcodes
        SET name = ?, calories = ?, protein = ?, carbs = ?, fat = ?
        WHERE id = ?
      `);
      stmt.run(description || currentLog.description, calories, protein, carbs, fat, currentLog.barcode_id);
      console.log('✅ 已精準同步更新 barcodes (ID: ' + currentLog.barcode_id + ')');
    } else {
      console.log('⚠️ 此日誌為舊資料無 barcode_id，略過標準食物庫同步。');
    }
  } catch (error) {
    console.error('更新食物日誌失敗:', error);
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
  const todayStats = FoodLogDB.getTodayStats(req.user.id, today);
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
    const todayStats = FoodLogDB.getTodayStats(req.user.id, today);
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
    const { barcodeId, isFavorite, name, calories, protein, carbs, fat } = req.body;

    let food;

    // 優先使用直接傳入的食物資料（copyFoodLog 場景）
    if (name && calories !== undefined) {
      food = {
        name: name,
        calories: calories || 0,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        imagePath: req.body.imagePath || null
      };
    }
    // 從最愛新增
    else if (barcodeId && isFavorite) {
      const favorite = FavoritesDB.findById(parseInt(barcodeId));
      if (!favorite || favorite.user_id !== req.user.id) {
        return res.status(404).json({ error: '找不到此最愛項目' });
      }
      food = {
        name: favorite.name,
        calories: favorite.calories,
        protein: favorite.protein,
        carbs: favorite.carbs,
        fat: favorite.fat,
        imagePath: favorite.image_path || null
      };
      FavoritesDB.incrementUseCount(parseInt(barcodeId));
    }
    // 從 barcodes 資料庫新增
    else if (barcodeId) {
      const barcode = BarcodeDB.findById(parseInt(barcodeId));
      if (!barcode) {
        return res.status(404).json({ error: '找不到此食物資料' });
      }
      food = {
        name: barcode.name,
        calories: barcode.calories,
        protein: barcode.protein,
        carbs: barcode.carbs,
        fat: barcode.fat,
        imagePath: barcode.image_path || null
      };
    } else {
      return res.status(400).json({ error: '食物 ID 或食物資料為必填欄位' });
    }

    // Create food log entry
    const logEntry = FoodLogDB.create(req.user.id, {
      imagePath: food.imagePath || null,
      mealType: 'general',
      calories: food.calories || 0,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
      description: food.name
    });

    // Update daily progress
    const today = getLocalDate();
    const todayStats = FoodLogDB.getTodayStats(req.user.id, today);

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

  // 如果是最常食用排序，從 food_logs 統計
  if (sort === 'most_used') {
    // 從 food_logs 統計各食物的食用次數（注意：findByUserId 回傳 { logs, total }）
    const { logs } = FoodLogDB.findByUserId(req.user.id, { limit: 500 });
    const foodCountMap = {};
    logs.forEach(log => {
      const key = log.description || '未命名';
      if (!foodCountMap[key]) {
        foodCountMap[key] = {
          name: key,
          count: 0,
          total_calories: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
          image_path: log.image_path
        };
      }
      foodCountMap[key].count++;
      foodCountMap[key].total_calories += (log.calories || 0);
      foodCountMap[key].total_protein += (log.protein || 0);
      foodCountMap[key].total_carbs += (log.carbs || 0);
      foodCountMap[key].total_fat += (log.fat || 0);
      // 優先保留有圖片的 image_path
      if (!foodCountMap[key].image_path && log.image_path) {
        foodCountMap[key].image_path = log.image_path;
      }
    });

    // 轉為陣列並排序
    const mostEaten = Object.values(foodCountMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(f => ({
        name: f.name,
        use_count: f.count,
        calories: Math.round(f.total_calories / f.count),
        protein: Math.round(f.total_protein / f.count * 10) / 10,
        carbs: Math.round(f.total_carbs / f.count * 10) / 10,
        fat: Math.round(f.total_fat / f.count * 10) / 10,
        image_path: f.image_path,
        isStats: true
      }));

    return res.json({
      success: true,
      data: mostEaten
    });
  }

  // 一般排序（recent 或 name）
  const validSorts = ['recent', 'name'];
  const sortParam = validSorts.includes(sort) ? sort : 'recent';
  const favorites = FavoritesDB.findByUserId(req.user.id, { sort: sortParam });
  res.json({
    success: true,
    data: favorites
  });
});

// POST /api/food/favorites - Add to favorites (authenticated)
router.post('/favorites', authMiddleware, async (req, res) => {
  const { barcodeId, name, brand, calories, protein, carbs, fat, servingSize, imagePath } = req.body;

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
    servingSize: servingSize || '',
    imagePath: imagePath || null
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