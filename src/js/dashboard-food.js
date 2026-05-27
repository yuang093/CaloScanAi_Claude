// ============================================
// dashboard-food.js - 食物上傳、分析、加日誌
// ============================================

// File handling
window.handleFileSelect = async function(event) {
  const file = event.target.files[0];
  if (file) {
    // Clear old state immediately
    window.currentPreview = null;
    window.currentImage = null;
    window.analysisData = null;

    // Show loading state immediately
    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('preview-container').style.display = 'flex';
    document.getElementById('preview-image').src = '';
    document.getElementById('preview-container').innerHTML = '<div style="text-align:center; padding:40px;"><div style="font-size:2rem;">⏳</div><p>圖片處理中...</p></div>';
    document.getElementById('analyze-btn').disabled = true;
    document.getElementById('analysis-result').style.display = 'none';

    const base64 = await window.compressImage(file);
    window.currentPreview = 'data:image/jpeg;base64,' + base64;
    document.getElementById('preview-container').innerHTML = `
      <img id="preview-image" class="preview-image" src="${window.currentPreview}" alt="Preview">
      <button class="change-btn" onclick="event.stopPropagation(); document.getElementById('file-input').click()">更換圖片</button>
    `;
    document.getElementById('analyze-btn').disabled = false;
    window.currentImage = base64;

    // Reset file input to allow selecting same file again
    event.target.value = '';
  }
};

// Compress image before upload (max 1200px width, JPEG 0.8 quality, target < 500KB)
window.compressImage = async function(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        // Get EXIF orientation (iOS photos)
        const orientation = window.getExifOrientation(file);

        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Handle EXIF orientation (iOS photos)
        if (orientation > 1) {
          ctx.save();
          if (orientation === 6) {
            canvas.width = height;
            canvas.height = width;
            ctx.translate(height, 0);
            ctx.rotate(Math.PI / 2);
          } else if (orientation === 8) {
            canvas.width = height;
            canvas.height = width;
            ctx.translate(0, width);
            ctx.rotate(-Math.PI / 2);
          } else if (orientation === 3) {
            ctx.translate(width, height);
            ctx.rotate(Math.PI);
          }
        }

        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();

        // Try quality 0.8 first, then reduce if needed
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);

        while (result.length > 500 * 1024 && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        // Remove data URL prefix
        resolve(result.replace(/^data:image\/\w+;base64,/, ''));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Get EXIF orientation from image file
window.getExifOrientation = function(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const view = new DataView(e.target.result);
      if (view.getUint16(0, false) !== 0xFFD8) {
        resolve(1);
        return;
      }
      const length = view.byteLength;
      let offset = 2;
      while (offset < length) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xFFE1) {
          const little = view.getUint16(offset + 1, false) === 0x4949;
          const ifdOffset = view.getUint32(offset + 4, little);
          const entries = view.getUint16(ifdOffset, little);
          for (let i = 0; i < entries; i++) {
            const entryOffset = ifdOffset + 2 + i * 12;
            const tag = view.getUint16(entryOffset, little);
            if (tag === 0x0112) {
              resolve(view.getUint16(entryOffset + 8, little));
              return;
            }
          }
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
      resolve(1);
    };
    reader.onerror = function() { resolve(1); };
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
};

// Analyze image
window.analyzeImage = async function() {
  if (!window.currentPreview) return;

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> 分析中...';

  try {
    const base64Data = window.currentPreview.replace(/^data:image\/\w+;base64,/, '');

    const res = await fetch('/api/food/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ image: base64Data })
    });

    const result = await res.json();
    if (result.success) {
      window.analysisData = result.analysis;
      window.displayAnalysisResult(window.analysisData);
    } else {
      alert('分析失敗：' + result.error);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    alert('分析失敗，請稍後再試');
  } finally {
    btn.disabled = false;
    btn.textContent = '分析食物';
  }
};

