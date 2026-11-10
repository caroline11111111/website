export interface ThemeTokens {
  name: string;
  primaryBg: string;
  secondaryText: string;
  accent: string;
  buttonBg: string;
  buttonText: string;
  borderCol: string;
}

export const themes: Record<string, ThemeTokens> = {
  originalNeutral: {
    name: 'Original Neutral',
    primaryBg: '#ded8d3',
    secondaryText: '#4b3f34',
    accent: '#b5a699',
    buttonBg: '#000000',
    buttonText: '#ffffff',
    borderCol: '#b5a699',
  },
  macaron: {
    name: 'Bright & Colorful Macaron',
    primaryBg: '#FFF0E8',
    secondaryText: '#59434D',
    accent: '#FFB6C8',
    buttonBg: '#59434D',
    buttonText: '#FFF0E8',
    borderCol: '#FFB6C8',
  },
  summerBreeze: {
    name: 'Summer Breeze Blue',
    primaryBg: '#F0FAFF',
    secondaryText: '#164E78',
    accent: '#42BDEB',
    buttonBg: '#164E78',
    buttonText: '#F0FAFF',
    borderCol: '#42BDEB',
  },
  morandi: {
    name: 'Morandi',
    primaryBg: '#e5e0dc',
    secondaryText: '#625d59',
    accent: '#b7aaa0',
    buttonBg: '#625d59',
    buttonText: '#e5e0dc',
    borderCol: '#b7aaa0',
  },
};
