// ============================================
// dashboard-modals.js - 所有 Modal 彈窗功能
// ============================================

// ============ Barcode Scanner Modal ============

window.openBarcodeScanner = function() {
  document.getElementById('barcode-modal').style.display = 'flex';
  document.getElementById('barcode-input').focus();
};

window.closeBarcodeModal = function() {
  document.getElementById('barcode-modal').style.display = 'none';
  document.getElementById('barcode-input').value = '';
  document.getElementById('barcode-result').style.display = 'none';
  document.getElementById('add-barcode-btn').style.display = 'none';
  document.getElementById('nutrition-create-zone').style.display = 'none';
  document.getElementById('nutrition-upload-zone').style.display = 'none';
  document.getElementById('barcode-upload-zone').style.display = 'block';
  document.getElementById('barcode-preview-container').style.display = 'none';
  document.getElementById('barcode-file-input').value = '';
  document.getElementById('food-search-zone').style.display = 'none';
  document.getElementById('food-search-input').value = '';
  document.getElementById('food-search-results').innerHTML = '';
};

window.stopCameraScan = function() {
  // No-op: camera stream removed
};

// ============ Food Search ============

window.toggleFoodSearch = function() {
  const zone = document.getElementById('food-search-zone');
  if (zone.style.display === 'none') {
    zone.style.display = 'block';
    document.getElementById('food-search-input').focus();
  } else {
    zone.style.display = 'none';
  }
};

window.searchFoodDatabase = async function() {
  const query = document.getElementById('food-search-input').value.trim();
  if (!query) {
    alert('請輸入搜尋關鍵字');
    return;
  }

  const resultsDiv = document.getElementById('food-search-results');
  resultsDiv.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">搜尋中...</div>';

  try {
    const response = await fetch('/api/food/search?q=' + encodeURIComponent(query), {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      resultsDiv.innerHTML = result.data.map(food => {
        const escapedName = food.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
        return `
        <div style="padding:12px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;">${window.escapeHtml(food.name)}</div>
            <div style="font-size:0.8rem; color:#666;">${window.escapeHtml(food.brand || '')} • ${food.calories} kcal</div>
          </div>
          <button onclick="window.addFoodFromDatabase(${food.id}, '${escapedName}', ${food.calories}, ${food.protein}, ${food.carbs}, ${food.fat})" class="btn btn-primary btn-small">加入</button>
        </div>
      `}).join('');
    } else if (result.success && result.data.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">找不到符合的食物</div>';
    } else {
      resultsDiv.innerHTML = '<div style="text-align:center; color:#e74c3c; padding:20px;">搜尋失敗</div>';
    }
  } catch (err) {
    resultsDiv.innerHTML = '<div style="text-align:center; color:#e74c3c; padding:20px;">網路錯誤</div>';
    console.error('Food search error:', err);
  }
};

// ============ Utilities ============

window.getLocalDate = function() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));
  return taiwanDate.toISOString().split('T')[0];
};

window.escapeHtml = function(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// ============ Add Food From Database ============

window.addFoodFromDatabase = async function(id, name, calories, protein, carbs, fat, isFavorite = false) {
  try {
    const response = await fetch('/api/food/add-from-database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ barcodeId: id, isFavorite })
    });
    const result = await response.json();

    if (result.success) {
      alert('已加入日誌');
      window.closeBarcodeModal();
      window.loadFoodLog();
    } else {
      alert(result.error || '加入失敗');
    }
  } catch (err) {
    alert('網路錯誤');
    console.error('Add from database error:', err);
  }
};

// ============ Add Food From Statistics (Most Used) ============

window.addFoodFromStats = async function(calories, protein, carbs, fat, name) {
  try {
    const response = await fetch('/api/food/add-from-database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ name, calories, protein, carbs, fat })
    });
    const result = await response.json();

    if (result.success) {
      alert('已加入日誌');
      window.loadFoodLog();
    } else {
      alert(result.error || '加入失敗');
    }
  } catch (err) {
    alert('網路錯誤');
    console.error('Add from stats error:', err);
  }
};

// ============ Donation Modal ============

window.openDonationModal = function() {
  document.getElementById('donation-modal').style.display = 'flex';
};

window.closeDonationModal = function() {
  document.getElementById('donation-modal').style.display = 'none';
};

// ============ Favorites Modal ============

window.openFavoritesModal = async function() {
  document.getElementById('favorites-modal').style.display = 'flex';
  window.loadFavorites();
  window.loadRecentFoods();
};

window.closeFavoritesModal = function() {
  document.getElementById('favorites-modal').style.display = 'none';
};

