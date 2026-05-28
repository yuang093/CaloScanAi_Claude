// ============================================
// dashboard-progress.js - 進度、統計、圖表
// ============================================

// Lazy load Chart.js
window.loadChartJs = async function() {
  if (typeof Chart !== 'undefined') return Chart;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => resolve(Chart);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Navigation
window.switchPage = function(page) {
  document.getElementById('food-log-page').style.display = page === 'food-log' ? 'block' : 'none';
  document.getElementById('progress-page').style.display = page === 'progress' ? 'block' : 'none';
  document.getElementById('history-page').style.display = page === 'history' ? 'block' : 'none';
  document.getElementById('shopping-page').style.display = page === 'shopping' ? 'block' : 'none';

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.textContent.includes(page === 'food-log' ? '食物日誌' : page === 'progress' ? '每日進度' : page === 'history' ? '歷史統計' : '購物')) {
      link.classList.add('active');
    }
  });

  if (page === 'food-log') {
    window.loadFoodLog();
  } else if (page === 'progress') {
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('zh-TW', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    window.fetchProgressData();
  } else if (page === 'history') {
    window.loadHistoryData('weekly');
  } else if (page === 'shopping') {
    window.loadShoppingLists();
  }
};

// Fetch progress data from API
window.fetchProgressData = async function() {
  try {
    console.log('[fetchProgressData] Starting...');

    // Fetch both progress and profile in parallel
    const [progressRes, profileRes] = await Promise.all([
      fetch('/api/progress/daily', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      }),
      fetch('/api/profile', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      })
    ]);

    console.log('[fetchProgressData] progressRes status:', progressRes.status);

    const progressResult = await progressRes.json();
    const profileResult = await profileRes.json();
    console.log('[fetchProgressData] progressResult:', JSON.stringify(progressResult));

    let goalCalories = 2000;

    if (progressResult.success) {
      console.log('[fetchProgressData] Entering success block');
      const { stats, goals, quote } = progressResult.data;

      // Update nutrition values (round to 1 decimal)
      document.getElementById('total-cal').textContent = stats.calories;
      document.getElementById('total-pro').textContent = Math.round(stats.protein * 10) / 10 + 'g';
      document.getElementById('total-carb').textContent = Math.round(stats.carbs * 10) / 10 + 'g';
      document.getElementById('total-fat').textContent = Math.round(stats.fat * 10) / 10 + 'g';
      document.getElementById('remaining-cal').textContent = goals.remaining;

      // Use goal from API response first
      goalCalories = goals.calories;

      // Fetch today's food logs for meal breakdown
      console.log('[fetchProgressData] Fetching food logs for date:', window.getLocalDate());
      const todayLogsRes = await fetch('/api/food/logs?date=' + window.getLocalDate() + '&limit=50', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      console.log('[fetchProgressData] todayLogsRes status:', todayLogsRes.status);
      const todayLogsResult = await todayLogsRes.json();
      console.log('[fetchProgressData] todayLogsResult:', JSON.stringify(todayLogsResult));
      const todayLogs = todayLogsResult.data?.logs || [];

      // Calculate meal totals and food names
      let breakfastCal = 0, lunchCal = 0, dinnerCal = 0;
      let totalCalories = 0;
      let breakfastFoods = [], lunchFoods = [], dinnerFoods = [];
      todayLogs.forEach(log => {
        const logCal = log.calories || 0;
        totalCalories += logCal;
        const utcDate = new Date(log.created_at);
        const taiwanHour = (utcDate.getHours() + 8) % 24;
        const foodName = log.description || '未命名食物';
        if (taiwanHour < 11) {
          breakfastCal += logCal;
          breakfastFoods.push(foodName);
        } else if (taiwanHour < 17) {
          lunchCal += logCal;
          lunchFoods.push(foodName);
        } else {
          dinnerCal += logCal;
          dinnerFoods.push(foodName);
        }
      });

      // Update nutrition values from calculated totals
      document.getElementById('total-cal').textContent = totalCalories;
      document.getElementById('total-pro').textContent = Math.round(stats.protein * 10) / 10 + 'g';
      document.getElementById('total-carb').textContent = Math.round(stats.carbs * 10) / 10 + 'g';
      document.getElementById('total-fat').textContent = Math.round(stats.fat * 10) / 10 + 'g';
      document.getElementById('remaining-cal').textContent = Math.max(0, goalCalories - totalCalories);
      document.getElementById('meal-breakfast-cal').textContent = breakfastCal + ' kcal';
      document.getElementById('meal-lunch-cal').textContent = lunchCal + ' kcal';
      document.getElementById('meal-dinner-cal').textContent = dinnerCal + ' kcal';
      document.getElementById('meal-breakfast-foods').textContent = breakfastFoods.length > 0 ? breakfastFoods.join('、') : '尚無記錄';
      document.getElementById('meal-lunch-foods').textContent = lunchFoods.length > 0 ? lunchFoods.join('、') : '尚無記錄';
      document.getElementById('meal-dinner-foods').textContent = dinnerFoods.length > 0 ? dinnerFoods.join('、') : '尚無記錄';

      document.getElementById('goal-cal-display').textContent = goalCalories;

      // Update progress bar
      console.log('[fetchProgressData] totalCalories:', totalCalories, 'goalCalories:', goalCalories);
      const progressPercent = Math.min((totalCalories / goalCalories) * 100, 100);
      console.log('[fetchProgressData] progressPercent:', progressPercent);
      const progressBar = document.getElementById('progress-bar-fill');
      if (progressBar) {
        progressBar.style.width = progressPercent + '%';
      }

      // Calorie warning system
      const warningEl = document.getElementById('calorie-warning');
      if (warningEl) {
        if (progressPercent >= 100) {
          warningEl.style.display = 'block';
          warningEl.style.background = '#f8d7da';
          warningEl.style.color = '#721c24';
          warningEl.textContent = '⚠️ 已超過每日目標熱量！';
        } else if (progressPercent >= 90) {
          warningEl.style.display = 'block';
          warningEl.style.background = '#fff3cd';
          warningEl.style.color = '#856404';
          warningEl.textContent = '🔥 攝取已達 90%，注意別超標！';
        } else if (progressPercent >= 80) {
          warningEl.style.display = 'block';
          warningEl.style.background = '#fff3cd';
          warningEl.style.color = '#856404';
          warningEl.textContent = '📢 攝取已達 80%，注意熱量攝取';
        } else {
          warningEl.style.display = 'none';
        }
      }

      // Traffic light system
      const trafficLight = document.getElementById('calorie-traffic-light');
      const lightGreen = document.getElementById('light-green');
      const lightYellow = document.getElementById('light-yellow');
      const lightRed = document.getElementById('light-red');
      const lightText = document.getElementById('traffic-light-text');

      if (trafficLight && lightGreen && lightYellow && lightRed && lightText) {
        trafficLight.style.display = 'flex';

        // Reset all lights
        lightGreen.style.background = '#ccc';
        lightYellow.style.background = '#ccc';
        lightRed.style.background = '#ccc';

        if (progressPercent < 50) {
          // Green zone - on track
          lightGreen.style.background = '#74c69d';
          lightGreen.style.boxShadow = '0 0 10px #74c69d';
          lightText.textContent = '熱量攝取正常';
          lightText.style.color = '#2d6a4f';
        } else if (progressPercent < 80) {
          // Yellow zone - attention
          lightYellow.style.background = '#ffd166';
          lightYellow.style.boxShadow = '0 0 10px #ffd166';
          lightText.textContent = '熱量偏高，注意控制';
          lightText.style.color = '#856404';
        } else {
          // Red zone - warning
          lightRed.style.background = '#e74c3c';
          lightRed.style.boxShadow = '0 0 10px #e74c3c';
          lightText.textContent = '熱量攝取過高！';
          lightText.style.color = '#721c24';
        }
      }

      // Show share button if progress > 50%
      console.log('[shareBtn] totalCalories:', totalCalories, 'goalCalories:', goalCalories, 'progressPercent:', progressPercent);
      const shareBtn = document.getElementById('share-achievement-btn');
      if (shareBtn) {
        shareBtn.style.display = progressPercent >= 50 ? 'block' : 'none';
        console.log('[shareBtn] button display set to:', progressPercent >= 50 ? 'block' : 'none');
      }

      // Show quote if element exists
      const quoteEl = document.getElementById('daily-quote');
      if (quoteEl && quote) {
        quoteEl.textContent = '"' + quote.quote + '"' + (quote.author ? ' — ' + quote.author : '');
      }

      // Generate fat loss recommendation
      window.generateRecommendation(stats, goalCalories, profileResult.data);
    }
  } catch (error) {
    console.error('Failed to fetch progress:', error);
  }
};

