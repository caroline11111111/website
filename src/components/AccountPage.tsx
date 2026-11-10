import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { orderService, Order } from '../services/orderService';
import { formatPrice } from '../config/currencies';
import { SiteImage } from './SiteImage';

interface AccountPageProps {
  initialSubTab?: string;
  selectedCurrency: string;
}

export const AccountPage: React.FC<AccountPageProps> = ({ initialSubTab = 'profile', selectedCurrency }) => {
  const { user, logout } = useAuth();
  const [subTab, setSubTab] = useState<string>(initialSubTab);
  const [orders, setOrders] = useState<Order[]>([]);

  // 每次进入或切换到 order 标签时，自动拉取最新的订单列表
  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (subTab === 'order') {
      const allOrders = orderService.getOrders();
      setOrders(allOrders);
    }
  }, [subTab]);

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div className="flex justify-between items-center border-b pb-6">
        <h1 className="text-3xl font-light">My Account</h1>
        <button
          onClick={logout}
          className="text-xs uppercase tracking-wider text-red-600 hover:underline font-semibold"
        >
          Sign Out
        </button>
      </div>

      {/* 子标签切换栏：Profile / My Order */}
      <div className="flex space-x-6 border-b border-gray-200 pb-3 text-xs uppercase tracking-widest font-semibold">
        <button
          onClick={() => setSubTab('profile')}
          className={`pb-2 transition-colors border-b-2 ${
            subTab === 'profile' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => {
            setSubTab('order');
            setOrders(orderService.getOrders());
          }}
          className={`pb-2 transition-colors border-b-2 ${
            subTab === 'order' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black'
          }`}
        >
          My Order
        </button>
      </div>

      {/* Profile 内容区 */}
      {subTab === 'profile' && user && (
        <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm space-y-4 max-w-xl">
          <h2 className="text-lg font-medium">Personal Information</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-semibold text-black">Name:</span> {user.name}</p>
            <p><span className="font-semibold text-black">Email:</span> {user.email}</p>
            <p><span className="font-semibold text-black">Default Address:</span> {user.address || 'Not specified'}</p>
          </div>
        </div>
      )}

      {/* My Order 内容区 */}
      {subTab === 'order' && (
        <div className="space-y-6">
          <h2 className="text-lg font-medium">Order History ({orders.length})</h2>
          {orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200 text-gray-400 text-sm">
              No orders found yet. Complete a checkout to see your orders here.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-center text-xs text-gray-500 border-b pb-3">
                  <span>Order ID: <strong className="text-black">{order.id}</strong></span>
                  <span>Date: {new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded font-semibold uppercase">{order.status}</span>
                </div>

                {/* 订单包含的商品列表 */}
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          <SiteImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase">{item.brand}</p>
                          <h4 className="text-sm font-medium text-gray-800">{item.name}</h4>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-black">
                        {formatPrice(item.priceMYR * item.quantity, selectedCurrency)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 flex justify-between items-center text-sm font-bold">
                  <span>Total Paid:</span>
                  <span className="text-base">{formatPrice(order.totalPriceMYR, selectedCurrency)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