window.loadFavorites = async function() {
  try {
    const sort = document.getElementById('favorites-sort-select')?.value || 'recent';
    const response = await fetch(`/api/food/favorites?sort=${sort}`, {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    const container = document.getElementById('favorites-list');

    if (result.success && result.data.length > 0) {
      container.innerHTML = result.data.slice(0, 20).map(food => {
        const escapedName = (food.name || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
        const isStats = food.isStats;
        const displaySubtitle = isStats
          ? `已食用 ${food.use_count} 次 • ${food.calories} kcal`
          : `${window.escapeHtml(food.brand || '')} • ${food.calories} kcal`;
        const imgSrc = food.image_path ? '/uploads/' + food.image_path : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iI2YzZjBmYiIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIyMCI+Zm9vPC90ZXh0Pjwvc3ZnPg==';

        return `
        <div style="display:flex; align-items:center; padding:10px; border-bottom:1px solid var(--color-border);">
          <div style="width:50px;height:50px;border-radius:8px;overflow:hidden;margin-right:12px;flex-shrink:0;background:#f3f0f0;">
            <img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${window.escapeHtml(food.name || '未命名')}</div>
            <div style="font-size:0.8rem; color:var(--color-text-muted);">${displaySubtitle}</div>
          </div>
          <button onclick="${isStats ? 'window.addFoodFromStats(' + food.calories + ', ' + food.protein + ', ' + food.carbs + ', ' + food.fat + ', \'' + escapedName + '\')' : 'window.addFoodFromDatabase(' + food.id + ', \'' + escapedName + '\', ' + (food.calories || 0) + ', ' + (food.protein || 0) + ', ' + (food.carbs || 0) + ', ' + (food.fat || 0) + ', true)'}" class="btn btn-primary btn-small">加入</button>
        </div>
      `}).join('');
    } else {
      container.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">尚無最愛食物</div>';
    }
  } catch (error) {
    console.error('Load favorites error:', error);
    document.getElementById('favorites-list').innerHTML = '<div style="text-align:center; color:#e74c3c; padding:20px;">載入失敗</div>';
  }
};

window.loadRecentFoods = async function() {
  try {
    const response = await fetch('/api/food/recent?limit=10', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    const container = document.getElementById('recent-list');

    if (result.success && result.data.length > 0) {
      container.innerHTML = result.data.map(f => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid var(--color-border);">
          <div>
            <div style="font-weight:500;">${f.description || '未命名食物'}</div>
            <div style="font-size:0.8rem; color:var(--color-text-muted);">${f.calories} kcal</div>
          </div>
          <button onclick="window.copyFoodLog(${f.id}, '${(f.description || '').replace(/'/g, "\\'")}', ${f.calories || 0}, ${f.protein || 0}, ${f.carbs || 0}, ${f.fat || 0})" class="btn btn-secondary btn-small">加入</button>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">尚無記錄</div>';
    }
  } catch (error) {
    console.error('Load recent foods error:', error);
  }
};

window.addFavoriteToLog = async function(favoriteId) {
  try {
    const response = await fetch('/api/food/add-from-database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ barcodeId: favoriteId, isFavorite: true })
    });
    const result = await response.json();
    if (result.success) {
      alert('已加入日誌');
      window.loadFoodLog();
    } else {
      alert(result.error || '加入失敗');
    }
  } catch (err) {
    alert('網路錯誤');
    console.error('Add favorite error:', err);
  }
};

window.removeFavorite = async function(favoriteId) {
  if (!confirm('確定要移除這個最愛嗎？')) return;
  try {
    const response = await fetch('/api/food/favorites/' + favoriteId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    if (result.success) {
      window.loadFavorites();
    } else {
      alert(result.error || '移除失敗');
    }
  } catch (err) {
    alert('網路錯誤');
    console.error('Remove favorite error:', err);
  }
};

window.copyFoodLog = async function(id, name, calories, protein, carbs, fat) {
  try {
    const response = await fetch('/api/food/add-from-database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ name, calories, protein, carbs, fat })
    });
    const result = await response.json();
    if (result.success) {
      alert('已加入日誌');
      window.loadFoodLog();
    } else {
      alert(result.error || '加入失敗');
    }
  } catch (err) {
    alert('網路錯誤');
    console.error('Copy food log error:', err);
  }
};

// ============ Food Detail Modal ============

let currentFoodDetailId = null;
let currentFoodDetailData = null;
let isEditingFoodLog = false;

window.showFoodDetail = function(id) {
  const item = window.foodLog.find(f => f.id === id);
  if (!item) return;
  currentFoodDetailId = id;
  currentFoodDetailData = item;
  isEditingFoodLog = false;
  document.getElementById('food-detail-img').src = item.image;
  document.getElementById('food-detail-name').textContent = item.name || '未命名食物';
  document.getElementById('food-detail-name').style.display = 'block';
  document.getElementById('food-detail-name-edit').style.display = 'none';
  document.getElementById('food-detail-time').textContent = item.time;
  document.getElementById('food-detail-cal').textContent = item.calories;
  document.getElementById('food-detail-cal').style.display = 'block';
  document.getElementById('food-detail-cal-edit').style.display = 'none';
  document.getElementById('food-detail-protein').textContent = item.protein + 'g';
  document.getElementById('food-detail-protein').style.display = 'block';
  document.getElementById('food-detail-protein-edit').style.display = 'none';
  document.getElementById('food-detail-carbs').textContent = item.carbs + 'g';
  document.getElementById('food-detail-carbs').style.display = 'block';
  document.getElementById('food-detail-carbs-edit').style.display = 'none';
  document.getElementById('food-detail-fat').textContent = item.fat + 'g';
  document.getElementById('food-detail-fat').style.display = 'block';
  document.getElementById('food-detail-fat-edit').style.display = 'none';
  document.getElementById('food-detail-buttons').style.display = 'flex';
  document.getElementById('food-detail-edit-buttons').style.display = 'none';
  document.getElementById('food-detail-modal').style.display = 'flex';
};

window.editFoodLogItem = function() {
  if (!currentFoodDetailData) return;
  isEditingFoodLog = true;
  document.getElementById('food-detail-name').style.display = 'none';
  document.getElementById('food-detail-name-edit').style.display = 'block';
  document.getElementById('food-detail-name-edit').value = currentFoodDetailData.name || '';
  document.getElementById('food-detail-cal').style.display = 'none';
  document.getElementById('food-detail-cal-edit').style.display = 'block';
  document.getElementById('food-detail-cal-edit').value = currentFoodDetailData.calories || 0;
  document.getElementById('food-detail-protein').style.display = 'none';
  document.getElementById('food-detail-protein-edit').style.display = 'block';
  document.getElementById('food-detail-protein-edit').value = currentFoodDetailData.protein || 0;
  document.getElementById('food-detail-carbs').style.display = 'none';
  document.getElementById('food-detail-carbs-edit').style.display = 'block';
  document.getElementById('food-detail-carbs-edit').value = currentFoodDetailData.carbs || 0;
  document.getElementById('food-detail-fat').style.display = 'none';
  document.getElementById('food-detail-fat-edit').style.display = 'block';
  document.getElementById('food-detail-fat-edit').value = currentFoodDetailData.fat || 0;
  document.getElementById('food-detail-buttons').style.display = 'none';
  document.getElementById('food-detail-edit-buttons').style.display = 'flex';
};

window.cancelEditFoodLogItem = function() {
  isEditingFoodLog = false;
  window.showFoodDetail(currentFoodDetailId);
};

window.saveFoodLogItem = async function() {
  const name = document.getElementById('food-detail-name-edit').value;
  const calories = parseInt(document.getElementById('food-detail-cal-edit').value) || 0;
  const protein = parseFloat(document.getElementById('food-detail-protein-edit').value) || 0;
  const carbs = parseFloat(document.getElementById('food-detail-carbs-edit').value) || 0;
  const fat = parseFloat(document.getElementById('food-detail-fat-edit').value) || 0;

  const btn = document.querySelector('#food-detail-edit-buttons .btn-primary') || document.querySelector('#food-detail-edit-buttons button:first-child');
  if (btn) { btn.disabled = true; btn.textContent = '儲存中...'; }

  try {
    if (window.isCreatingFromAnalysis) {
      // 新建：上傳圖片
      const base64Data = window.analysisFoodData.image.replace(/^data:image\/\w+;base64,/, '');
      const res = await fetch('/api/food/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ image: base64Data, mealType: 'general' })
      });
      const result = await res.json();
      if (result.success) {
        // 如果分析資料有客製化數值，需更新 server 端的記錄
        if (window.analysisFoodData.name !== name ||
            window.analysisFoodData.calories !== calories ||
            window.analysisFoodData.protein !== protein ||
            window.analysisFoodData.carbs !== carbs ||
            window.analysisFoodData.fat !== fat) {
          // 更新營養值
          await fetch('/api/food/logs/' + result.data.id, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify({ description: name, calories, protein, carbs, fat })
          });
        }
        alert('已加入日誌');
        window.isCreatingFromAnalysis = false;
        window.analysisFoodData = null;
        window.resetUpload();
      } else {
        alert(result.error || '加入失敗');
      }
    } else {
      // 編輯現有項目
      if (!currentFoodDetailId) {
        alert('找不到要編輯的項目');
        return;
      }
      const res = await fetch('/api/food/logs/' + currentFoodDetailId, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ description: name, calories, protein, carbs, fat })
      });
      const result = await res.json();
      if (result.success) {
        alert('已保存');
      } else {
        alert(result.error || '保存失敗');
      }
    }
    window.closeFoodDetailModal();
    window.loadFoodLog();
  } catch (err) {
    alert('儲存失敗');
    console.error('Save food log error:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '保存'; }
  }
};