window.displayAnalysisResult = function(data) {
  document.getElementById('result-calories').textContent = data.totalCalories || 0;
  document.getElementById('result-protein').textContent = (data.totalProtein || 0) + 'g';
  document.getElementById('result-carbs').textContent = (data.totalCarbs || 0) + 'g';
  document.getElementById('result-fat').textContent = (data.totalFat || 0) + 'g';

  // Truncate long descriptions
  const desc = data.description || '';
  document.getElementById('analysis-text').textContent = desc.length > 500 ? desc.substring(0, 500) + '...' : desc;

  document.getElementById('analysis-result').style.display = 'block';
  document.getElementById('analyze-btn').style.display = 'none';
};

// 直接打開編輯模式讓用戶修改分析結果
window.openAnalysisEditMode = function() {
  if (!window.analysisData || !window.currentPreview) {
    alert('請先分析圖片');
    return;
  }

  const data = window.analysisData;
  // 初始化分析食物資料
  window.analysisFoodData = {
    name: data.name || '未命名食物',
    calories: data.totalCalories || 0,
    protein: data.totalProtein || 0,
    carbs: data.totalCarbs || 0,
    fat: data.totalFat || 0,
    image: window.currentPreview
  };

  // 標記為新建項目（區分於編輯現有項目）
  window.isCreatingFromAnalysis = true;
  window.currentFoodDetailId = null;

  // 設定 currentFoodDetailData 讓 editFoodLogItem() 可以運作
  window.currentFoodDetailData = { ...window.analysisFoodData };

  // 顯示圖片
  document.getElementById('food-detail-img').src = window.currentPreview;

  // 進入編輯模式
  document.getElementById('food-detail-name').style.display = 'none';
  document.getElementById('food-detail-name-edit').style.display = 'block';
  document.getElementById('food-detail-name-edit').value = data.name || '未命名食物';

  document.getElementById('food-detail-cal').style.display = 'none';
  document.getElementById('food-detail-cal-edit').style.display = 'block';
  document.getElementById('food-detail-cal-edit').value = data.totalCalories || 0;

  document.getElementById('food-detail-protein').style.display = 'none';
  document.getElementById('food-detail-protein-edit').style.display = 'block';
  document.getElementById('food-detail-protein-edit').value = data.totalProtein || 0;

  document.getElementById('food-detail-carbs').style.display = 'none';
  document.getElementById('food-detail-carbs-edit').style.display = 'block';
  document.getElementById('food-detail-carbs-edit').value = data.totalCarbs || 0;

  document.getElementById('food-detail-fat').style.display = 'none';
  document.getElementById('food-detail-fat-edit').style.display = 'block';
  document.getElementById('food-detail-fat-edit').value = data.totalFat || 0;

  // 隱藏檢視按鈕，顯示編輯按鈕
  document.getElementById('food-detail-buttons').style.display = 'none';
  document.getElementById('food-detail-edit-buttons').style.display = 'flex';

  // 隱藏時間（新建項目沒有時間）
  document.getElementById('food-detail-time').style.display = 'none';

  // 打開 modal
  document.getElementById('food-detail-modal').style.display = 'flex';
};

window.addToFoodLog = async function() {
  if (!window.analysisData) {
    alert('請先分析圖片');
    return;
  }
  if (!window.currentPreview) {
    alert('圖片資料遺失，請重新選擇圖片');
    return;
  }

  const btn = document.querySelector('#analysis-result .btn-primary');
  if (!btn) {
    // Fallback: find any btn-primary with 儲存中... and reset
    document.querySelectorAll('.btn-primary').forEach(b => {
      if (b.textContent === '儲存中...') {
        b.disabled = false;
        b.textContent = '加入日誌';
      }
    });
    return;
  }
  btn.disabled = true;
  btn.textContent = '儲存中...';

  const base64Data = window.currentPreview.replace(/^data:image\/\w+;base64,/, '');

  try {
    const res = await fetch('/api/food/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({
        image: base64Data,
        mealType: 'general'
      })
    });

    const result = await res.json();
    if (result.success) {
      const entry = {
        id: result.data.id,
        image: window.currentPreview,
        name: window.analysisData.name || 'AI 分析食物',
        calories: window.analysisData.totalCalories || 0,
        protein: window.analysisData.totalProtein || 0,
        carbs: window.analysisData.totalCarbs || 0,
        fat: window.analysisData.totalFat || 0,
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      };

      window.foodLog.unshift(entry);
      window.renderFoodLog();
      btn.textContent = '加入日誌';
      btn.disabled = false;
      window.resetUpload();
    } else {
      alert('儲存失敗：' + result.error);
      btn.disabled = false;
      btn.textContent = '加入日誌';
    }
  } catch (err) {
    console.error('Add to log error:', err);
    alert('儲存失敗，請稍後再試');
    btn.disabled = false;
    btn.textContent = '加入日誌';
  }
};

