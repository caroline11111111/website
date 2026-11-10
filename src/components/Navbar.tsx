import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { siteImages } from '../config/siteConfig';
import { SiteImage } from './SiteImage';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onNavigate }) => {
  const { t } = useLanguage();
  const { totalItemsCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { key: 'home', label: t.home },
    { key: 'shop', label: t.shop },
    { key: 'about', label: t.about },
    { key: 'account', label: t.account },
  ];

  return (
    <header className="w-full bg-black text-white px-6 py-4 flex items-center justify-between relative z-40">
      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden flex flex-col space-y-1.5 focus:outline-none"
        aria-label="Toggle Menu"
      >
        <span className="w-6 h-0.5 bg-white"></span>
        <span className="w-6 h-0.5 bg-white"></span>
        <span className="w-6 h-0.5 bg-white"></span>
      </button>

      {/* 桌面端导航链接 */}
      <nav className="hidden md:flex items-center space-x-8 text-sm font-medium tracking-wide">
        {navItems.map(item => {
          const isActive = currentTab === item.key || (item.key === 'account' && ['account', 'login', 'register', 'order'].includes(currentTab));
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`pb-1 transition-colors relative ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {item.label}
              {isActive && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-white"></span>}
            </button>
          );
        })}
      </nav>

      {/* C002-D / C002-P 网站 Logo */}
      <div className="cursor-pointer" onClick={() => onNavigate('home')}>
        <div className="h-10 w-28 bg-gray-300 rounded flex items-center justify-center overflow-hidden">
          <SiteImage src={siteImages.logo.url} alt="Logo" className="h-full w-full object-cover" />
        </div>
      </div>

      {/* 右侧 Bag 计数器 */}
      <div>
        <button
          onClick={() => onNavigate('bag')}
          className="text-sm font-medium hover:opacity-80 transition-opacity"
        >
          {t.bag} ({totalItemsCount})
        </button>
      </div>

      {/* 移动端全屏下拉导航 */}
      {mobileOpen && (
        <div className="absolute top-full left-0 w-full bg-black/95 backdrop-blur-md text-white py-6 px-6 flex flex-col space-y-4 md:hidden border-t border-gray-800 shadow-xl">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => { onNavigate(item.key); setMobileOpen(false); }}
              className={`text-left text-base pb-2 ${currentTab === item.key ? 'border-b border-white font-bold' : 'text-gray-400'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