window.closeFoodDetailModal = function() {
  document.getElementById('food-detail-modal').style.display = 'none';
  currentFoodDetailId = null;
  currentFoodDetailData = null;
  isEditingFoodLog = false;
  window.isCreatingFromAnalysis = false;
};

window.deleteFoodLogItem = async function() {
  if (!currentFoodDetailId) return;
  if (!confirm('確定要刪除這個記錄嗎？')) return;
  try {
    const res = await fetch('/api/food/logs/' + currentFoodDetailId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    if (res.ok) {
      window.closeFoodDetailModal();
      window.loadFoodLog();
    }
  } catch (err) {
    alert('刪除失敗');
  }
};

// ============ Barcode File Analysis ============

let barcodeProductData = null;
let barcodeCapturedImage = null;

window.handleBarcodeFileSelect = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const btn = document.getElementById('analyze-barcode-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '🔄 分析中...';
  }

  try {
    const base64 = await window.compressImage(file);
    window.lastBarcodeBase64 = base64;

    document.getElementById('barcode-preview-img').src = 'data:image/jpeg;base64,' + base64;
    document.getElementById('barcode-upload-zone').style.display = 'none';
    document.getElementById('barcode-preview-container').style.display = 'block';

    const response = await fetch('/api/barcode/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ image: base64 })
    });

    const result = await response.json();

    if (btn) {
      btn.disabled = false;
      btn.textContent = '分析';
    }

    if (result.success && result.data.barcode) {
      barcodeCapturedImage = base64;
      document.getElementById('barcode-input').value = result.data.barcode;
      window.lookupBarcode();
    } else if (result.error) {
      alert('辨識失敗：' + (result.error.message || result.error));
    } else {
      alert('無法辨識條碼，請嘗試手動輸入');
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '分析';
    }
    alert('網路錯誤，請稍後再試');
    console.error('Barcode file analysis failed:', err);
  }
};

