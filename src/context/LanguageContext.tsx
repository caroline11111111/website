import React, { createContext, useContext, useState } from 'react';

// 1. 定义语言配置接口与字典
export interface Translations {
  bag: string;
  emptyBag: string;
  shopButton: string;
  selectAll: string;
  remove: string;
  checkout: string;
  confirmAndPay: string;
  createOrder: string;
  orderCreated: string;
  myOrders: string;
  totalAmount: string;
  shippingAddress: string;
  orderSuccessMsg: string;
}

const translations: Record<string, Translations> = {
  en: {
    bag: 'Shopping Bag',
    emptyBag: 'Your shopping bag is empty',
    shopButton: 'Continue Shopping',
    selectAll: 'Select All',
    remove: 'Remove',
    checkout: 'Proceed to Checkout',
    confirmAndPay: 'Create Order', // 👈 核心修改：强制替换 Confirm and Pay 属性
    createOrder: 'Create Order',
    orderCreated: 'Order Created Successfully',
    myOrders: 'My Orders',
    totalAmount: 'Total Amount',
    shippingAddress: 'Shipping Address',
    orderSuccessMsg: 'Your order has been placed and recorded in My Orders.',
  },
  zh: {
    bag: '购物袋',
    emptyBag: '您的购物袋暂无商品',
    shopButton: '继续购物',
    selectAll: '全选',
    remove: '删除',
    checkout: '前往结算',
    confirmAndPay: '创建订单',
    createOrder: '创建订单',
    orderCreated: '订单创建成功',
    myOrders: '我的订单',
    totalAmount: '总计金额',
    shippingAddress: '收货地址',
    orderSuccessMsg: '您的订单已成功提交并记录于“我的订单”中。',
  },
};

interface LanguageContextType {
  language: string;
  t: Translations;
  setLanguage: (lang: string) => void;
}

// 2. 创建 Context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 3. Provider 组件
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<string>('en');

  const value = {
    language,
    t: translations[language] || translations.en,
    setLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// 4. 自定义 Hook 供各个页面组件调用
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
