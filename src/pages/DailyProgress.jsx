import { useTheme } from '../context/ThemeContext';

export default function DailyProgress() {
  const { theme, isDark } = useTheme();

  // Mock data - in production, this would come from the API
  const dailyGoal = {
    calories: 2000,
    protein: 60,
    carbs: 250,
    fat: 65
  };

  const todayProgress = {
    calories: 1450,
    protein: 42,
    carbs: 180,
    fat: 48
  };

  const getProgressPercentage = (current, goal) => {
    return Math.min(Math.round((current / goal) * 100), 100);
  };

  const caloriesPercent = getProgressPercentage(todayProgress.calories, dailyGoal.calories);
  const proteinPercent = getProgressPercentage(todayProgress.protein, dailyGoal.protein);
  const carbsPercent = getProgressPercentage(todayProgress.carbs, dailyGoal.carbs);
  const fatPercent = getProgressPercentage(todayProgress.fat, dailyGoal.fat);

  const remaining = {
    calories: dailyGoal.calories - todayProgress.calories,
    protein: dailyGoal.protein - todayProgress.protein,
    carbs: dailyGoal.carbs - todayProgress.carbs,
    fat: dailyGoal.fat - todayProgress.fat
  };

  return (
    <div className="progress-page">
      <div className="progress-header">
        <h1>每日進度</h1>
        <p>{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="progress-grid">
        <div className="progress-card calories-card">
          <div className="progress-icon">🔥</div>
          <h3>卡路里</h3>
          <div className="progress-circle">
            <svg viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="8"
                strokeDasharray={`${caloriesPercent * 2.83} 283`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="progress-text">
              <span className="progress-value">{todayProgress.calories}</span>
              <span className="progress-goal">/ {dailyGoal.calories}</span>
            </div>
          </div>
          <p className="progress-remaining">剩餘 {remaining.calories} kcal</p>
        </div>

        <div className="progress-card">
          <div className="progress-icon">💪</div>
          <h3>蛋白質</h3>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-bar-fill protein"
                style={{ width: `${proteinPercent}%` }}
              />
            </div>
            <div className="progress-numbers">
              <span>{todayProgress.protein}g</span>
              <span className="goal">/ {dailyGoal.protein}g</span>
            </div>
          </div>
          <p className="progress-remaining">剩餘 {remaining.protein}g</p>
        </div>

        <div className="progress-card">
          <div className="progress-icon">🍞</div>
          <h3>碳水化合物</h3>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-bar-fill carbs"
                style={{ width: `${carbsPercent}%` }}
              />
            </div>
            <div className="progress-numbers">
              <span>{todayProgress.carbs}g</span>
              <span className="goal">/ {dailyGoal.carbs}g</span>
            </div>
          </div>
          <p className="progress-remaining">剩餘 {remaining.carbs}g</p>
        </div>

        <div className="progress-card">
          <div className="progress-icon">🥑</div>
          <h3>脂肪</h3>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-bar-fill fat"
                style={{ width: `${fatPercent}%` }}
              />
            </div>
            <div className="progress-numbers">
              <span>{todayProgress.fat}g</span>
              <span className="goal">/ {dailyGoal.fat}g</span>
            </div>
          </div>
          <p className="progress-remaining">剩餘 {remaining.fat}g</p>
        </div>
      </div>

      <div className="meal-summary card">
        <h3>餐次摘要</h3>
        <div className="meal-list">
          <div className="meal-item">
            <span className="meal-icon">🌅</span>
            <div className="meal-info">
              <span className="meal-name">早餐</span>
              <span className="meal-calories">450 kcal</span>
            </div>
          </div>
          <div className="meal-item">
            <span className="meal-icon">☀️</span>
            <div className="meal-info">
              <span className="meal-name">午餐</span>
              <span className="meal-calories">680 kcal</span>
            </div>
          </div>
          <div className="meal-item">
            <span className="meal-icon">🌙</span>
            <div className="meal-info">
              <span className="meal-name">晚餐</span>
              <span className="meal-calories">320 kcal</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .progress-page {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }

        .progress-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .progress-header h1 {
          font-size: var(--font-size-2xl);
          margin-bottom: 8px;
        }

        .progress-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }

        .progress-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 24px;
          text-align: center;
        }

        .calories-card {
          grid-column: span 2;
        }

        .progress-icon {
          font-size: 2rem;
          margin-bottom: 8px;
        }

        .progress-card h3 {
          font-size: var(--font-size-base);
          color: var(--color-text-muted);
          margin-bottom: 16px;
        }

        .progress-circle {
          position: relative;
          width: 160px;
          height: 160px;
          margin: 0 auto 16px;
        }

        .progress-circle svg {
          width: 100%;
          height: 100%;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .progress-value {
          display: block;
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary);
        }

        .progress-goal {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        }

        .progress-bar-container {
          margin-bottom: 12px;
        }

        .progress-bar {
          height: 12px;
          background: var(--color-surface-2);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
        }

        .progress-bar-fill.protein {
          background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
        }

        .progress-bar-fill.carbs {
          background: linear-gradient(90deg, #FFD93D, #FF6B9D);
        }

        .progress-bar-fill.fat {
          background: linear-gradient(90deg, #c85a3b, #e07a5f);
        }

        .progress-numbers {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
        }

        .progress-numbers .goal {
          font-weight: var(--font-weight-normal);
          color: var(--color-text-muted);
        }

        .progress-remaining {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        }

        .meal-summary {
          padding: 24px;
        }

        .meal-summary h3 {
          margin-bottom: 16px;
        }

        .meal-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .meal-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          background: var(--color-surface-2);
          border-radius: var(--radius-md);
        }

        .meal-icon {
          font-size: 1.5rem;
        }

        .meal-info {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .meal-name {
          font-weight: var(--font-weight-medium);
        }

        .meal-calories {
          color: var(--color-primary);
          font-weight: var(--font-weight-bold);
        }

        @media (max-width: 600px) {
          .progress-grid {
            grid-template-columns: 1fr;
          }

          .calories-card {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}