window.reAnalyzeBarcode = async function() {
  const fileInput = document.getElementById('barcode-file-input');
  if (fileInput.files.length > 0) {
    window.handleBarcodeFileSelect({ target: fileInput });
  } else if (window.lastBarcodeBase64) {
    const btn = document.getElementById('analyze-barcode-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '🔄 分析中...';
    }

    fetch('/api/barcode/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ image: window.lastBarcodeBase64 })
    })
    .then(res => res.json())
    .then(result => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '分析';
      }
      if (result.success && result.data.barcode) {
        barcodeCapturedImage = window.lastBarcodeBase64;
        document.getElementById('barcode-input').value = result.data.barcode;
        window.lookupBarcode();
      } else if (result.error) {
        alert('辨識失敗：' + (result.error.message || result.error));
      } else {
        alert('無法辨識條碼，請嘗試手動輸入');
      }
    })
    .catch(err => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '分析';
      }
      alert('網路錯誤，請稍後再試');
    });
  }
};

window.lookupBarcode = async function() {
  const barcode = document.getElementById('barcode-input').value.trim();
  if (!barcode) {
    alert('請輸入條碼號碼');
    return;
  }

  try {
    const response = await fetch('/api/barcode/lookup/' + barcode);
    const result = await response.json();

    if (result.success && result.data && result.data.name !== '未知產品') {
      barcodeProductData = result.data;
      document.getElementById('barcode-product-name').textContent = result.data.name;
      document.getElementById('barcode-product-brand').textContent = (result.data.brand || '未知') + ' • ' + (result.data.servingSize || '');
      document.getElementById('barcode-calories').textContent = result.data.calories || 0;
      document.getElementById('barcode-protein').textContent = (result.data.protein || 0) + 'g';
      document.getElementById('barcode-carbs').textContent = (result.data.carbs || 0) + 'g';
      document.getElementById('barcode-fat').textContent = (result.data.fat || 0) + 'g';
      document.getElementById('barcode-result').style.display = 'block';
      document.getElementById('add-barcode-btn').style.display = 'block';
      document.getElementById('nutrition-create-zone').style.display = 'none';
    } else {
      barcodeProductData = result.data;
      document.getElementById('barcode-product-name').textContent = result.data?.name || '未知產品';
      document.getElementById('barcode-product-brand').textContent = '未知商品';
      document.getElementById('barcode-calories').textContent = 0;
      document.getElementById('barcode-protein').textContent = '0g';
      document.getElementById('barcode-carbs').textContent = '0g';
      document.getElementById('barcode-fat').textContent = '0g';
      document.getElementById('barcode-result').style.display = 'block';
      document.getElementById('add-barcode-btn').style.display = 'block';
      document.getElementById('nutrition-create-zone').style.display = 'block';
      window.currentNutritionBarcode = barcode;
    }
  } catch (error) {
    alert('查詢失敗，請稍後再試');
  }
};

window.addBarcodeToLog = function() {
  if (!barcodeProductData) return;

  fetch('/api/food/add-from-database', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + localStorage.getItem('token')
    },
    body: JSON.stringify({ barcodeId: barcodeProductData.id })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      window.closeBarcodeModal();
      window.loadFoodLog();
    } else {
      alert(result.error || '加入失敗');
    }
  })
  .catch(err => {
    alert('網路錯誤');
    console.error('Add barcode to log error:', err);
  });
};

// ============ Nutrition Photo Capture ============

let currentNutritionBarcode = null;
let currentNutritionImage = null;

window.openNutritionPhotoCapture = function() {
  document.getElementById('nutrition-create-zone').style.display = 'none';
  document.getElementById('nutrition-upload-zone').style.display = 'block';
  document.getElementById('nutrition-preview').style.display = 'none';
  document.getElementById('submit-nutrition-btn').style.display = 'none';
  document.getElementById('nutrition-parse-result').textContent = '';
};

window.closeNutritionUpload = function() {
  document.getElementById('nutrition-upload-zone').style.display = 'none';
  document.getElementById('nutrition-create-zone').style.display = 'none';
  currentNutritionBarcode = null;
  currentNutritionImage = null;
  barcodeCapturedImage = null;
};

window.handleNutritionPhotoSelect = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const btn = document.getElementById('submit-nutrition-btn');
  btn.disabled = true;
  btn.textContent = '解析中...';

  try {
    const base64 = await window.compressImage(file);
    currentNutritionImage = base64;

    document.getElementById('nutrition-preview-img').src = 'data:image/jpeg;base64,' + base64;
    document.getElementById('nutrition-preview').style.display = 'block';

    document.getElementById('nutrition-parse-result').textContent = '🔄 分析中...';
    document.getElementById('submit-nutrition-btn').textContent = '分析中...';

    const response = await fetch('/api/barcode/create-from-nutrition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({
        barcode: currentNutritionBarcode,
        image: currentNutritionImage
      })
    });

    const result = await response.json();
    console.log('Nutrition API response:', result);

    if (result.success) {
      barcodeProductData = result.data.barcode;
      barcodeCapturedImage = currentNutritionImage;
      document.getElementById('barcode-product-name').textContent = barcodeProductData.name;
      document.getElementById('barcode-product-brand').textContent = (barcodeProductData.brand || '未知') + ' • ' + (barcodeProductData.servingSize || '');
      document.getElementById('barcode-calories').textContent = barcodeProductData.calories || 0;
      document.getElementById('barcode-protein').textContent = (barcodeProductData.protein || 0) + 'g';
      document.getElementById('barcode-carbs').textContent = (barcodeProductData.carbs || 0) + 'g';
      document.getElementById('barcode-fat').textContent = (barcodeProductData.fat || 0) + 'g';

      document.getElementById('nutrition-parse-result').textContent = '✅ 解析成功！';
      document.getElementById('nutrition-upload-zone').style.display = 'none';
      document.getElementById('barcode-result').style.display = 'block';
      document.getElementById('add-barcode-btn').style.display = 'block';

      window.closeBarcodeModal();
      window.loadFoodLog();
    } else {
      const errMsg = typeof result.error === 'string' ? result.error : (result.error?.message || JSON.stringify(result.error));
      document.getElementById('nutrition-parse-result').textContent = '❌ 解析失敗：' + errMsg;
      btn.disabled = false;
      btn.textContent = '確認建立';
      btn.style.display = 'block';
    }
  } catch (error) {
    document.getElementById('nutrition-parse-result').textContent = '❌ 錯誤：' + error.message;
    btn.disabled = false;
    btn.textContent = '確認建立';
  }
};

