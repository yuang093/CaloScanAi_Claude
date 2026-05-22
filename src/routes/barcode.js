import express from 'express';
import { BarcodeDB } from '../services/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { analyzeFoodImage } from '../services/minimax.js';

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
router.get('/lookup/:barcode', (req, res) => {
  const { barcode } = req.params;

  const product = BarcodeDB.findByBarcode(barcode);

  if (product) {
    res.json({
      success: true,
      data: {
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
});

// POST /api/barcode/lookup - Lookup barcode (POST version)
router.post('/lookup', (req, res) => {
  const { barcode } = req.body;

  if (!barcode) {
    return res.status(400).json({ error: '條碼為必填欄位' });
  }

  const product = BarcodeDB.findByBarcode(barcode);

  if (product) {
    res.json({
      success: true,
      data: {
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
});

// POST /api/barcode/add - Add new barcode product (authenticated)
router.post('/add', authMiddleware, (req, res) => {
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
});

export default router;