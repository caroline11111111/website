import React, { useState } from 'react';
import { Product } from '../config/products';
import { useCart } from '../context/CartContext';
import { bagStatsService } from '../services/bagStats';
import { formatPrice } from '../config/currencies';
import { SiteImage } from './SiteImage';

interface ProductDetailPageProps {
  product: Product;
  selectedCurrency: string;
  onBack: () => void;
  onGoBag: () => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ product, selectedCurrency, onBack, onGoBag }) => {
  const { addToCart } = useCart();
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [addedCount, setAddedCount] = useState<number>(() => bagStatsService.getStats(product.id));

  const handleAddToCart = () => {
    addToCart({
      id: `cart_${Date.now()}_${Math.random()}`,
      productId: product.id,
      name: product.name,
      brand: product.brand,
      priceMYR: product.priceMYR,
      imageUrl: product.images[0]?.url || '',
    });
    bagStatsService.recordAddToCart(product.id);
    setAddedCount(bagStatsService.getStats(product.id));
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12 space-y-8">
      <button onClick={onBack} className="text-sm font-medium text-gray-500 hover:text-black transition-colors">
        &larr; Back to Shop
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* 图片预览区 */}
        <div className="space-y-4">
          <div className="h-96 md:h-[500px] bg-gray-100 rounded-lg overflow-hidden shadow-sm">
            <SiteImage src={product.images[activeImgIndex]?.url} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex space-x-3 overflow-x-auto pb-2">
            {product.images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setActiveImgIndex(idx)}
                className={`w-20 h-20 rounded overflow-hidden border-2 flex-shrink-0 transition-all ${idx === activeImgIndex ? 'border-black' : 'border-transparent opacity-70'}`}
              >
                <SiteImage src={img.url} alt="Thumbnail" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* 商品详情信息区 */}
        <div className="space-y-6">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{product.brand}</span>
          <h1 className="text-3xl font-light text-gray-900">{product.name}</h1>
          <p className="text-2xl font-bold text-black">{formatPrice(product.priceMYR, selectedCurrency)}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
            Added to bag statistics: <span className="font-bold text-black">{addedCount}</span> times
          </div>

          <div className="pt-6 flex gap-4">
            <button
              onClick={handleAddToCart}
              className="flex-grow py-4 bg-black text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all shadow-md"
            >
              Add to Bag
            </button>
            <button
              onClick={onGoBag}
              className="px-6 py-4 border border-black text-black text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-50 transition-all"
            >
              View Bag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
