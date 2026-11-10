import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/orderService';
import { formatPrice } from '../config/currencies';

interface CheckoutPageProps {
  selectedCurrency: string;
  onOrderComplete: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ selectedCurrency, onOrderComplete }) => {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const [address, setAddress] = useState(user?.address || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPrice = items.reduce((sum, i) => sum + i.priceMYR * i.quantity, 0);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 即使未登录也生成一个访客或默认用户的订单ID，确保记录百分百创建成功
      const currentUserId = user?.id || 'guest_user';

      const newOrder = orderService.createOrder({
        userId: currentUserId,
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          brand: item.brand,
          priceMYR: item.priceMYR,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          category: 'Handbags'
        })),
        totalPriceMYR: totalPrice,
        shippingAddress: address || 'Default Address',
      });

      console.log('Order created successfully:', newOrder);

      // 清空购物车
      clearCart();

      // 执行跳转回调（切到 Account > My Order）
      onOrderComplete();
    } catch (error) {
      console.error('Failed to create order:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-light mb-8">Checkout</h1>
      <form onSubmit={handleCreateOrder} className="space-y-6 bg-white p-8 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Address</label>
          <textarea
            required
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter your complete delivery address..."
            className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black"
          />
        </div>

        {/* 订单商品汇总 */}
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

        {/* 核心修改：按钮文字明确为 Create Order */}
        <button
          type="submit"
          disabled={isSubmitting || items.length === 0}
          className="w-full py-4 bg-black text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-gray-800 transition-all shadow-md disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? 'Processing...' : 'Create Order'}
        </button>
      </form>
    </div>
  );
};