// ============ Batch Upload ============

let batchFiles = [];
let batchAnalysisResults = [];

window.openBatchModal = function() {
  document.getElementById('batch-modal').style.display = 'flex';
  batchFiles = [];
  batchAnalysisResults = [];
  document.getElementById('batch-preview-area').style.display = 'none';
  document.getElementById('batch-progress').style.display = 'none';
  document.getElementById('batch-results').style.display = 'none';
  document.getElementById('batch-analyze-btn').style.display = 'none';
  document.getElementById('batch-add-all-btn').style.display = 'none';
};

window.closeBatchModal = function() {
  document.getElementById('batch-modal').style.display = 'none';
  batchFiles = [];
  batchAnalysisResults = [];
};

window.handleBatchFileSelect = async function(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  batchFiles = files;
  const previewArea = document.getElementById('batch-preview-area');
  const previewList = document.getElementById('batch-preview-list');

  previewArea.style.display = 'block';
  previewList.innerHTML = files.map((file, index) => `
    <div style="position:relative;">
      <img id="batch-img-${index}" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px;">
      <button onclick="window.removeBatchFile(${index})" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">×</button>
    </div>
  `).join('');

  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById('batch-img-' + i);
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(files[i]);
  }

  document.getElementById('batch-analyze-btn').style.display = 'block';
  document.getElementById('batch-add-all-btn').style.display = 'none';
  document.getElementById('batch-results').style.display = 'none';
};

window.removeBatchFile = function(index) {
  batchFiles.splice(index, 1);
  if (batchFiles.length === 0) {
    document.getElementById('batch-preview-area').style.display = 'none';
    document.getElementById('batch-analyze-btn').style.display = 'none';
  } else {
    window.handleBatchFileSelect({ target: { files: batchFiles } });
  }
};

