import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../config/currencies';
import { orderService } from '../services/orderService'; // 引入统一的服务

interface CheckoutPageProps {
  selectedCurrency: string;
  onOrderComplete: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ selectedCurrency, onOrderComplete }) => {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [address, setAddress] = useState(user?.address || 'Malaysia');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPrice = items.reduce((sum, i) => sum + i.priceMYR * i.quantity, 0);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 1. 核心：通过 orderService 将当前购物车商品存入 localStorage
      orderService.createOrder({
        userId: user?.id || 'guest_user',
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          brand: item.brand,
          priceMYR: item.priceMYR,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
        })),
        totalPriceMYR: totalPrice,
        shippingAddress: address || 'Malaysia',
      });

      // 2. 清空购物车
      clearCart();

      // 3. 触发路由跳转到 My Order 页面
      onOrderComplete();
    } catch (err) {
      console.error('Checkout error:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-light mb-8">Checkout</h1>
      <form onSubmit={handleCheckoutSubmit} className="space-y-6 bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Address</label>
          <textarea
            required
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black"
          />
        </div>

        <div className="border-t pt-4 space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Order Items</div>
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-sm text-gray-700 py-1">
              <span>{item.name} x {item.quantity}</span>
              <span className="font-medium">{formatPrice(item.priceMYR * item.quantity, selectedCurrency)}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 flex justify-between items-center font-bold text-lg">
          <span>Total Amount:</span>
          <span>{formatPrice(totalPrice, selectedCurrency)}</span>
        </div>

        {/* 即使这里的文字叫 Confirm and pay，只要绑定了 handleCheckoutSubmit 就能成功保存订单 */}
        <button
          type="submit"
          disabled={isSubmitting || items.length === 0}
          className="w-full py-4 bg-black text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? 'Processing...' : 'Confirm and pay'}
        </button>
      </form>
    </div>
  );
};

export default CheckoutPage;
