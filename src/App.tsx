import React, { useState } from 'react';
import { useCart } from './context/CartContext';
import { useAuth } from './context/AuthContext';
import { Product } from './config/products';
import { currencies, formatPrice } from './config/currencies';

// 导入各个页面组件
import { Banner } from './components/Banner';
import { Slideshow } from './components/Slideshow';
import { ShopPage } from './components/ShopPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { BagPage } from './components/BagPage';
import { CheckoutPage } from './components/CheckoutPage';
import { AccountPage } from './components/AccountPage';
import { OrderPage } from './components/OrderPage';
import { LoginPage } from './components/LoginPage';
import { SignUpPage } from './components/SignUpPage';

export function App() {
  // 页面导航状态
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('MYR');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Account 子标签状态 ('profile' | 'order')
  const [accountSubTab, setAccountSubTab] = useState<string>('profile');

  const { items } = useCart();
  const { user } = useAuth();
  const totalCartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentTab('productDetail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] flex flex-col font-sans">
      {/* 顶部全局导航栏 */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <button 
              onClick={() => setCurrentTab('home')}
              className="text-lg font-light tracking-widest uppercase"
            >
              CCC Luxury
            </button>
            <nav className="hidden md:flex space-x-6 text-xs uppercase tracking-wider font-medium">
              <button onClick={() => setCurrentTab('home')} className={`hover:text-black transition-colors ${currentTab === 'home' ? 'text-black font-bold' : 'text-gray-500'}`}>Home</button>
              <button onClick={() => setCurrentTab('shop')} className={`hover:text-black transition-colors ${currentTab === 'shop' ? 'text-black font-bold' : 'text-gray-500'}`}>Shop</button>
            </nav>
          </div>

          <div className="flex items-center space-x-5">
            {/* 货币切换选择框 */}
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-transparent text-xs font-semibold uppercase border border-gray-300 rounded px-2 py-1 focus:outline-none"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>

            {/* Bag 按钮 */}
            <button
              onClick={() => setCurrentTab('bag')}
              className="relative text-xs uppercase tracking-wider font-semibold hover:opacity-70 transition-opacity"
            >
              Bag
              {totalCartCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Account / Login 按钮 */}
            <button
              onClick={() => {
                if (user) {
                  setAccountSubTab('profile');
                  setCurrentTab('account');
                } else {
                  setCurrentTab('login');
                }
              }}
              className="text-xs uppercase tracking-wider font-semibold hover:opacity-70 transition-opacity"
            >
              {user ? 'Account' : 'Login'}
            </button>
          </div>
        </div>
      </header>

      {/* 主体内容区域切换 */}
      <main className="flex-grow">
        {currentTab === 'home' && (
          <div className="space-y-12 pb-16">
            <Banner />
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-light tracking-wider">FEATURED HIGHLIGHTS</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Discover our finest curated selections</p>
              </div>
            </div>
            <Slideshow />
            <div className="text-center pt-4">
              <button
                onClick={() => setCurrentTab('shop')}
                className="px-8 py-3 bg-black text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all shadow-md"
              >
                Explore Full Shop
              </button>
            </div>
          </div>
        )}

        {currentTab === 'shop' && (
          <ShopPage selectedCurrency={selectedCurrency} onSelectProduct={handleSelectProduct} />
        )}

        {currentTab === 'productDetail' && selectedProduct && (
          <ProductDetailPage
            product={selectedProduct}
            selectedCurrency={selectedCurrency}
            onBack={() => setCurrentTab('shop')}
            onGoBag={() => setCurrentTab('bag')}
          />
        )}

        {currentTab === 'bag' && (
          <BagPage
            selectedCurrency={selectedCurrency}
            onGoShop={() => setCurrentTab('shop')}
            onCheckout={() => setCurrentTab('checkout')}
          />
        )}

        {currentTab === 'checkout' && (
          <CheckoutPage
            selectedCurrency={selectedCurrency}
            onOrderComplete={() => {
              setAccountSubTab('order');
              setCurrentTab('account');
            }}
          />
        )}

        {currentTab === 'account' && (
          <AccountPage
            initialSubTab={accountSubTab}
            selectedCurrency={selectedCurrency}
          />
        )}

        {currentTab === 'order' && (
          <OrderPage selectedCurrency={selectedCurrency} />
        )}

        {currentTab === 'login' && (
          <LoginPage
            onSuccess={() => setCurrentTab('account')}
            onGoSignUp={() => setCurrentTab('signup')}
          />
        )}

        {currentTab === 'signup' && (
          <SignUpPage
            onSuccess={() => setCurrentTab('account')}
            onGoLogin={() => setCurrentTab('login')}
          />
        )}
      </main>

      {/* 底部版权栏 */}
      <footer className="bg-white border-t border-gray-200 py-8 text-center text-xs text-gray-500 uppercase tracking-widest">
        &copy; {new Date().getFullYear()} CCC Luxury Platform. All Rights Reserved.
      </footer>
    </div>
  );
}

export default App;
