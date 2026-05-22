import express from 'express';
import { BarcodeDB } from '../services/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

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