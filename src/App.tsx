import React,{useState} from 'react';
import {useCart} from './context/CartContext';
import {useAuth} from './context/AuthContext';
import {Product} from './config/products';
import {currencies} from './config/currencies';
import {Banner} from './components/Banner';
import {AboutPage} from './components/AboutPage';
import {Slideshow} from './components/Slideshow';
import {ShopPage} from './components/ShopPage';
import {ProductDetailPage} from './components/ProductDetailPage';
import {BagPage} from './components/BagPage';
import {CheckoutPage} from './components/CheckoutPage';
import {AccountPage} from './components/AccountPage';
import {MyOrderPage} from './components/MyOrderPage';
import {LoginPage} from './components/LoginPage';
import {RegisterPage} from './components/RegisterPage';
export function App(){
 const[currentTab,setCurrentTab]=useState('home');const[selectedCurrency,setSelectedCurrency]=useState('MYR');const[selectedProduct,setSelectedProduct]=useState<Product|null>(null);const[accountSubTab,setAccountSubTab]=useState('profile');const[selectedCartItemIds,setSelectedCartItemIds]=useState<string[]>([]);
 const{items}=useCart();const{user,loading}=useAuth();const totalCartCount=items.reduce((sum,i)=>sum+i.quantity,0);
 const handleSelectProduct=(product:Product)=>{setSelectedProduct(product);setCurrentTab('productDetail');window.scrollTo({top:0,behavior:'smooth'});};
 if(loading)return <div className="min-h-screen grid place-items-center">Loading…</div>;
 return <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] flex flex-col font-sans">
 <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b"><div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between"><div className="flex items-center space-x-8"><button onClick={()=>setCurrentTab('home')} className="text-lg font-light tracking-widest uppercase">Online Store</button><nav className="hidden md:flex space-x-6 text-xs uppercase tracking-wider"><button onClick={()=>setCurrentTab('home')}>Home</button><button onClick={()=>setCurrentTab('shop')}>Shop</button><button onClick={()=>setCurrentTab('about')}>About</button></nav></div><div className="flex items-center space-x-5"><select value={selectedCurrency} onChange={e=>setSelectedCurrency(e.target.value)} className="bg-transparent text-xs border rounded px-2 py-1">{currencies.map(c=><option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}</select><button onClick={()=>setCurrentTab(user?'bag':'login')} className="text-xs uppercase">Bag {user&&totalCartCount>0?'('+totalCartCount+')':''}</button><button onClick={()=>setCurrentTab(user?'account':'login')} className="text-xs uppercase">{user?'Account':'Login / Register'}</button></div></div></header>
 <main className="flex-grow">
 {currentTab==='home'&&<div className="space-y-12 pb-16"><Banner/><div className="text-center"><h2 className="text-2xl font-light">FEATURED HIGHLIGHTS</h2></div><Slideshow/><div className="text-center"><button onClick={()=>setCurrentTab('shop')} className="px-8 py-3 bg-black text-white rounded-full">Explore Shop</button></div></div>}
 {currentTab==='about'&&<AboutPage/>}
 {currentTab==='shop'&&<ShopPage selectedCurrency={selectedCurrency} onSelectProduct={handleSelectProduct}/>}
 {currentTab==='productDetail'&&selectedProduct&&<ProductDetailPage product={selectedProduct} selectedCurrency={selectedCurrency} onBack={()=>setCurrentTab('shop')} onGoBag={()=>setCurrentTab(user?'bag':'login')} onLogin={()=>setCurrentTab('login')}/>}
 {currentTab==='bag'&&<BagPage selectedCurrency={selectedCurrency} onGoShop={()=>setCurrentTab('shop')} onGoCheckout={(ids)=>{setSelectedCartItemIds(ids);setCurrentTab(user?'checkout':'login');}}/>}
 {currentTab==='checkout'&&<CheckoutPage selectedCurrency={selectedCurrency} selectedItemIds={selectedCartItemIds} onOrderComplete={()=>setCurrentTab('myOrder')}/>}
 {currentTab==='account'&&<AccountPage initialSubTab={accountSubTab} selectedCurrency={selectedCurrency}/>}
 {currentTab==='myOrder'&&<MyOrderPage selectedCurrency={selectedCurrency}/>}
 {currentTab==='login'&&<LoginPage onLoginSuccess={()=>setCurrentTab('account')} onNavigateRegister={()=>setCurrentTab('signup')}/>}
 {currentTab==='signup'&&<RegisterPage onRegisterSuccess={()=>setCurrentTab('account')} onNavigateLogin={()=>setCurrentTab('login')}/>}
 </main><footer className="bg-white border-t py-8 text-center text-xs text-gray-500">© {new Date().getFullYear()} Online Store. All Rights Reserved.</footer></div>;
}
export default App;