window.generateRecommendation = function(stats, goalCalories, profile) {
  const recText = document.getElementById('recommendation-text');
  const recCard = document.getElementById('recommendation-card');
  if (!recText || !recCard) return;

  const consumed = stats.calories || 0;
  const protein = stats.protein || 0;
  const carbs = stats.carbs || 0;
  const fat = stats.fat || 0;
  const remaining = goalCalories - consumed;

  // Calculate macros ratio
  const totalMacros = protein * 4 + carbs * 4 + fat * 9;
  const proteinPct = totalMacros > 0 ? Math.round(protein * 4 / totalMacros * 100) : 0;
  const carbsPct = totalMacros > 0 ? Math.round(carbs * 4 / totalMacros * 100) : 0;
  const fatPct = totalMacros > 0 ? Math.round(fat * 9 / totalMacros * 100) : 0;

  // Calculate TDEE if profile available
  let tdee = goalCalories / 0.85;
  let bmr = null;
  if (profile && profile.weight && profile.height && profile.age && profile.gender) {
    bmr = profile.custom_bmr;
    if (!bmr) {
      if (profile.gender === 'male') bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
      else if (profile.gender === 'female') bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
      else bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age;
    }
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    tdee = Math.round(bmr * (multipliers[profile.activity_level] || 1.2));
  }

  // Build recommendation based on status
  let recommendation = '';
  if (consumed === 0) {
    recommendation = '今天還沒記錄食物喔！上傳圖片開始追蹤吧。';
  } else if (remaining < 0) {
    recommendation = `⚠️ 已超過目標 ${Math.abs(remaining)} kcal，建議增加活動量來平衡攝取。`;
  } else if (remaining > 500) {
    recommendation = `還有 ${remaining} kcal 的空間，建議攝取蛋白質豐富的食物。`;
  } else {
    recommendation = `今日攝取良好，繼續保持！`;
  }

  // Add macro advice if stats are available
  if (consumed > 0) {
    recommendation += `\n\n📊 巨量營養素比例：蛋白質 ${proteinPct}% / 碳水 ${carbsPct}% / 脂肪 ${fatPct}%`;
    if (proteinPct < 20) {
      recommendation += '\n💡 蛋白質攝取偏低，建議多吃雞蛋、魚、肉類或豆製品。';
    } else if (proteinPct > 40) {
      recommendation += '\n💡 蛋白質攝取偏高，建議適量減少並增加蔬果。';
    }
  }

  // Add goal context if available
  if (bmr && tdee) {
    recommendation += `\n\n📈 基礎代謝 BMR: ${Math.round(bmr)} kcal / 熱量消耗 TDEE: ${tdee} kcal`;
  }

  recText.textContent = recommendation;
  recCard.style.display = 'block';
};

