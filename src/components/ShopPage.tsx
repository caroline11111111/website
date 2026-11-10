import React, { useState, useMemo } from 'react';
import { mockProducts, Product } from '../config/products';
import { formatPrice } from '../config/currencies';
import { SiteImage } from './SiteImage';

interface ShopPageProps {
  selectedCurrency: string;
  onSelectProduct: (product: Product) => void;
}

export const ShopPage: React.FC<ShopPageProps> = ({ selectedCurrency, onSelectProduct }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBrandLetter, setSelectedBrandLetter] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // 提取所有出现的首字母 A-Z 供品牌快速筛选
  const alphabet = ['All', ...Array.from(new Set(mockProducts.map((p) => p.brand.charAt(0).toUpperCase()))).sort()];
  
  // 提取所有具体品牌名称
  const allBrands = ['All', ...Array.from(new Set(mockProducts.map((p) => p.brand))).sort()];

  // 根据字母过滤品牌下拉菜单
  const filteredBrandsList = useMemo(() => {
    if (selectedBrandLetter === 'All') return allBrands;
    return ['All', ...allBrands.filter((b) => b !== 'All' && b.charAt(0).toUpperCase() === selectedBrandLetter)];
  }, [selectedBrandLetter, allBrands]);

  // 根据 P001 的多重条件过滤商品
  const filteredProducts = mockProducts.filter((p) => {
    // 1. 分类判断 (All Items / Handbags / Watches)
    if (selectedCategory !== 'All' && p.category !== selectedCategory) {
      return false;
    }
    // 2. 品牌首字母过滤
    if (selectedBrandLetter !== 'All' && p.brand.charAt(0).toUpperCase() !== selectedBrandLetter) {
      return false;
    }
    // 3. 具体品牌过滤
    if (selectedBrand !== 'All' && p.brand !== selectedBrand) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const currentProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSelectedCategory('All');
    setSelectedBrandLetter('All');
    setSelectedBrand('All');
    setCurrentPage(1);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl font-light">Shop Collection</h1>

      {/* P001: 分类与 Brands 字母筛选栏 */}
      <div id="P001" className="space-y-4 pb-6 border-b border-gray-200">
        {/* 第一排：主分类 */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Category:</span>
          {['All', 'Handbags', 'Watches'].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all ${
                selectedCategory === cat ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat === 'All' ? 'All Items' : cat}
            </button>
          ))}
          
          {(selectedCategory !== 'All' || selectedBrand !== 'All' || selectedBrandLetter !== 'All') && (
            <button
              onClick={resetFilters}
              className="text-xs text-red-500 hover:underline ml-auto font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* 第二排：Brands 首字母 (A, B, C, D...) & 品牌下拉列表 */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Brands:</span>
          
          {/* 品牌选择下拉框 */}
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white border border-gray-300 rounded text-xs px-3 py-1 mr-3 focus:outline-none focus:border-black"
          >
            <option value="All">All Brands</option>
            {filteredBrandsList.filter(b => b !== 'All').map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* 首字母快速点选按钮 */}
          <div className="flex flex-wrap items-center gap-1">
            {alphabet.map((letter) => (
              <button
                key={letter}
                onClick={() => {
                  setSelectedBrandLetter(letter);
                  setSelectedBrand('All');
                  setCurrentPage(1);
                }}
                className={`w-6 h-6 rounded text-[11px] font-bold transition-all ${
                  selectedBrandLetter === letter
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 商品网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {currentProducts.map((prod) => (
          <div
            key={prod.id}
            onClick={() => onSelectProduct(prod)}
            className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
          >
            <div className="h-64 bg-gray-100 overflow-hidden">
              <SiteImage
                src={prod.images[0]?.url}
                alt={prod.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
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
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            &laquo; Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
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
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100"
          >
            Next &raquo;
          </button>
        </div>
      )}
    </div>
  );
};
