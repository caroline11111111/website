import React, { useState } from 'react';
import { mockProducts, Product } from '../config/products';
import { formatPrice } from '../config/currencies';
import { SiteImage } from './SiteImage';

interface ShopPageProps {
  selectedCurrency: string;
  onSelectProduct: (product: Product) => void;
}

export const ShopPage: React.FC<ShopPageProps> = ({ selectedCurrency, onSelectProduct }) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const categories = ['Handbags', 'Watches'];

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
    setCurrentPage(1);
  };

  const filteredProducts = mockProducts.filter(p => {
    if (selectedCategories.length === 0) return true;
    return selectedCategories.includes(p.category);
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const currentProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl font-light">Shop Collection</h1>

      {/* 分类多选过滤栏 (OR 逻辑) */}
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b">
        <span className="text-sm font-medium text-gray-700 mr-2">Categories:</span>
        {categories.map(cat => {
          const isSelected = selectedCategories.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all ${
                isSelected ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 商品网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {currentProducts.map(prod => (
          <div
            key={prod.id}
            onClick={() => onSelectProduct(prod)}
            className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
          >
            <div className="h-64 bg-gray-100 overflow-hidden">
              <SiteImage src={prod.images[0]?.url} alt={prod.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-4 flex flex-col flex-grow justify-between space-y-2">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">{prod.brand}</span>
                <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{prod.name}</h3>
              </div>
              <p className="text-sm font-bold text-black">{formatPrice(prod.priceMYR, selectedCurrency)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 分页组件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-8">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            &laquo; Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${
                currentPage === num ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {num}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            Next &raquo;
          </button>
        </div>
      )}
    </div>
  );
};
