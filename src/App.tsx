import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { Banner } from './components/Banner';
import { Slideshow } from './components/Slideshow';
import { ShopButton } from './components/ShopButton';
import { ShopPage } from './components/ShopPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { AboutPage } from './components/AboutPage';
import { BagPage } from './components/BagPage';
import { CheckoutPage } from './components/CheckoutPage';
import { AccountPage } from './components/AccountPage';
import { MyOrderPage } from './components/MyOrderPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { Product } from './config/products';

const MainApp: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [accountSubTab, setAccountSubTab] = useState<'account' | 'order'>('account');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('MYR');
  
  // 挂起重定向机制 (如拦截后登录恢复)
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const handleNavigate = (tab: string) => {
    setSelectedProduct(null);
    if (tab === 'account') {
      if (!isAuthenticated) {
        setPendingTab('account');
        setCurrentTab('login');
      } else {
        setCurrentTab(accountSubTab === 'order' ? 'order' : 'account');
      }
    } else {
      setCurrentTab(tab);
    }
  };

  const handleLoginSuccess = () => {
    if (pendingTab) {
      setCurrentTab(pendingTab);
      setPendingTab(null);
    } else {
      setCurrentTab('account');
    }
  };

  const handleRegisterSuccess = () => {
    if (pendingTab) {
      setCurrentTab(pendingTab);
      setPendingTab(null);
    } else {
      setCurrentTab('account');
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentTab('home');
    setAccountSubTab('account');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-[#1A1A1A] font-sans antialiased">
      <Navbar currentTab={currentTab} onNavigate={handleNavigate} />

      <div className="flex-grow">
        {selectedProduct ? (
          <ProductDetailPage
            product={selectedProduct}
            selectedCurrency={selectedCurrency}
            onBack={() => setSelectedProduct(null)}
            onGoBag={() => { setSelectedProduct(null); setCurrentTab('bag'); }}
          />
        ) : (
          <>
            {currentTab === 'home' && (
              <main>
                <Banner />
                <ShopButton onClick={() => setCurrentTab('shop')} />
                <Slideshow />
              </main>
            )}

            {currentTab === 'shop' && (
              <ShopPage
                selectedCurrency={selectedCurrency}
                onSelectProduct={(product) => setSelectedProduct(product)}
              />
            )}

            {currentTab === 'about' && <AboutPage />}

            {currentTab === 'bag' && (
              <BagPage
                selectedCurrency={selectedCurrency}
                onGoCheckout={() => setCurrentTab('checkout')}
                onGoShop={() => setCurrentTab('shop')}
              />
            )}

           {currentTab === 'checkout' && (
  <CheckoutPage
    selectedCurrency={selectedCurrency}
    onOrderComplete={() => {
      setAccountSubTab('order');
      setCurrentTab('order');
    }}
  />
)}

            {currentTab === 'account' && isAuthenticated && (
              <AccountPage
                onNavigateTab={(tab) => {
                  setAccountSubTab(tab);
                  setCurrentTab(tab);
                }}
                onLogout={handleLogout}
              />
            )}

            {currentTab === 'order' && isAuthenticated && (
              <MyOrderPage
                selectedCurrency={selectedCurrency}
                onNavigateTab={(tab) => {
                  setAccountSubTab(tab);
                  setCurrentTab(tab);
                }}
                onLogout={handleLogout}
              />
            )}

            {currentTab === 'login' && (
              <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onGoRegister={() => setCurrentTab('register')}
              />
            )}

            {currentTab === 'register' && (
              <RegisterPage
                onRegisterSuccess={handleRegisterSuccess}
                onGoLogin={() => setCurrentTab('login')}
              />
            )}
          </>
        )}
      </div>

      <FloatingWhatsApp />
      <Footer selectedCurrency={selectedCurrency} onCurrencyChange={setSelectedCurrency} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <LanguageProvider>
          <ThemeProvider>
            <MainApp />
          </ThemeProvider>
        </LanguageProvider>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