window.renderFoodLog = function() {
  const container = document.getElementById('food-log-list');

  if (window.foodLog.length === 0) {
    container.innerHTML = '<div class="empty-state">尚無記錄，上傳圖片開始吧！</div>';
    return;
  }

  container.innerHTML = window.foodLog.map(item => `
    <div class="food-log-item" onclick="window.showFoodDetail(${item.id})" style="cursor:pointer;">
      <img class="food-log-img" src="${item.image || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iI2YzZjBmYiIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIyMCI+Zm9vPC90ZXh0Pjwvc3ZnPg=='}" alt="${item.name}">
      <div class="food-log-info">
        <div class="food-log-name" style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name || '未命名'}</div>
        <div class="food-log-time">${item.time}</div>
      </div>
    </div>
  `).join('');
};

window.updateProgressTotals = function(goalCalories = 2000) {
  const total = window.foodLog.reduce((sum, item) => ({
    cal: sum.cal + (item.calories || 0),
    pro: sum.pro + (item.protein || 0),
    carb: sum.carb + (item.carbs || 0),
    fat: sum.fat + (item.fat || 0)
  }), { cal: 0, pro: 0, carb: 0, fat: 0 });

  document.getElementById('goal-cal-display').textContent = goalCalories;

  // Update progress bar if on progress page
  const progressBar = document.getElementById('progress-bar-fill');
  if (progressBar) {
    const progressPercent = Math.min((total.cal / goalCalories) * 100, 100);
    progressBar.style.width = progressPercent + '%';
  }
};

window.resetUpload = function() {
  window.currentPreview = null;
  window.currentImage = null;
  window.analysisData = null;
  document.getElementById('preview-container').style.display = 'none';
  document.getElementById('upload-placeholder').style.display = 'block';
  document.getElementById('analyze-btn').style.display = 'block';
  document.getElementById('analyze-btn').disabled = true;
  document.getElementById('analyze-btn').textContent = '分析食物';
  document.getElementById('analysis-result').style.display = 'none';
  document.getElementById('file-input').value = '';
};

// Load food log from API
window.loadFoodLog = async function() {
  try {
    const token = localStorage.getItem('token');
    const [logsRes, profileRes] = await Promise.all([
      fetch('/api/food/logs?date=' + window.getLocalDate() + '&limit=50', {
        headers: { 'Authorization': 'Bearer ' + token }
      }),
      fetch('/api/profile', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
    ]);

    const logsResult = await logsRes.json();
    const profileResult = await profileRes.json();

    window.foodLog = (logsResult.data?.logs || []).map(log => ({
      id: log.id,
      image: log.image_path ? '/uploads/' + log.image_path : null,
      name: log.description || '未命名食物',
      calories: log.calories || 0,
      protein: log.protein || 0,
      carbs: log.carbs || 0,
      fat: log.fat || 0,
      time: new Date(log.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    }));

    // Calculate goal calories from profile
    let goalCalories = 2000;
    if (profileResult.success && profileResult.data) {
      const p = profileResult.data;
      if (p.goal_calories) {
        goalCalories = p.goal_calories;
      } else if (p.weight && p.height && p.age && p.gender) {
        let bmr = p.custom_bmr;
        if (!bmr) {
          if (p.gender === 'male') bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + 5;
          else if (p.gender === 'female') bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
          else bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age;
        }
        const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
        const tdee = Math.round(bmr * (multipliers[p.activity_level] || 1.2));
        goalCalories = Math.round(tdee * 0.85);
      }
    }

    window.renderFoodLog();
    window.updateProgressTotals(goalCalories);
  } catch (err) {
    console.error('Load food log error:', err);
  }
};
