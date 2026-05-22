import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ThemeSwitcher from './components/ThemeSwitcher';

// Pages
import Login from './pages/Login';
import FoodLog from './pages/FoodLog';
import DailyProgress from './pages/DailyProgress';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const { theme } = useTheme();

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage('food-log');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('login');
  };

  return (
    <div className="app" data-theme={theme}>
      {currentPage === 'login' && (
        <Login onLogin={handleLogin} />
      )}

      {currentPage === 'food-log' && (
        <div className="app-container">
          <nav className="nav">
            <div className="nav-brand">
              <span className="logo">Calo<span>Scan</span>Ai</span>
            </div>
            <div className="nav-links">
              <button onClick={() => setCurrentPage('food-log')} className="nav-link active">
                食物日誌
              </button>
              <button onClick={() => setCurrentPage('progress')} className="nav-link">
                每日進度
              </button>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary">
              登出
            </button>
          </nav>

          <main className="main-content">
            <FoodLog />
          </main>
        </div>
      )}

      {currentPage === 'progress' && (
        <div className="app-container">
          <nav className="nav">
            <div className="nav-brand">
              <span className="logo">Calo<span>Scan</span>Ai</span>
            </div>
            <div className="nav-links">
              <button onClick={() => setCurrentPage('food-log')} className="nav-link">
                食物日誌
              </button>
              <button onClick={() => setCurrentPage('progress')} className="nav-link active">
                每日進度
              </button>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary">
              登出
            </button>
          </nav>

          <main className="main-content">
            <DailyProgress />
          </main>
        </div>
      )}

      <ThemeSwitcher />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}