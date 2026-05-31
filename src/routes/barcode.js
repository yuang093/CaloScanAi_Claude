import express from 'express';
import { BarcodeDB, FoodLogDB, DailyProgressDB, UserProfileDB } from '../services/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { analyzeFoodImage, analyzeNutritionLabel, parseNutritionOCRResult } from '../services/minimax.js';
import { getLocalDate } from '../utils/date.js';

const router = express.Router();

// POST /api/barcode/scan - Scan barcode from image using AI
router.post('/scan', authMiddleware, async (req, res, next) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: '圖片為必填欄位' });
    }

    // Use AI Vision to detect barcode from image
    const result = await analyzeFoodImage(image, '請仔細辨識這張圖片中的條碼數字。圖片中可能有一維條碼（直線條紋圖案）或二維條碼（方塊圖案 like QR code）。請回傳 JSON 格式：{"barcode": "偵測到的條碼號碼"}。如果沒有看到條碼，回傳 {"barcode": null}。只回傳 JSON，不要其他文字。');

    if (!result.success) {
      return res.status(500).json({ error: result.error || '掃描失敗' });
    }

    // Parse the AI response to extract barcode
    let barcode = null;
    try {
      const content = result.data?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        barcode = parsed.barcode;
      }
    } catch (e) {
      return res.status(500).json({ error: '無法解析掃描結果' });
    }

    if (!barcode) {
      return res.json({ success: true, data: { barcode: null } });
    }

    // Lookup the scanned barcode
    const product = BarcodeDB.findByBarcode(barcode);

    res.json({
      success: true,
      data: {
        barcode,
        product: product ? {
          name: product.name,
          brand: product.brand,
          calories: product.calories,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
          servingSize: product.serving_size
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/barcode/lookup/:barcode - Lookup barcode
router.get('/lookup/:barcode', (req, res, next) => {
  try {
    const { barcode } = req.params;
    const product = BarcodeDB.findByBarcode(barcode);

    if (product) {
      res.json({
        success: true,
        data: {
          id: product.id,
          barcode,
          name: product.name,
          brand: product.brand,
          calories: product.calories,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
          servingSize: product.serving_size
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: '找不到此條碼的產品資料',
        data: {
          barcode,
          name: '未知產品',
          brand: '未知',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          servingSize: '未知'
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/barcode/lookup - Lookup barcode (POST version)
router.post('/lookup', (req, res, next) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: '條碼為必填欄位' });
    }

    const product = BarcodeDB.findByBarcode(barcode);

    if (product) {
      res.json({
        success: true,
        data: {
          id: product.id,
          barcode,
          name: product.name,
          brand: product.brand,
          calories: product.calories,
          protein: product.protein,
          carbs: product.carbs,
          fat: product.fat,
          servingSize: product.serving_size
        }
      });
    } else {
      res.json({
        success: false,
        error: '找不到此條碼的產品資料',
        data: {
          barcode,
          name: '未知產品',
          brand: '未知',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          servingSize: '未知'
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/barcode/add - Add new barcode product (authenticated)
router.post('/add', authMiddleware, (req, res, next) => {
  try {
    const { barcode, name, brand, calories, protein, carbs, fat, servingSize } = req.body;

    if (!barcode || !name) {
      return res.status(400).json({ error: '條碼和名稱為必填欄位' });
    }

    const result = BarcodeDB.upsert({
      barcode,
      name,
      brand: brand || '未知',
      calories: calories || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
      servingSize: servingSize || '未知'
    });

    res.json({
      success: true,
      message: '產品資料已新增',
      data: {
        barcode: result.barcode,
        name: result.name,
        brand: result.brand,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        servingSize: result.serving_size
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/barcode/create-from-nutrition - Create barcode from nutrition label photo
router.post('/create-from-nutrition', authMiddleware, async (req, res, next) => {
  try {
    const { barcode, image } = req.body;

    console.log('[Barcode] create-from-nutrition called:', { barcode, imageLength: image?.length });

    if (!barcode || !image) {
      console.log('[Barcode] Validation failed: missing barcode or image');
      return res.status(400).json({ error: '條碼和營養標示圖片為必填欄位' });
    }

    // Check if already exists
    const existing = BarcodeDB.findByBarcode(barcode);
    if (existing) {
      console.log('[Barcode] Barcode already exists:', barcode);
      return res.status(409).json({
        error: '此條碼已存在於資料庫',
        data: existing
      });
    }

    // Analyze nutrition label image
    console.log('[Barcode] Calling analyzeNutritionLabel...');
    const aiResult = await analyzeNutritionLabel(image);
    console.log('[Barcode] analyzeNutritionLabel aiResult:', JSON.stringify(aiResult));

    if (!aiResult.success) {
      console.log('[Barcode] AI analysis failed:', aiResult.error);
      return res.status(500).json({ error: aiResult.error || '營養標示解析失敗' });
    }

    // Parse the AI response (analyzeNutritionLabel already parses it, but we need to re-parse from JSON string)
    let parsed;
    try {
      const content = aiResult.data?.content || '';
      console.log('[Barcode] AI content:', content);
      parsed = parseNutritionOCRResult(content);
      console.log('[Barcode] Parsed nutrition data:', JSON.stringify(parsed));
    } catch (e) {
      console.error('[Barcode] Parse error:', e.message);
      return res.status(500).json({ error: '無法解析營養標示資料' });
    }

    // Validate we got numeric values
    if (parsed.calories === 0 && parsed.protein === 0 && parsed.carbs === 0 && parsed.fat === 0) {
      console.log('[Barcode] All nutrition values are 0, may be OCR failure');
      // Still allow creation but warn
    }

    // Create barcode record
    const barcodeData = {
      barcode,
      name: parsed.name || '未知產品',
      brand: parsed.brand || '未知',
      calories: parsed.calories || 0,
      protein: parsed.protein || 0,
      carbs: parsed.carbs || 0,
      fat: parsed.fat || 0,
      servingSize: parsed.servingSize || '未知'
    };

    const newBarcode = BarcodeDB.create(barcodeData);

    // Create food log entry for user
    const foodLogEntry = FoodLogDB.create(req.user.id, {
      imageData: image,
      mealType: 'general',
      calories: parsed.calories || 0,
      protein: parsed.protein || 0,
      carbs: parsed.carbs || 0,
      fat: parsed.fat || 0,
      description: `條碼建立: ${barcodeData.name}`
    });

    // Update daily progress with TDEE goal
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

    console.log('[Barcode] Food log and progress updated with goal:', goalCalories);

    res.json({
      success: true,
      message: '產品資料已建立並加入日誌',
      data: {
        barcode: newBarcode,
        foodLog: foodLogEntry
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;