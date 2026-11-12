import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';

interface FooterProps {
  selectedCurrency: string;
  onCurrencyChange: (curr: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ selectedCurrency, onCurrencyChange }) => {
  const { language: lang, setLanguage: setLang } = useLanguage();
  const { currencies } = useCurrency();

  return (
    <footer className="w-full bg-gray-100 text-gray-700 py-8 px-6 mt-auto border-t border-gray-200 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* 语言切换器 */}
        <div className="flex items-center space-x-4">
          <span className="font-medium">Language:</span>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded transition-all ${lang === 'en' ? 'bg-black text-white font-bold' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}
          >
            English
          </button>
          <button
            onClick={() => setLang('zh')}
            className={`px-3 py-1 rounded transition-all ${lang === 'zh' ? 'bg-black text-white font-bold' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}
          >
            简体中文
          </button>
        </div>

        {/* 货币选择器 */}
        <div className="flex items-center space-x-3">
          <span className="font-medium">Currency:</span>
          <select
            value={selectedCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="bg-white border border-gray-300 rounded px-3 py-1.5 focus:outline-none"
          >
            {currencies.filter(c => c.isActive).map(c => (
              <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
            ))}
          </select>
        </div>
      </div>
    </footer>
  );
};
