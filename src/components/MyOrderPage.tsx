import React, { useState, useEffect } from 'react';
import { orderService, Order } from '../services/orderService';
import { formatPrice } from '../config/currencies';
import { SiteImage } from './SiteImage';

interface MyOrderPageProps {
  selectedCurrency: string;
}

export const MyOrderPage: React.FC<MyOrderPageProps> = ({ selectedCurrency }) => {
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = () => {
    // 从 localStorage 强制读取真实订单，没有任何写死的范例数据
    const rawData = localStorage.getItem('ccc_orders_list');
    const parsed: Order[] = rawData ? JSON.parse(rawData) : [];
    setOrders(parsed);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div className="flex justify-between items-center border-b pb-6">
        <h1 className="text-3xl font-light">My Orders</h1>
        <button 
          onClick={loadOrders}
          className="text-xs uppercase tracking-wider text-black underline font-semibold cursor-pointer"
        >
          Refresh Orders
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200 text-gray-400 text-sm shadow-sm">
          No orders found yet. Complete a checkout to see your orders here.
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-wrap justify-between items-center text-xs text-gray-500 border-b pb-3">
                <span>Order ID: <strong className="text-black">{order.id}</strong></span>
                <span>Date: {new Date(order.createdAt).toLocaleDateString()}</span>
                <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded font-semibold uppercase">{order.status}</span>
              </div>

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
                <span>Total Amount:</span>
                <span className="text-base">{formatPrice(order.totalPriceMYR, selectedCurrency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOrderPage;
