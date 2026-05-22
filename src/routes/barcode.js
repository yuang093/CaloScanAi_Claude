import express from 'express';

const router = express.Router();

// Mock barcode database - in production, this would be a real database
const barcodeDatabase = {
  '4710138000014': {
    name: '義美小泡芙',
    brand: '義美',
    calories: 140,
    protein: 2,
    carbs: 18,
    fat: 6,
    servingSize: '30g'
  },
  '4710595600011': {
    name: '泰山八寶粥',
    brand: '泰山',
    calories: 180,
    protein: 4,
    carbs: 30,
    fat: 4,
    servingSize: '250g'
  },
  '4901234567890': {
    name: '可口可樂',
    brand: '可口可樂',
    calories: 140,
    protein: 0,
    carbs: 35,
    fat: 0,
    servingSize: '330ml'
  },
  '4712345678901': {
    name: '乖乖',
    brand: '乖乖',
    calories: 200,
    protein: 3,
    carbs: 25,
    fat: 10,
    servingSize: '45g'
  },
  '6920202888888': {
    name: '維他奶',
    brand: '維他奶',
    calories: 100,
    protein: 5,
    carbs: 12,
    fat: 3,
    servingSize: '250ml'
  }
};

// GET /api/barcode/lookup - Lookup barcode (public endpoint)
router.get('/lookup/:barcode', (req, res) => {
  const { barcode } = req.params;

  const product = barcodeDatabase[barcode];

  if (product) {
    res.json({
      success: true,
      data: {
        barcode,
        ...product
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

  const product = barcodeDatabase[barcode];

  if (product) {
    res.json({
      success: true,
      data: {
        barcode,
        ...product
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
router.post('/add', (req, res) => {
  const { barcode, name, brand, calories, protein, carbs, fat, servingSize } = req.body;

  if (!barcode || !name) {
    return res.status(400).json({ error: '條碼和名稱為必填欄位' });
  }

  barcodeDatabase[barcode] = {
    name,
    brand: brand || '未知',
    calories: calories || 0,
    protein: protein || 0,
    carbs: carbs || 0,
    fat: fat || 0,
    servingSize: servingSize || '未知'
  };

  res.json({
    success: true,
    message: '產品資料已新增',
    data: barcodeDatabase[barcode]
  });
});

export default router;