window.loadHistoryData = async function(period) {
  try {
    let days = 7;
    if (period === 'monthly') days = 30;
    if (period === '90days') days = 90;

    const endDate = new Date();
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - days);

    const toLocalDateStr = (d) => {
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const taiwan = new Date(utc + (8 * 60 * 60 * 1000));
      const y = taiwan.getFullYear();
      const m = String(taiwan.getMonth() + 1).padStart(2, '0');
      const day = String(taiwan.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const endDateStr = toLocalDateStr(endDate);
    const startDateStr = toLocalDateStr(startDateObj);

    const response = await fetch('/api/progress/history?startDate=' + startDateStr + '&endDate=' + endDateStr + '&limit=' + days, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();

    if (result.success && result.data.records.length > 0) {
      const records = result.data.records;
      const labels = records.map(r => r.date.slice(5));
      const calories = records.map(r => r.total_calories);
      const protein = records.map(r => r.total_protein);
      const carbs = records.map(r => r.total_carbs);
      const fat = records.map(r => r.total_fat);

      // Update chart
      if (window.calorieChart) window.calorieChart.destroy();
      if (window.nutritionChart) window.nutritionChart.destroy();

      // Lazy load Chart.js before creating charts
      await window.loadChartJs();

      const ctx = document.getElementById('history-chart').getContext('2d');
      window.calorieChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: '熱量 (kcal)',
            data: calories,
            borderColor: '#c85a3b',
            backgroundColor: 'rgba(200, 90, 59, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } }
        }
      });

      const ctx2 = document.getElementById('nutrition-chart').getContext('2d');
      window.nutritionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: '蛋白質 (g)', data: protein, backgroundColor: '#74c69d' },
            { label: '碳水 (g)', data: carbs, backgroundColor: '#ffd166' },
            { label: '脂肪 (g)', data: fat, backgroundColor: '#e07a5f' }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } }
        }
      });

      // Summary
      const avgCal = Math.round(calories.reduce((a, b) => a + b, 0) / calories.length);
      const avgPro = Math.round(protein.reduce((a, b) => a + b, 0) / protein.length * 10) / 10;
      document.getElementById('history-summary').innerHTML =
        '平均熱量：<strong>' + avgCal + '</strong> kcal | 平均蛋白質：<strong>' + avgPro + '</strong> g<br>' +
        '總記錄天數：' + records.length + ' 天';
    } else {
      document.getElementById('history-summary').innerHTML = '尚無歷史資料';
      if (window.calorieChart) window.calorieChart.destroy();
      if (window.nutritionChart) window.nutritionChart.destroy();
    }
  } catch (error) {
    console.error('Load history error:', error);
  }
};