window.startBatchAnalyze = async function() {
  if (batchFiles.length === 0) return;

  const progressArea = document.getElementById('batch-progress');
  const progressText = document.getElementById('batch-progress-text');
  const progressBar = document.getElementById('batch-progress-bar');
  const analyzeBtn = document.getElementById('batch-analyze-btn');

  progressArea.style.display = 'block';
  analyzeBtn.style.display = 'none';
  batchAnalysisResults = [];

  for (let i = 0; i < batchFiles.length; i++) {
    progressText.textContent = `分析中 ${i + 1}/${batchFiles.length}...`;
    progressBar.style.width = ((i + 1) / batchFiles.length * 100) + '%';

    try {
      const base64 = await window.compressImage(batchFiles[i]);
      const response = await fetch('/api/food/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      });
      const result = await response.json();

      if (result.success) {
        const analysis = result.analysis;
        batchAnalysisResults.push({
          image: 'data:image/jpeg;base64,' + base64,
          name: analysis.name || analysis.description || '未命名食物',
          calories: analysis.totalCalories || 0,
          protein: analysis.totalProtein || 0,
          carbs: analysis.totalCarbs || 0,
          fat: analysis.totalFat || 0
        });
      }
    } catch (err) {
      console.error('Batch analyze error:', err);
    }
  }

  progressArea.style.display = 'none';
  window.showBatchResults();
};

window.showBatchResults = function() {
  const resultsArea = document.getElementById('batch-results');
  const resultsList = document.getElementById('batch-results-list');
  const totalEl = document.getElementById('batch-total-calories');
  const addAllBtn = document.getElementById('batch-add-all-btn');

  resultsArea.style.display = 'block';
  addAllBtn.style.display = 'block';

  resultsList.innerHTML = batchAnalysisResults.map((item, index) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid var(--color-border);">
      <div style="flex:1;">
        <div style="font-weight:500;">${item.name}</div>
        <div style="font-size:0.8rem; color:var(--color-text-muted);">蛋白質 ${item.protein}g | 碳水 ${item.carbs}g | 脂肪 ${item.fat}g</div>
      </div>
      <div style="font-weight:bold; color:var(--color-primary);">${item.calories} kcal</div>
    </div>
  `).join('');

  const totalCal = batchAnalysisResults.reduce((sum, item) => sum + item.calories, 0);
  totalEl.textContent = totalCal + ' kcal';
};

window.addAllBatchToLog = async function() {
  if (batchAnalysisResults.length === 0) return;

  const addAllBtn = document.getElementById('batch-add-all-btn');
  addAllBtn.disabled = true;
  addAllBtn.textContent = '加入中...';

  let successCount = 0;
  for (const item of batchAnalysisResults) {
    try {
      const base64Data = item.image.replace(/^data:image\/\w+;base64,/, '');
      const response = await fetch('/api/food/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ image: base64Data, mealType: 'general' })
      });
      const result = await response.json();
      if (result.success) successCount++;
    } catch (err) {
      console.error('Add batch to log error:', err);
    }
  }

  addAllBtn.disabled = false;
  addAllBtn.textContent = '全部加入日誌';

  alert('已成功加入 ' + successCount + ' 筆資料到日誌');
  window.closeBatchModal();
  window.loadFoodLog();
};

// ============ Share Achievement Card ============

let shareCardData = { calories: 0, goalCalories: 2000, achievement: '', foods: [] };
let currentShareStyle = 'natural';

const shareAppNames = [
  '熱量現形記 🔍', '我的秘密 AI 營養師 🤖', '越吃越瘦的秘密 🔥',
  '智能熱量管家 ⚡', '今天被 AI 監控了嗎？ 👀', '無痛減脂日常 💫',
  '吃貨的贖罪券 😇', '我的健康存摺 💰'
];

const shareQuotes = [
  '「每一天的選擇，累積成健康的習慣」',
  '「愛自己，從每一餐開始」💕',
  '「好好吃飯，是對身體最溫柔的照顧」',
  '「追蹤每一餐，遇見更好的自己」',
  '「記錄每一天的改變」✨',
  '「吃得健康，活得精彩」🌟'
];

const shareStyleConfigs = {
  natural: {
    bg: 'linear-gradient(180deg, #f8fdf9 0%, #e8f5e9 100%)',
    textColor: '#2d6a4f', accentColor: '#4a7c59', cardBg: '#fff'
  },
  playful: {
    bg: 'linear-gradient(180deg, #fff5f8 0%, #fce4ec 100%)',
    textColor: '#e91e63', accentColor: '#f06292', cardBg: 'rgba(255,255,255,0.9)'
  },
  warm: {
    bg: 'linear-gradient(180deg, #fdf6f0 0%, #f5ebe0 100%)',
    textColor: '#c85a3b', accentColor: '#a0522d', cardBg: 'rgba(255,255,255,0.85)'
  },
  dark: {
    bg: 'linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 100%)',
    textColor: '#667eea', accentColor: '#a0aec0', cardBg: 'rgba(255,255,255,0.08)'
  },
  data: {
    bg: 'linear-gradient(180deg, #f7fafc 0%, #edf2f7 100%)',
    textColor: '#2d3748', accentColor: '#718096', cardBg: '#fff'
  },
  pop: {
    bg: 'linear-gradient(180deg, #fff176 0%, #ffca28 100%)',
    textColor: '#e91e63', accentColor: '#c2185b', cardBg: '#fff'
  }
};

window.openShareCard = async function() {
  console.log('[openShareCard] Starting...');
  const totalCal = document.getElementById('total-cal').textContent;
  const goalCal = document.getElementById('goal-cal-display').textContent;
  console.log('[openShareCard] totalCal:', totalCal, 'goalCal:', goalCal);
  const cal = parseInt(totalCal) || 0;
  const goal = parseInt(goalCal) || 2000;
  const percent = Math.round((cal / goal) * 100);
  console.log('[openShareCard] cal:', cal, 'goal:', goal, 'percent:', percent);

  let achievement = '';
  if (percent >= 100) achievement = '🎯 達成目標！';
  else if (percent >= 90) achievement = '🔥 接近目標了！';
  else if (percent >= 70) achievement = '💪 表現良好！';
  else achievement = '📈 持續加油！';

  let todayFoods = [];
  try {
    const token = localStorage.getItem('token');
    const dateParam = window.getLocalDate();
    console.log('[openShareCard] Fetching food logs for date:', dateParam);
    const res = await fetch('/api/food/logs?date=' + dateParam + '&limit=5', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const result = await res.json();
    console.log('[openShareCard] Food logs API result:', JSON.stringify(result));
    if (result.success && result.data && result.data.logs) {
      todayFoods = result.data.logs.map(log => ({
        name: log.description || '未命名食物',
        calories: log.calories || 0
      }));
      console.log('[openShareCard] todayFoods:', todayFoods);
    } else {
      console.log('[openShareCard] No logs found or API error');
    }
  } catch (err) {
    console.error('Failed to fetch food logs:', err);
  }

  const styles = ['natural', 'playful', 'warm', 'dark', 'data', 'pop'];
  currentShareStyle = styles[Math.floor(Math.random() * styles.length)];

  shareCardData = { calories: cal, goalCalories: goal, achievement, foods: todayFoods };

  window.renderShareCard();
  document.getElementById('share-modal').style.display = 'flex';
};

window.renderShareCard = function() {
  const config = shareStyleConfigs[currentShareStyle];
  const { calories, foods, achievement } = shareCardData;
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
  const appName = shareAppNames[Math.floor(Math.random() * shareAppNames.length)];
  const quote = shareQuotes[Math.floor(Math.random() * shareQuotes.length)];

  const isDarkStyle = currentShareStyle === 'dark';
  const textColor = isDarkStyle ? '#fff' : config.textColor;
  const subTextColor = isDarkStyle ? '#a0aec0' : config.accentColor;
  const cardBg = isDarkStyle ? 'rgba(255,255,255,0.08)' : config.cardBg;

  const cardEl = document.getElementById('share-card-preview');
  cardEl.style.background = config.bg;

  let html = `
    <div style="padding:20px; height:100%; display:flex; flex-direction:column; font-family:'Noto Sans TC',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-size:0.85rem; font-weight:700; color:${textColor};">${appName}</div>
        <div style="font-size:0.7rem; color:${subTextColor}; background:${isDarkStyle?'rgba(102,126,234,0.2)':'rgba(0,0,0,0.05)'}; padding:4px 10px; border-radius:12px;">${dateStr}</div>
      </div>
      <div style="text-align:center; margin:20px 0;">
        <div style="font-size:1rem; color:${subTextColor}; margin-bottom:8px;">今日熱量攝取</div>
        <div style="font-size:3.5rem; font-weight:900; color:${textColor}; line-height:1;">${calories.toLocaleString()}</div>
        <div style="font-size:1.1rem; color:${subTextColor}; margin-top:4px;">kcal</div>
        <div style="font-size:0.85rem; color:${config.textColor}; margin-top:12px; font-weight:600;">${achievement}</div>
      </div>
      <div style="flex:1; background:${cardBg}; border-radius:16px; padding:14px; ${isDarkStyle?'border:1px solid rgba(255,255,255,0.1)':''}">
        <div style="font-size:0.75rem; color:${subTextColor}; margin-bottom:10px; font-weight:600;">🍽️ 今日食物</div>
        ${foods.length > 0 ? foods.map((f, i) => {
          const icons = ['🍎','🥚','🍚','🐟','🥗','🍌','🍗','🥛','🥑','🍠'];
          return `
          <div style="display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid ${isDarkStyle?'rgba(255,255,255,0.05)':'#f0f0f0'}; font-size:0.75rem;">
            <span style="color:${isDarkStyle?'#e2e8f0':'#333'};">${icons[i] || '🍽️'} ${f.name || f.description || '食物'}</span>
            <span style="color:${config.textColor}; font-weight:600;">${f.calories || 0} kcal</span>
          </div>`;
        }).join('') : `<div style="text-align:center; color:${subTextColor}; padding:20px 0; font-size:0.8rem;">尚無食物記錄</div>`}
      </div>
      <div style="text-align:center; margin-top:16px; font-size:0.75rem; color:${subTextColor}; font-style:italic;">${quote}</div>
    </div>`;

  cardEl.innerHTML = html;
};

// Lazy load html2canvas
window.loadHtml2Canvas = async function() {
  if (typeof html2canvas !== 'undefined') return html2canvas;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.onload = () => resolve(html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

window.downloadShareCard = async function() {
  const card = document.getElementById('share-card-preview');

  // Lazy load html2canvas if not available
  if (typeof html2canvas === 'undefined') {
    const downloadBtn = document.querySelector('#share-modal button.btn-primary');
    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.textContent = '⏳ 載入中...';
    }
    try {
      await window.loadHtml2Canvas();
    } catch (err) {
      alert('載入失敗，請稍後再試');
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = '📥 下載圖片';
      }
      return;
    }
  }

  const modalContent = document.querySelector('#share-modal > div');
  const downloadBtn = modalContent.querySelector('button.btn-primary');

  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ 處理中...';
  }

  try {
    const canvas = await html2canvas(card, { scale: 2.5, useCORS: true, backgroundColor: null });
    const dataUrl = canvas.toDataURL('image/png');

    card.style.display = 'none';

    const oldImg = document.getElementById('final-share-img');
    if (oldImg) oldImg.remove();

    const img = document.createElement('img');
    img.id = 'final-share-img';
    img.src = dataUrl;
    img.style.cssText = 'width:270px; height:auto; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.3); -webkit-touch-callout:default !important; pointer-events:auto; display:block; margin:0 auto;';
    card.parentNode.appendChild(img);

    const title = modalContent.querySelector('h3');
    if (title) {
      title.innerHTML = '✨ 產生成功 ✨<br><span style="font-size:0.9rem; color:#e74c3c; line-height:2;">👆 請「長按」圖片儲存影像</span>';
    }

    if (downloadBtn) {
      downloadBtn.textContent = '完成 (關閉)';
      downloadBtn.onclick = window.closeShareModal;
      downloadBtn.disabled = false;
    }

  } catch (err) {
    console.error('Download error:', err);
    alert('圖片產生失敗，請稍後再試');
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.textContent = '📥 下載圖片';
    }
  }
};

window.closeShareModal = function() {
  document.getElementById('share-modal').style.display = 'none';

  const card = document.getElementById('share-card-preview');
  if (card) card.style.display = 'block';

  const img = document.getElementById('final-share-img');
  if (img) img.remove();

  const modalContent = document.querySelector('#share-modal > div');
  if (modalContent) {
    const title = modalContent.querySelector('h3');
    if (title) title.innerHTML = '🎉 分享成就卡';

    const btn = modalContent.querySelector('button.btn-primary');
    if (btn) {
      btn.textContent = '📥 下載圖片';
      btn.onclick = window.downloadShareCard;
    }
  }
};

// ============ Event Listeners ============

document.getElementById('food-search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    window.searchFoodDatabase();
  }
});

document.getElementById('barcode-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    window.lookupBarcode();
  }
});

// ============ Shopping List Functions ============

let shoppingFormMode = 'list';
let shoppingFormListId = null;

window.loadShoppingLists = async function() {
  try {
    const response = await fetch('/api/food/shopping-lists', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    const container = document.getElementById('shopping-lists-container');

    if (result.success && result.data.length > 0) {
      container.innerHTML = result.data.map(list => `
        <div style="background:var(--color-surface); border-radius:16px; padding:20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0; font-size:1.1rem;">${window.escapeHtml(list.name)}</h3>
            <div style="display:flex; gap:8px;">
              <button onclick="window.addItemToShoppingList(${list.id})" class="btn btn-secondary" style="padding:6px 12px; font-size:0.85rem;">+ 添加</button>
              <button onclick="window.deleteShoppingList(${list.id})" class="btn btn-secondary" style="padding:6px 12px; font-size:0.85rem; background:#e74c3c;">🗑️</button>
            </div>
          </div>
          <div id="shopping-list-items-${list.id}">
            ${window.renderShoppingItems(list.items, list.id)}
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--color-text-muted);">
          <div style="font-size:3rem; margin-bottom:12px;">🛒</div>
          <p>還沒有購物清單</p>
          <p style="font-size:0.85rem;">點擊上方按鈕建立第一個清單</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Load shopping lists error:', error);
  }
};

