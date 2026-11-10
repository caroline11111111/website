import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { orderService, Order } from '../services/orderService';
import { formatPrice } from '../config/currencies';

interface AccountPageProps {
  initialSubTab?: string;
  selectedCurrency: string;
}

export const AccountPage: React.FC<AccountPageProps> = ({ initialSubTab = 'profile', selectedCurrency }) => {
  const { user, logout } = useAuth();
  const [subTab, setSubTab] = useState<string>(initialSubTab);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // 每次切换到 order 标签时实时更新列表
  useEffect(() => {
    if (subTab === 'order') {
      setOrders(orderService.getOrders());
    }
  }, [subTab]);

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div className="flex justify-between items-center border-b pb-6">
        <h1 className="text-3xl font-light">My Account</h1>
        {user && (
          <button onClick={logout} className="text-xs uppercase tracking-wider text-red-600 hover:underline font-semibold">
            Sign Out
          </button>
        )}
      </div>

      <div className="flex space-x-6 border-b border-gray-200 pb-3 text-xs uppercase tracking-widest font-semibold">
        <button
          onClick={() => setSubTab('profile')}
          className={`pb-2 border-b-2 ${subTab === 'profile' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
        >
          Profile
        </button>
        <button
          onClick={() => {
            setSubTab('order');
            setOrders(orderService.getOrders());
          }}
          className={`pb-2 border-b-2 ${subTab === 'order' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
        >
          My Order
        </button>
      </div>

      {subTab === 'profile' && (
        <div className="bg-white p-6 rounded border border-gray-200 max-w-md space-y-2 text-sm">
          <p><span className="font-semibold">Name:</span> {user?.name || 'Guest User'}</p>
          <p><span className="font-semibold">Email:</span> {user?.email || 'guest@example.com'}</p>
        </div>
      )}

      {subTab === 'order' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Order History ({orders.length})</h2>
          {orders.length === 0 ? (
            <div className="p-8 text-center bg-white rounded border border-gray-200 text-gray-400 text-sm">
              No orders found yet.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between text-xs text-gray-500 border-b pb-3">
                  <span>Order ID: <strong className="text-black">{order.id}</strong></span>
                  <span>Date: {new Date(order.createdAt).toLocaleDateString()}</span>
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded font-semibold">{order.status}</span>
                </div>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-3">
                        <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-cover rounded bg-gray-100" />
                        <div>
                          <p className="text-xs text-gray-400 uppercase">{item.brand}</p>
                          <p className="font-medium">{item.name} x {item.quantity}</p>
                        </div>
                      </div>
                      <span className="font-bold">{formatPrice(item.priceMYR * item.quantity, selectedCurrency)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex justify-between font-bold text-sm">
                  <span>Total Paid:</span>
                  <span>{formatPrice(order.totalPriceMYR, selectedCurrency)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
