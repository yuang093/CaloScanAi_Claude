import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { UserProfileDB } from '../services/database.js';

const router = express.Router();

// GET /api/profile - Get user profile
router.get('/', authMiddleware, (req, res) => {
  try {
    const profile = UserProfileDB.findByUserId(req.user.id);

    if (!profile) {
      return res.json({
        success: true,
        data: {
          weight: null,
          height: null,
          age: null,
          gender: 'unspecified',
          activity_level: 'sedentary',
          goal_calories: 2000
        }
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: '取得個人資料失敗' });
  }
});

// POST /api/profile - Create or update user profile
router.post('/', authMiddleware, (req, res) => {
  try {
    const { weight, height, age, gender, activityLevel, goalCalories } = req.body;

    const profile = UserProfileDB.upsert(req.user.id, {
      weight,
      height,
      age,
      gender,
      activityLevel,
      goalCalories
    });

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ success: false, error: '儲存個人資料失敗' });
  }
});

export default router;