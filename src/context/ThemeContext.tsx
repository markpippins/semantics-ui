import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme } from '../types';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cardBgClass: string;
  bodyBgClass: string;
  textPrimaryClass: string;
  textSecondaryClass: string;
  borderClass: string;
  accentClass: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('semantics_theme');
    return (saved as Theme) || 'steel';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('semantics_theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-steel');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  // Styling helper tokens based on theme
  let cardBgClass = 'bg-zinc-800/80 backdrop-blur-md';
  let bodyBgClass = 'bg-zinc-900 text-zinc-100';
  let textPrimaryClass = 'text-zinc-100';
  let textSecondaryClass = 'text-zinc-400';
  let borderClass = 'border-zinc-700/60';
  let accentClass = 'bg-indigo-600 hover:bg-indigo-500 text-white';

  if (theme === 'light') {
    cardBgClass = 'bg-white/90 backdrop-blur-md shadow-xs';
    bodyBgClass = 'bg-slate-50 text-slate-900';
    textPrimaryClass = 'text-slate-900';
    textSecondaryClass = 'text-slate-500';
    borderClass = 'border-slate-200';
    accentClass = 'bg-blue-600 hover:bg-blue-700 text-white';
  } else if (theme === 'dark') {
    cardBgClass = 'bg-slate-900/90 backdrop-blur-md shadow-lg';
    bodyBgClass = 'bg-slate-950 text-slate-100';
    textPrimaryClass = 'text-slate-100';
    textSecondaryClass = 'text-slate-400';
    borderClass = 'border-slate-800';
    accentClass = 'bg-cyan-600 hover:bg-cyan-500 text-white';
  } else if (theme === 'steel') {
    cardBgClass = 'bg-zinc-850/90 bg-neutral-900/80 backdrop-blur-md shadow-md';
    bodyBgClass = 'bg-zinc-900 text-zinc-100';
    textPrimaryClass = 'text-zinc-100';
    textSecondaryClass = 'text-zinc-400';
    borderClass = 'border-zinc-700/60';
    accentClass = 'bg-sky-600 hover:bg-sky-500 text-white';
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        cardBgClass,
        bodyBgClass,
        textPrimaryClass,
        textSecondaryClass,
        borderClass,
        accentClass,
      }}
    >
      <div className={`min-h-screen ${bodyBgClass} transition-colors duration-200 font-sans antialiased`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
