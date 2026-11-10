import React, { useState } from 'react';
import { useCart } from '../components/../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { formatPrice } from '../config/currencies';
import { SiteImage } from './SiteImage';

interface BagPageProps {
  selectedCurrency: string;
  onGoCheckout: () => void;
  onGoShop: () => void;
}

export const BagPage: React.FC<BagPageProps> = ({ selectedCurrency, onGoCheckout, onGoShop }) => {
  const { items, removeFromCart, clearCart } = useCart();
  const { t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<string[]>(items.map(i => i.id));

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const totalPrice = items
    .filter(i => selectedIds.includes(i.id))
    .reduce((sum, i) => sum + i.priceMYR * i.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto px-6 py-20 text-center space-y-6">
        <h1 className="text-3xl font-light">{t.bag}</h1>
        <p className="text-gray-500 text-sm">{t.emptyBag}</p>
        <button
          onClick={onGoShop}
          className="px-8 py-3 bg-black text-white rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-gray-800 transition-all"
        >
          {t.shopButton}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl font-light">{t.bag} ({items.length})</h1>

      <div className="flex items-center justify-between border-b pb-4 text-sm font-medium text-gray-700">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.length === items.length && items.length > 0}
            onChange={handleSelectAll}
            className="rounded border-gray-300"
          />
          <span>{t.selectAll}</span>
        </label>
        <button onClick={clearCart} className="text-red-600 hover:underline text-xs">Clear Bag</button>
      </div>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center space-x-4">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleSelect(item.id)}
                className="rounded border-gray-300"
              />
              {/* B003: Product Image */}
              <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                <SiteImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              </div>
              {/* B004: Product Info */}
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block">{item.brand}</span>
                <h3 className="text-sm font-semibold text-gray-800">{item.name}</h3>
                <p className="text-xs text-gray-500 mt-1">Qty: {item.quantity}</p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <span className="text-sm font-bold text-gray-900">
                {formatPrice(item.priceMYR * item.quantity, selectedCurrency)}
              </span>
              <button
                onClick={() => removeFromCart(item.id)}
                className="text-xs text-red-500 hover:underline"
              >
                {t.remove}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-lg font-semibold">
          Total: <span className="text-xl font-bold text-black">{formatPrice(totalPrice, selectedCurrency)}</span>
        </div>
        <button
          onClick={onGoCheckout}
          disabled={selectedIds.length === 0}
          className="w-full md:w-auto px-10 py-3.5 bg-black text-white text-xs font-semibold uppercase tracking-wider rounded-full hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          {t.checkout}
        </button>
      </div>
    </div>
  );
};