window.renderShoppingItems = function(items, listId) {
  if (!items || items.length === 0) {
    return '<p style="color:var(--color-text-muted); font-size:0.9rem; text-align:center; padding:12px;">清單是空的</p>';
  }
  return items.map((item) => `
    <div style="display:flex; align-items:center; padding:10px; background:var(--color-bg); border-radius:8px; margin-bottom:8px;">
      <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="window.toggleShoppingItem(${listId}, ${item.id})" style="width:20px; height:20px; margin-right:12px; cursor:pointer;">
      <span style="flex:1; ${item.checked ? 'text-decoration:line-through; opacity:0.6;' : ''}">${window.escapeHtml(item.name)}</span>
      ${item.calories ? '<span style="color:var(--color-text-muted); font-size:0.85rem; margin-right:12px;">' + item.calories + ' kcal</span>' : ''}
      <button onclick="window.removeShoppingItem(${listId}, ${item.id})" style="background:none; border:none; cursor:pointer; color:#e74c3c; font-size:1.2rem;">×</button>
    </div>
  `).join('');
};

window.openShoppingFormModal = function(mode, listId) {
  shoppingFormMode = mode;
  shoppingFormListId = listId;
  document.getElementById('shopping-form-title').textContent = mode === 'list' ? '新增購物清單' : '新增物品';
  document.getElementById('shopping-form-name-input').value = '';
  document.getElementById('shopping-form-list-section').style.display = mode === 'list' ? 'block' : 'none';
  document.getElementById('shopping-form-item-section').style.display = mode === 'item' ? 'block' : 'none';
  // Reset item fields
  document.getElementById('shopping-form-item-name-input').value = '';
  document.getElementById('shopping-form-cal-input').value = '';
  document.getElementById('shopping-form-protein-input').value = '';
  document.getElementById('shopping-form-carbs-input').value = '';
  document.getElementById('shopping-form-fat-input').value = '';
  document.getElementById('shopping-form-modal').style.display = 'flex';
};

