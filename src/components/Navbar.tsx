import React from 'react';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  cartCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView, cartCount }) => {
  return (
    <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <button 
            onClick={() => setCurrentView('home')} 
            className="text-lg font-bold tracking-widest uppercase cursor-pointer"
          >
            CCC
          </button>
          <div className="hidden md:flex space-x-6 text-sm">
            <button onClick={() => setCurrentView('home')} className={`cursor-pointer hover:text-black ${currentView === 'home' ? 'font-bold text-black' : 'text-gray-500'}`}>
              Home
            </button>
            <button onClick={() => setCurrentView('shop')} className={`cursor-pointer hover:text-black ${currentView === 'shop' ? 'font-bold text-black' : 'text-gray-500'}`}>
              Shop
            </button>
            <button onClick={() => setCurrentView('about')} className={`cursor-pointer hover:text-black ${currentView === 'about' ? 'font-bold text-black' : 'text-gray-500'}`}>
              About
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <button onClick={() => setCurrentView('account')} className="text-sm text-gray-700 hover:text-black cursor-pointer">
            Account
          </button>

          <button onClick={() => setCurrentView('bag')} className="relative text-sm text-gray-700 hover:text-black cursor-pointer">
            Bag
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
