import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_THEME, normalizeThemeTokens, themes, ThemeTokens } from '../config/themes';
import { supabase } from '../lib/supabase';

const THEME_SETTING_KEY = 'website_colour_theme';

type ThemeContextType = {
  currentTheme: ThemeTokens;
  setThemeKey: (key: string) => void;
  refreshTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function hexToRgba(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return `rgba(75, 63, 52, ${opacity})`;
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

export function themeToCssVars(theme: ThemeTokens): React.CSSProperties {
  return {
    '--theme-primary': theme.primary,
    '--theme-secondary': theme.secondary,
    '--theme-accent': theme.accent,
    '--theme-background': theme.background,
    '--theme-surface': theme.surface,
    '--theme-text-primary': theme.textPrimary,
    '--theme-text-secondary': theme.textSecondary,
    '--theme-border': theme.border,
    '--theme-button-primary': theme.buttonPrimary,
    '--theme-button-text': theme.buttonText,
    '--theme-button-hover': theme.buttonHover,
    '--theme-input-background': theme.inputBackground,
    '--theme-input-border': theme.inputBorder,
    '--theme-navigation-active': theme.navigationActive,
    '--theme-overlay': hexToRgba(theme.overlay, 0.5),
    '--theme-overlay-opacity': '0.5',
  } as React.CSSProperties;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeTokens>(DEFAULT_THEME);

  const refreshTheme = useCallback(async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', THEME_SETTING_KEY)
      .maybeSingle();
    if (data?.setting_value && typeof data.setting_value === 'object') {
      setCurrentTheme(normalizeThemeTokens(data.setting_value as Partial<ThemeTokens>));
    }
  }, []);

  useEffect(() => {
    void refreshTheme();
  }, [refreshTheme]);

  const setThemeKey = (key: string) => {
    setCurrentTheme(normalizeThemeTokens(themes[key] || DEFAULT_THEME));
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setThemeKey, refreshTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
