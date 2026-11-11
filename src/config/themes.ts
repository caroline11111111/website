export interface ThemeTokens {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  buttonPrimary: string;
  buttonText: string;
  buttonHover: string;
  inputBackground: string;
  inputBorder: string;
  navigationActive: string;
  overlay: string;
  overlayOpacity: number;
  // Backward-compatible aliases retained for any existing consumers.
  primaryBg: string;
  secondaryText: string;
  buttonBg: string;
  borderCol: string;
}

export const DEFAULT_THEME: ThemeTokens = {
  name: 'Default Neutral',
  primary: '#ded8d3',
  secondary: '#4b3f34',
  accent: '#b5a699',
  background: '#fbf9f7',
  surface: '#fffdfb',
  textPrimary: '#2d2926',
  textSecondary: '#6b625b',
  border: '#ded8d3',
  buttonPrimary: '#4b3f34',
  buttonText: '#ffffff',
  buttonHover: '#392f27',
  inputBackground: '#fffdfa',
  inputBorder: '#b5a699',
  navigationActive: '#4b3f34',
  overlay: '#4b3f34',
  overlayOpacity: 0.5,
  primaryBg: '#ded8d3',
  secondaryText: '#6b625b',
  buttonBg: '#4b3f34',
  borderCol: '#ded8d3',
};

export function normalizeThemeTokens(value: Partial<ThemeTokens> | null | undefined): ThemeTokens {
  const merged = { ...DEFAULT_THEME, ...(value || {}) };
  return {
    ...merged,
    primaryBg: merged.primary,
    secondaryText: merged.textSecondary,
    buttonBg: merged.buttonPrimary,
    borderCol: merged.border,
    overlayOpacity: 0.5,
  };
}

// Legacy keys are retained so older code that refers to them continues to resolve.
// The Theme & Design editor exposes the neutral theme as the single active editable theme.
export const themes: Record<string, ThemeTokens> = {
  originalNeutral: DEFAULT_THEME,
  macaron: normalizeThemeTokens({
    name: 'Bright & Colorful Macaron',
    primary: '#FFF0E8', secondary: '#59434D', accent: '#FFB6C8',
    background: '#FFF8F4', surface: '#FFFFFF', textPrimary: '#34262C',
    textSecondary: '#6C5961', border: '#E8C8D1', buttonPrimary: '#59434D',
    buttonText: '#FFF0E8', buttonHover: '#45343C', inputBackground: '#FFFFFF',
    inputBorder: '#D9A8B8', navigationActive: '#59434D', overlay: '#59434D',
  }),
  summerBreeze: normalizeThemeTokens({
    name: 'Summer Breeze Blue',
    primary: '#F0FAFF', secondary: '#164E78', accent: '#42BDEB',
    background: '#F7FCFF', surface: '#FFFFFF', textPrimary: '#123A58',
    textSecondary: '#45677F', border: '#C8E7F4', buttonPrimary: '#164E78',
    buttonText: '#FFFFFF', buttonHover: '#103B5C', inputBackground: '#FFFFFF',
    inputBorder: '#8CCFE8', navigationActive: '#164E78', overlay: '#164E78',
  }),
  morandi: normalizeThemeTokens({
    name: 'Morandi',
    primary: '#e5e0dc', secondary: '#625d59', accent: '#b7aaa0',
    background: '#f8f6f4', surface: '#ffffff', textPrimary: '#383431',
    textSecondary: '#625d59', border: '#d8d0ca', buttonPrimary: '#625d59',
    buttonText: '#ffffff', buttonHover: '#4d4945', inputBackground: '#ffffff',
    inputBorder: '#b7aaa0', navigationActive: '#625d59', overlay: '#625d59',
  }),
};
