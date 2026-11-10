import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface ShopButtonProps {
  onClick: () => void;
}

export const ShopButton: React.FC<ShopButtonProps> = ({ onClick }) => {
  const { t } = useLanguage();
  return (
    <div className="w-full flex justify-center my-10">
      <button
        onClick={onClick}
        className="px-8 py-3.5 bg-black text-white text-sm font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all shadow-md"
      >
        {t.shopButton}
      </button>
    </div>
  );
};
