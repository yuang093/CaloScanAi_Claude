import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const THEMES = {
  PLAYFUL: 'playful',
  NATURAL: 'natural',
  WARM: 'warm',
};

export const DARK_MODE = 'dark';
export const LIGHT_MODE = 'light';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('caloscanai_theme') || THEMES.NATURAL;
    }
    return THEMES.NATURAL;
  });

  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('caloscanai_mode') || LIGHT_MODE;
    }
    return LIGHT_MODE;
  });

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-mode', mode);
    localStorage.setItem('caloscanai_theme', theme);
    localStorage.setItem('caloscanai_mode', mode);
  }, [theme, mode]);

  const switchTheme = useCallback((newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setTheme(newTheme);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(prev => prev === LIGHT_MODE ? DARK_MODE : LIGHT_MODE);
  }, []);

  const value = {
    theme,
    mode,
    switchTheme,
    toggleMode,
    isPlayful: theme === THEMES.PLAYFUL,
    isNatural: theme === THEMES.NATURAL,
    isWarm: theme === THEMES.WARM,
    isDark: mode === DARK_MODE,
    isLight: mode === LIGHT_MODE,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;