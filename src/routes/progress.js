import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { FoodLogDB, DailyProgressDB, QuoteDB, UserProfileDB } from '../services/database.js';
import { getLocalDate, getLocalDateDaysAgo } from '../utils/date.js';

const router = express.Router();

// GET /api/progress/daily - Get today's progress (authenticated)
router.get('/daily', authMiddleware, async (req, res, next) => {
  try {
    const today = getLocalDate();

    // Get today's stats from food logs
    const todayStats = FoodLogDB.getTodayStats(req.user.id);
    console.log('[progress/daily] todayStats:', todayStats);

    // Get user's profile for goalCalories
    const profile = UserProfileDB.findByUserId(req.user.id);
    let goalCalories = 2000;
    if (profile) {
      if (profile.goal_calories) {
        goalCalories = profile.goal_calories;
      } else if (profile.weight && profile.height && profile.age && profile.gender) {
        let bmr = profile.custom_bmr;
        if (!bmr) {
          if (profile.gender === 'male') bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
          else if (profile.gender === 'female') bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
          else bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age;
        }
        const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
        const tdee = Math.round(bmr * (multipliers[profile.activity_level] || 1.2));
        goalCalories = Math.round(tdee * 0.85);
      }
    }

    // Get or create daily progress record
    let progress = DailyProgressDB.findByUserAndDate(req.user.id, today);
    console.log('[progress/daily] existing progress:', progress);

    if (!progress) {
      // Create initial progress for today
      progress = DailyProgressDB.upsert(req.user.id, today, {
        totalCalories: todayStats.total_calories,
        totalProtein: todayStats.total_protein,
        totalCarbs: todayStats.total_carbs,
        totalFat: todayStats.total_fat,
        goalCalories
      });
      console.log('[progress/daily] created progress:', progress);
    }

    // Get random quote
    const quote = QuoteDB.getRandom();

    // Calculate percentages
    const caloriesPercent = Math.round((progress.total_calories / progress.goal_calories) * 100);
    const remaining = progress.goal_calories - progress.total_calories;

    res.json({
      success: true,
      data: {
        date: today,
        stats: {
          calories: progress.total_calories,
          protein: progress.total_protein,
          carbs: progress.total_carbs,
          fat: progress.total_fat,
          mealCount: todayStats.meal_count
        },
        goals: {
          calories: progress.goal_calories,
          caloriesPercent: Math.min(caloriesPercent, 100),
          remaining: Math.max(remaining, 0)
        },
        quote: quote || { quote: '每天都是新的開始！', author: 'CaloScanAi' }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/weekly - Get weekly progress (authenticated)
router.get('/weekly', authMiddleware, async (req, res, next) => {
  try {
    const endDate = getLocalDate();
    const startDate = getLocalDateDaysAgo(7);

    // Get daily progress for the week
    const weeklyData = DailyProgressDB.findByUserId(req.user.id, {
      startDate,
      endDate,
      limit: 7
    });

    // Calculate weekly averages
    const totalDays = weeklyData.length;
    const avgCalories = totalDays > 0
      ? Math.round(weeklyData.reduce((sum, d) => sum + d.total_calories, 0) / totalDays)
      : 0;
    const avgProtein = totalDays > 0
      ? Math.round(weeklyData.reduce((sum, d) => sum + d.total_protein, 0) / totalDays * 10) / 10
      : 0;
    const avgCarbs = totalDays > 0
      ? Math.round(weeklyData.reduce((sum, d) => sum + d.total_carbs, 0) / totalDays * 10) / 10
      : 0;
    const avgFat = totalDays > 0
      ? Math.round(weeklyData.reduce((sum, d) => sum + d.total_fat, 0) / totalDays * 10) / 10
      : 0;

    // Days goal was achieved
    const daysAchieved = weeklyData.filter(d => d.total_calories <= d.goal_calories).length;

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        dailyData: weeklyData,
        averages: {
          calories: avgCalories,
          protein: avgProtein,
          carbs: avgCarbs,
          fat: avgFat
        },
        summary: {
          totalDays,
          daysAchieved,
          achievementRate: totalDays > 0 ? Math.round((daysAchieved / totalDays) * 100) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/history - Get progress history (authenticated)
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 30 } = req.query;

    const history = DailyProgressDB.findByUserId(req.user.id, {
      startDate,
      endDate,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        records: history,
        total: history.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/progress/goals - Update daily goals (authenticated)
router.put('/goals', authMiddleware, async (req, res, next) => {
  try {
    const { goalCalories } = req.body;

    if (!goalCalories || goalCalories < 500 || goalCalories > 5000) {
      return res.status(400).json({ error: '熱量目標需在 500-5000 之間' });
    }

    const today = getLocalDate();
    const todayStats = FoodLogDB.getTodayStats(req.user.id);

    const progress = DailyProgressDB.upsert(req.user.id, today, {
      totalCalories: todayStats.total_calories,
      totalProtein: todayStats.total_protein,
      totalCarbs: todayStats.total_carbs,
      totalFat: todayStats.total_fat,
      goalCalories
    });

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/progress/quotes - Get all quotes
router.get('/quotes', async (req, res, next) => {
  try {
    const quotes = QuoteDB.getAll();
    res.json({
      success: true,
      data: quotes
    });
  } catch (error) {
    next(error);
  }
});

export default router;