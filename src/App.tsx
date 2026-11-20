import React,{useEffect,useState} from 'react';
import {supabase} from './lib/supabase';
import {useTheme,themeToCssVars} from './context/ThemeContext';
import {useCart} from './context/CartContext';
import {useAuth} from './context/AuthContext';
import {Product} from './config/products';
import {useCurrency} from './context/CurrencyContext';
import {useLanguage} from './context/LanguageContext';
import {Banner} from './components/Banner';
import {AboutPage} from './components/AboutPage';
import {Footer} from './components/Footer';
import {Slideshow} from './components/Slideshow';
import {ShopPage} from './components/ShopPage';
import {ProductDetailPage} from './components/ProductDetailPage';
import {BagPage} from './components/BagPage';
import {CheckoutPage} from './components/CheckoutPage';
import {AccountPage} from './components/AccountPage';
import {MyOrderPage} from './components/MyOrderPage';
import {LoginPage} from './components/LoginPage';
import {RegisterPage} from './components/RegisterPage';
import {WhatsAppButton} from './components/WhatsAppButton';
export function App(){
 const{currencies,defaultCurrency}=useCurrency(); const{language}=useLanguage(); const zh=language==='zh';
 const{currentTheme}=useTheme();
 const[branding,setBranding]=useState({logo_path:null as string|null,home_label:'Home',shop_label:'Shop',about_label:'About',account_label:'Account',nav_font_family:'inherit'});
 const[homeSectionContent,setHomeSectionContent]=useState({heading:'FEATURED HIGHLIGHTS',description:'Discover our finest curated selections',button_text:'Explore Shop'});
 useEffect(()=>{let alive=true;supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_branding_settings').maybeSingle().then(({data,error})=>{if(!alive||error||!data?.setting_value)return;const raw=data.setting_value as Partial<typeof branding>;setBranding(current=>({...current,...raw}));});return()=>{alive=false;};},[]);
 useEffect(()=>{
  let alive=true;
  const loadHomepageSectionContent=async()=>{
   const{data,error}=await supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_homepage_section_content').maybeSingle();
   if(!alive||error||!data?.setting_value)return;
   const raw=data.setting_value as Partial<typeof homeSectionContent>;
   setHomeSectionContent(current=>({...current,...raw}));
  };
  void loadHomepageSectionContent();
  const channel=supabase.channel('storefront-homepage-section-content')
   .on('postgres_changes',{event:'*',schema:'public',table:'site_settings',filter:'setting_key=eq.storefront_homepage_section_content'},()=>{void loadHomepageSectionContent();})
   .subscribe();
  const refreshOnReturn=()=>{if(document.visibilityState==='visible')void loadHomepageSectionContent();};
  window.addEventListener('focus',refreshOnReturn);
  document.addEventListener('visibilitychange',refreshOnReturn);
  const refreshInterval=window.setInterval(()=>{if(document.visibilityState==='visible')void loadHomepageSectionContent();},30000);
  return()=>{alive=false;window.clearInterval(refreshInterval);window.removeEventListener('focus',refreshOnReturn);document.removeEventListener('visibilitychange',refreshOnReturn);void supabase.removeChannel(channel);};
 },[]);
 const logoUrl=branding.logo_path?supabase.storage.from('homepage-media').getPublicUrl(branding.logo_path).data.publicUrl:'';
 const[currentTab,setCurrentTab]=useState('home');const[loginReturnTab,setLoginReturnTab]=useState('home');const openLogin=(returnTo:string=currentTab)=>{setLoginReturnTab(returnTo);setCurrentTab('login');};const[selectedCurrency,setSelectedCurrency]=useState(defaultCurrency);
 useEffect(()=>{setSelectedCurrency(defaultCurrency);},[defaultCurrency]);const[selectedProduct,setSelectedProduct]=useState<Product|null>(null);const[accountSubTab,setAccountSubTab]=useState('profile');const[selectedCartItemIds,setSelectedCartItemIds]=useState<string[]>([]);
 const{items}=useCart();const{user,loading}=useAuth();const totalCartCount=items.reduce((sum,i)=>sum+i.quantity,0);
 const handleSelectProduct=(product:Product)=>{setSelectedProduct(product);setCurrentTab('productDetail');window.scrollTo({top:0,behavior:'smooth'});};
 if(loading)return <div className="min-h-screen grid place-items-center">Loading…</div>;
 return <div className="min-h-screen flex flex-col font-sans" style={{...themeToCssVars(currentTheme),backgroundColor:"var(--theme-background)",color:"var(--theme-text-primary)"}}>
 <header className="sticky top-0 z-50 backdrop-blur-md border-b" style={{backgroundColor:"var(--theme-surface)",borderColor:"var(--theme-border)"}}><div className="max-w-7xl mx-auto px-4 md:px-6"><div className="min-h-16 flex items-center justify-between gap-3"><div className="flex items-center gap-4 md:gap-8 min-w-0"><button onClick={()=>setCurrentTab('home')} className="shrink-0 text-lg font-light tracking-widest uppercase">{logoUrl?<img src={logoUrl} alt="Store logo" className="max-h-10 max-w-36 object-contain"/>:'Online Store'}</button><nav className="hidden md:flex space-x-6 text-xs uppercase tracking-wider" style={{fontFamily:branding.nav_font_family||"inherit"}}><button onClick={()=>setCurrentTab('home')}>{zh&&branding.home_label==='Home'?'首页':branding.home_label}</button><button onClick={()=>setCurrentTab('shop')}>{zh&&branding.shop_label==='Shop'?'商店':branding.shop_label}</button><button onClick={()=>setCurrentTab('about')}>{zh&&branding.about_label==='About'?'关于我们':branding.about_label}</button></nav></div><div className="flex items-center gap-3 md:gap-5 shrink-0"><select value={selectedCurrency} onChange={e=>setSelectedCurrency(e.target.value)} className="bg-transparent text-xs border rounded px-2 py-1">{currencies.filter(c=>c.isActive).map(c=><option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}</select><button onClick={()=>user?setCurrentTab('bag'):openLogin('bag')} className="text-xs uppercase">{zh?'购物袋':'Bag'} {user&&totalCartCount>0?'('+totalCartCount+')':''}</button><button onClick={()=>user?setCurrentTab('account'):openLogin('account')} className="text-xs uppercase">{zh&&branding.account_label==='Account'?'账户':branding.account_label}</button></div></div><nav className="md:hidden flex justify-center gap-8 pb-3 text-xs uppercase tracking-wider" style={{fontFamily:branding.nav_font_family||"inherit"}}><button onClick={()=>setCurrentTab('home')}>{zh&&branding.home_label==='Home'?'首页':branding.home_label}</button><button onClick={()=>setCurrentTab('shop')}>{zh&&branding.shop_label==='Shop'?'商店':branding.shop_label}</button><button onClick={()=>setCurrentTab('about')}>{zh&&branding.about_label==='About'?'关于我们':branding.about_label}</button></nav></div></header>
 <main className="flex-grow">
 {currentTab==='home'&&<div className="space-y-12 pb-16"><Banner/><div className="text-center space-y-2"><h2 className="text-2xl font-light">{homeSectionContent.heading}</h2>{homeSectionContent.description&&<p className="text-xs text-gray-500 uppercase tracking-widest">{homeSectionContent.description}</p>}</div><Slideshow/><div className="text-center"><button onClick={()=>setCurrentTab('shop')} className="px-8 py-3 bg-black text-white rounded-full">{homeSectionContent.button_text}</button></div></div>}
 {currentTab==='about'&&<AboutPage/>}
 {currentTab==='shop'&&<ShopPage selectedCurrency={selectedCurrency} onSelectProduct={handleSelectProduct}/>}
 {currentTab==='productDetail'&&selectedProduct&&<ProductDetailPage product={selectedProduct} selectedCurrency={selectedCurrency} onBack={()=>setCurrentTab('shop')} onGoBag={()=>user?setCurrentTab('bag'):openLogin('bag')} onLogin={()=>openLogin('productDetail')}/>}
 {currentTab==='bag'&&<BagPage selectedCurrency={selectedCurrency} onGoShop={()=>setCurrentTab('shop')} onGoCheckout={(ids)=>{setSelectedCartItemIds(ids);user?setCurrentTab('checkout'):openLogin('checkout');}}/>}
 {currentTab==='checkout'&&<CheckoutPage selectedCurrency={selectedCurrency} selectedItemIds={selectedCartItemIds} onOrderComplete={()=>setCurrentTab('myOrder')}/>}
 {currentTab==='account'&&<AccountPage initialSubTab={accountSubTab} selectedCurrency={selectedCurrency} onGoOrders={()=>setCurrentTab('myOrder')}/>}
 {currentTab==='myOrder'&&<MyOrderPage selectedCurrency={selectedCurrency}/>}
 {currentTab==='login'&&<LoginPage onLoginSuccess={()=>setCurrentTab(loginReturnTab)} onNavigateRegister={()=>setCurrentTab('signup')}/>}
 {currentTab==='signup'&&<RegisterPage onRegisterSuccess={()=>setCurrentTab(loginReturnTab)} onNavigateLogin={()=>setCurrentTab('login')}/>}
 </main><Footer selectedCurrency={selectedCurrency} onCurrencyChange={setSelectedCurrency}/><WhatsAppButton/></div>;
}
export default App;