import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { orderService, OrderRemark } from '../services/orderService';
import { formatPrice } from '../config/currencies';
import { SiteImage } from './SiteImage';

interface MyOrderPageProps {
  selectedCurrency: string;
  onNavigateTab: (tab: 'account' | 'order') => void;
  onLogout: () => void;
}

export const MyOrderPage: React.FC<MyOrderPageProps> = ({ selectedCurrency, onNavigateTab, onLogout }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  
  const [remarkInputs, setRemarkInputs] = useState<Record<string, string>>({});
  const [remarksState, setRemarksState] = useState<Record<string, OrderRemark[]>>(() => {
    if (!user) return {};
    const orders = orderService.getOrdersForUser(user.id);
    const map: Record<string, OrderRemark[]> = {};
    orders.forEach(o => {
      map[o.orderId] = orderService.getRemarksForOrder(o.orderId);
    });
    return map;
  });

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 12;

  if (!user) return null;

  const orders = orderService.getOrdersForUser(user.id);
  const monthsMap = Array.from(new Set(orders.map(o => {
    const d = new Date(o.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })));

  const filteredOrders = orders.filter(order => {
    if (selectedCategory !== 'All') {
      const matchCat = order.items.some(item => item.category === selectedCategory);
      if (!matchCat) return false;
    }
    if (selectedMonth !== 'All') {
      const d = new Date(order.createdAt);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (mStr !== selectedMonth) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const currentOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleRemarkSubmit = (orderId: string) => {
    const content = remarkInputs[orderId] || '';
    if (!content.trim()) return;

    try {
      orderService.addRemark(orderId, user.id, content);
      setRemarksState(prev => ({
        ...prev,
        [orderId]: orderService.getRemarksForOrder(orderId)
      }));
      setRemarkInputs(prev => ({ ...prev, [orderId]: '' }));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full flex flex-col md:flex-row min-h-[70vh]">
      <aside className="hidden md:flex flex-col w-64 bg-black text-white p-8 space-y-6">
        <button onClick={() => onNavigateTab('account')} className="text-left text-sm tracking-wide text-gray-400 hover:text-white transition-colors">
          {t.myAccount}
        </button>
        <button onClick={() => onNavigateTab('order')} className="text-left text-sm tracking-wide border-b-2 border-white font-semibold pb-1">
          {t.myOrder}
        </button>
        <button onClick={onLogout} className="text-left text-sm tracking-wide text-gray-400 hover:text-white transition-colors pt-4">
          {t.logOut}
        </button>
      </aside>

      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-transparent relative">
        <h1 className="text-xl font-bold">{t.myOrder}</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Account Menu" className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold shadow">
          C003-P
        </button>

        {mobileMenuOpen && (
          <div className="absolute top-16 right-6 w-48 bg-gray-700 bg-opacity-50 backdrop-blur-md text-white shadow-xl rounded-lg py-3 px-4 z-50 flex flex-col space-y-3">
            <button onClick={() => { onNavigateTab('account'); setMobileMenuOpen(false); }} className="text-left text-sm">{t.myAccount}</button>
            <button onClick={() => { onNavigateTab('order'); setMobileMenuOpen(false); }} className="text-left text-sm border-b border-white font-bold pb-1">{t.myOrder}</button>
            <button onClick={() => { setMobileMenuOpen(false); onLogout(); }} className="text-left text-sm text-red-300 hover:text-white">{t.logOut}</button>
          </div>
        )}
      </div>

      <main className="flex-grow p-6 md:p-12 max-w-4xl">
        <h1 className="hidden md:block text-3xl font-normal mb-6">{t.myOrder}</h1>

        <div className="w-full bg-gray-200 bg-opacity-50 backdrop-blur-sm rounded-lg p-4 mb-8 flex flex-col md:flex-row items-center gap-4 text-sm">
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="font-medium text-gray-700">{t.searchCategory}:</span>
            <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }} className="bg-white border border-gray-300 rounded px-3 py-1.5 focus:outline-none flex-grow">
              <option value="All">{t.allCategories}</option>
              <option value="Handbags">Handbags</option>
              <option value="Watches">Watches</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="font-medium text-gray-700">{t.searchMonth}:</span>
            <select value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }} className="bg-white border border-gray-300 rounded px-3 py-1.5 focus:outline-none flex-grow">
              <option value="All">{t.allMonths}</option>
              {monthsMap.map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
        </div>

        {currentOrders.length === 0 ? (
          <div className="p-8 bg-white/60 rounded-lg border border-gray-200 text-center text-gray-500">{t.noOrders}</div>
        ) : (
          <div className="space-y-8">
            {currentOrders.map(order => {
              const orderRemarks = remarksState[order.orderId] || [];
              return (
                <div key={order.id} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-4">
                  <div className="border-b pb-3 flex flex-col md:flex-row md:items-center justify-between text-sm">
                    <div><span className="font-bold text-gray-800">{t.orderIdLabel}</span> <span className="text-gray-600">{order.orderId}</span></div>
                    <div><span className="font-bold text-gray-800">{t.orderStateLabel}</span> <span className="text-gray-600">{order.orderState}</span></div>
                  </div>

                  <div className="space-y-3">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-4 py-2 border-b border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            <SiteImage fallbackUrl={item.imageUrl} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 uppercase tracking-wider block">{item.brand}</span>
                            <h4 className="text-sm font-semibold text-gray-800">{item.name}</h4>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{formatPrice(item.priceMYR, selectedCurrency)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 bg-gray-50 p-4 rounded-lg space-y-3">
                    <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Order Remarks History</h5>
                    {orderRemarks.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No remarks submitted yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {orderRemarks.map(rem => (
                          <div key={rem.id} className="text-xs bg-white p-2.5 rounded border border-gray-200">
                            <p className="text-gray-800">{rem.content}</p>
                            <span className="text-[10px] text-gray-400 block mt-1">{new Date(rem.createdAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        placeholder={t.addRemarkPlaceholder}
                        value={remarkInputs[order.orderId] || ''}
                        onChange={(e) => setRemarkInputs({ ...remarkInputs, [order.orderId]: e.target.value })}
                        className="flex-grow bg-white border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-black"
                      />
                      <button
                        onClick={() => handleRemarkSubmit(order.orderId)}
                        className="px-4 py-2 bg-black text-white text-xs font-semibold rounded hover:bg-gray-800 transition-colors uppercase tracking-wider"
                      >
                        {t.submitRemark}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 my-8">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100">&laquo; Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button key={num} onClick={() => setCurrentPage(num)} className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${currentPage === num ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{num}</button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-100">Next &raquo;</button>
          </div>
        )}
      </main>
    </div>
  );
};