window.exportHistoryCSV = async function() {
  try {
    let days = 30;
    const toLocalDateStr = (d) => {
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const taiwan = new Date(utc + (8 * 60 * 60 * 1000));
      const y = taiwan.getFullYear();
      const m = String(taiwan.getMonth() + 1).padStart(2, '0');
      const day = String(taiwan.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const endDateObj = new Date();
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - days);
    const endDateStr = toLocalDateStr(endDateObj);
    const startDateStr = toLocalDateStr(startDateObj);

    const response = await fetch('/api/progress/history?startDate=' + startDateStr + '&endDate=' + endDateStr + '&limit=' + days, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();

    if (!result.success || !result.data.records.length) {
      alert('尚無資料可匯出');
      return;
    }

    const records = result.data.records;
    let csv = '﻿日期,熱量(kcal),蛋白質(g),碳水(g),脂肪(g),目標(kcal)\n';
    records.forEach(r => {
      csv += `${r.date},${r.total_calories},${r.total_protein},${r.total_carbs},${r.total_fat},${r.goal_calories}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'caloscanai_history_' + endDateStr + '.csv';
    link.click();
  } catch (error) {
    console.error('Export CSV error:', error);
    alert('匯出失敗');
  }
};

window.exportHistoryPDF = async function() {
  try {
    let days = 30;
    const toLocalDateStr = (d) => {
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const taiwan = new Date(utc + (8 * 60 * 60 * 1000));
      const y = taiwan.getFullYear();
      const m = String(taiwan.getMonth() + 1).padStart(2, '0');
      const day = String(taiwan.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const endDateObj = new Date();
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - days);
    const endDateStr = toLocalDateStr(endDateObj);
    const startDateStr = toLocalDateStr(startDateObj);

    const response = await fetch('/api/progress/history?startDate=' + startDateStr + '&endDate=' + endDateStr + '&limit=' + days, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();

    if (!result.success || !result.data.records.length) {
      alert('尚無資料可匯出');
      return;
    }

    const records = result.data.records;
    const totalCal = records.reduce((sum, r) => sum + r.total_calories, 0);
    const avgCal = Math.round(totalCal / records.length);
    const avgPro = Math.round(records.reduce((sum, r) => sum + r.total_protein, 0) / records.length * 10) / 10;
    const avgCarbs = Math.round(records.reduce((sum, r) => sum + r.total_carbs, 0) / records.length * 10) / 10;
    const avgFat = Math.round(records.reduce((sum, r) => sum + r.total_fat, 0) / records.length * 10) / 10;

    const safeDate = (d) => d == null ? '' : String(d).replace(/</g, '<').replace(/>/g, '>');
    const safeNum = (n) => n == null ? 0 : (isNaN(n) ? 0 : Number(n));

    // Create printable HTML and open in new window
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
      <head>
        <title>CaloScanAi 健康報表</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #2d6a4f; border-bottom: 2px solid #2d6a4f; padding-bottom: 10px; }
          h2 { color: #c85a3b; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background: #2d6a4f; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .summary-item { background: #f0f0f0; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-item h3 { margin: 0; color: #c85a3b; font-size: 1.5rem; }
          .summary-item p { margin: 5px 0 0 0; color: #666; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 0.8rem; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>CaloScanAi 健康報表</h1>
        <p>報表日期：${endDateStr}</p>

        <h2>統計摘要</h2>
        <div class="summary">
          <div class="summary-item">
            <h3>${avgCal}</h3>
            <p>平均熱量 (kcal)</p>
          </div>
          <div class="summary-item">
            <h3>${avgPro}g</h3>
            <p>平均蛋白質</p>
          </div>
          <div class="summary-item">
            <h3>${avgCarbs}g</h3>
            <p>平均碳水</p>
          </div>
          <div class="summary-item">
            <h3>${avgFat}g</h3>
            <p>平均脂肪</p>
          </div>
        </div>

        <h2>📅 每日記錄</h2>
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>熱量 (kcal)</th>
              <th>蛋白質 (g)</th>
              <th>碳水 (g)</th>
              <th>脂肪 (g)</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => `
              <tr>
                <td>${safeDate(r.date)}</td>
                <td>${safeNum(r.total_calories)}</td>
                <td>${safeNum(r.total_protein)}</td>
                <td>${safeNum(r.total_carbs)}</td>
                <td>${safeNum(r.total_fat)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          由 CaloScanAi 自動生成 | 報表日期：${new Date().toLocaleDateString('zh-TW')}
        </div>
      </body>
      </html>
    `);
    win.document.close();
  } catch (error) {
    console.error('Export PDF error:', error);
    alert('匯出失敗');
  }
};
