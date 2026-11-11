import React, { createContext, useContext, useState } from 'react';

// 使用 Record<string, string> 允许任意字段，彻底消除所有 TS2339 属性缺失报错
export type Translations = Record<string, string>;

const translations: Record<string, Translations> = {
  en: {
    bag: 'Shopping Bag',
    emptyBag: 'Your shopping bag is empty',
    shopButton: 'Continue Shopping',
    selectAll: 'Select All',
    remove: 'Remove',
    checkout: 'Proceed to Checkout',
    confirmAndPay: 'Create Order',
    createOrder: 'Create Order',
    orderCreated: 'Order Created Successfully',
    myOrders: 'My Orders',
    totalAmount: 'Total Amount',
    shippingAddress: 'Shipping Address',
    orderSuccessMsg: 'Your order has been placed and recorded in My Orders.',
    home: 'Home',
    shop: 'Shop',
    about: 'About',
    account: 'Account',
    loginBtn: 'Log In',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    forgotPasswordNotice: 'Forgot your password?',
    forgotPasswordLink: 'Reset Password',
    signUpForFreeLink: 'Sign Up',
    registrationFailed: 'Registration failed. Please try again.',
    emailAlreadyRegistered: 'Email already registered',
    signUpTitle: 'Create Account',
    fullNameLabel: 'Full Name',
    phoneLabel: 'Phone Number',
    addressLabel: 'Address',
    signUpBtn: 'Sign Up',
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
    home: '首页',
    shop: '商店',
    about: '关于',
    account: '账户',
    loginBtn: '登录',
    emailLabel: '电子邮箱',
    passwordLabel: '密码',
    forgotPasswordNotice: '忘记密码？',
    forgotPasswordLink: '重置密码',
    signUpForFreeLink: '立即注册',
    registrationFailed: '注册失败，请重试。',
    emailAlreadyRegistered: '该邮箱已被注册',
    signUpTitle: '创建账户',
    fullNameLabel: '全名',
    phoneLabel: '电话号码',
    addressLabel: '地址',
    signUpBtn: '注册',
  },
};

interface LanguageContextType {
  language: string;
  t: Translations;
  setLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
