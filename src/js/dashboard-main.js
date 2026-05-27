// ============================================
// dashboard-main.js - 全域變數、初始化、主題
// ============================================

// State (掛載到 window 供其他模組使用)
window.currentImage = null;
window.currentPreview = null;
window.analysisData = null;
window.foodLog = [];
window.isDark = false;

// Theme management
window.setTheme = function(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('caloscanai_theme', theme);

  const themes = {
    playful: { bg: '#FF6B9D', icon: '🎨' },
    natural: { bg: '#2d6a4f', icon: '🌿' },
    warm: { bg: '#c85a3b', icon: '🍊' }
  };

  document.getElementById('theme-btn').style.background = themes[theme].bg;
  document.getElementById('theme-btn').textContent = themes[theme].icon;

  // Update active state
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.remove('active');
    if (opt.textContent.includes(theme === 'playful' ? '俏皮' : theme === 'natural' ? '自然' : '溫暖')) {
      opt.classList.add('active');
    }
  });

  document.getElementById('theme-dropdown').classList.remove('open');
};

window.toggleDarkMode = function() {
  window.isDark = !window.isDark;
  document.body.setAttribute('data-mode', window.isDark ? 'dark' : 'light');
  document.getElementById('mode-icon').textContent = window.isDark ? '☀️' : '🌙';
  document.getElementById('mode-text').textContent = window.isDark ? '淺色模式' : '深色模式';
  localStorage.setItem('caloscanai_mode', window.isDark ? 'dark' : 'light');
  document.getElementById('theme-dropdown').classList.remove('open');
};

window.toggleThemeDropdown = function() {
  document.getElementById('theme-dropdown').classList.toggle('open');
};

window.logout = function() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
};

window.checkAuth = function() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
};

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
  // Verify token by calling /api/auth/me
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      throw new Error('Unauthorized');
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    localStorage.removeItem('token');
    window.location.href = 'login.html';
    return;
  }

  // 檢查是否為管理員，顯示管理介面按鈕
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (isAdmin) {
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) adminBtn.style.display = 'inline-block';
  }

  // Load food log from API
  window.loadFoodLog();

  // Apply saved theme
  const savedTheme = localStorage.getItem('caloscanai_theme') || 'natural';
  setTheme(savedTheme);

  // Apply saved dark mode
  const savedMode = localStorage.getItem('caloscanai_mode');
  if (savedMode === 'dark') {
    isDark = true;
    document.body.setAttribute('data-mode', 'dark');
    document.getElementById('mode-icon').textContent = '☀️';
    document.getElementById('mode-text').textContent = '淺色模式';
  }

  console.log('[CaloScanAi] Initialized successfully');
});

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('theme-dropdown');
  const btn = document.getElementById('theme-btn');
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});
