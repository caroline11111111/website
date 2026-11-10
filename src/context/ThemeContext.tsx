import React, { createContext, useContext, useState } from 'react';
import { themes, ThemeTokens } from '../config/themes';

interface ThemeContextType {
  currentTheme: ThemeTokens;
  setThemeKey: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeKey, setThemeKey] = useState<string>('originalNeutral');
  const currentTheme = themes[themeKey] || themes.originalNeutral;

  return (
    <ThemeContext.Provider value={{ currentTheme, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
