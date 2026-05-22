import { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES } from '../context/ThemeContext';

const THEME_CONFIG = [
  {
    key: THEMES.PLAYFUL,
    icon: '&#127852;',
    name: '俏皮',
    description: '明亮繽紛',
    color: '#FF6B9D',
  },
  {
    key: THEMES.NATURAL,
    icon: '&#127793;',
    name: '自然',
    description: '清新簡約',
    color: '#2d6a4f',
  },
  {
    key: THEMES.WARM,
    icon: '&#127834;',
    name: '溫暖',
    description: '舒適溫暖',
    color: '#c85a3b',
  },
];

export default function ThemeSwitcher() {
  const { theme, switchTheme, mode, toggleMode, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeSelect = (themeKey) => {
    switchTheme(themeKey);
    setIsOpen(false);
  };

  const currentTheme = THEME_CONFIG.find(t => t.key === theme);

  return (
    <div className="theme-switcher" ref={dropdownRef}>
      {/* Theme Options Dropdown */}
      <div className={`theme-dropdown ${isOpen ? 'open' : ''}`}>
        {/* Theme Selection */}
        <div style={{ padding: '4px 8px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: '8px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            選擇風格
          </div>
          {THEME_CONFIG.map((t) => (
            <div
              key={t.key}
              className={`theme-option ${theme === t.key ? 'active' : ''}`}
              onClick={() => handleThemeSelect(t.key)}
            >
              <div
                className="theme-option-icon"
                style={{ background: t.color, color: 'white' }}
                dangerouslySetInnerHTML={{ __html: t.icon }}
              />
              <div>
                <div className="theme-option-text">{t.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Dark/Light Mode Toggle */}
        <div style={{ padding: '4px 8px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            顯示模式
          </div>
          <div
            className="theme-option"
            onClick={toggleMode}
          >
            <div
              className="theme-option-icon"
              style={{ background: isDark ? '#1a1225' : '#FFD93D', color: isDark ? '#fff' : '#333' }}
            >
              {isDark ? '&#127769;' : '&#9788;'}
            </div>
            <div className="theme-option-text">
              {isDark ? '深色模式' : '淺色模式'}
            </div>
          </div>
        </div>
      </div>

      {/* Trigger Button */}
      <button
        className="theme-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="切換主題"
        style={{
          background: currentTheme?.color,
        }}
      >
        <span dangerouslySetInnerHTML={{ __html: currentTheme?.icon || '&#9776;' }} />
      </button>
    </div>
  );
}