window.closeShoppingFormModal = function() {
  document.getElementById('shopping-form-modal').style.display = 'none';
  shoppingFormMode = 'list';
  shoppingFormListId = null;
};

window.submitShoppingForm = async function() {
  if (shoppingFormMode === 'list') {
    const name = document.getElementById('shopping-form-name-input').value.trim();
    if (!name) {
      alert('請輸入清單名稱');
      return;
    }
    try {
      const response = await fetch('/api/food/shopping-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ name })
      });
      const result = await response.json();
      if (result.success) {
        window.closeShoppingFormModal();
        window.loadShoppingLists();
      }
    } catch (error) {
      console.error('Create shopping list error:', error);
    }
  } else {
    const itemName = document.getElementById('shopping-form-item-name-input').value.trim();
    if (!itemName) {
      alert('請輸入物品名稱');
      return;
    }
    const calories = parseInt(document.getElementById('shopping-form-cal-input').value) || 0;
    const protein = parseFloat(document.getElementById('shopping-form-protein-input').value) || 0;
    const carbs = parseFloat(document.getElementById('shopping-form-carbs-input').value) || 0;
    const fat = parseFloat(document.getElementById('shopping-form-fat-input').value) || 0;

    try {
      const response = await fetch('/api/food/shopping-lists/' + shoppingFormListId + '/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ name: itemName, calories, protein, carbs, fat })
      });
      const result = await response.json();
      if (result.success) {
        window.closeShoppingFormModal();
        window.loadShoppingLists();
      }
    } catch (error) {
      console.error('Add item error:', error);
    }
  }
};

window.openCreateShoppingList = function() {
  window.openShoppingFormModal('list', null);
};

window.addItemToShoppingList = function(listId) {
  window.openShoppingFormModal('item', listId);
};

window.toggleShoppingItem = async function(listId, itemIndex) {
  try {
    const response = await fetch('/api/food/shopping-lists/' + listId + '/items/' + itemIndex, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    if (result.success) {
      window.loadShoppingLists();
    }
  } catch (error) {
    console.error('Toggle item error:', error);
  }
};

window.removeShoppingItem = async function(listId, itemIndex) {
  try {
    const response = await fetch('/api/food/shopping-lists/' + listId + '/items/' + itemIndex, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    if (result.success) {
      window.loadShoppingLists();
    }
  } catch (error) {
    console.error('Remove item error:', error);
  }
};

window.deleteShoppingList = async function(listId) {
  if (!confirm('確定要刪除這個購物清單嗎？')) return;

  try {
    const response = await fetch('/api/food/shopping-lists/' + listId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    });
    const result = await response.json();
    if (result.success) {
      window.loadShoppingLists();
    }
  } catch (error) {
    console.error('Delete shopping list error:', error);
  }
};