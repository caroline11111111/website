import React,{useEffect,useState} from 'react';
import {useCart} from '../context/CartContext';
import {useCurrency} from '../context/CurrencyContext';
import {SiteImage} from './SiteImage';
interface BagPageProps{selectedCurrency:string;onGoCheckout:(selectedIds:string[])=>void;onGoShop:()=>void;}
export const BagPage:React.FC<BagPageProps>=({selectedCurrency,onGoCheckout,onGoShop})=>{
 const{formatPrice}=useCurrency();const{items,removeFromCart,clearCart,loading}=useCart();const[selectedIds,setSelectedIds]=useState<string[]>([]);
 useEffect(()=>{setSelectedIds(items.map(i=>i.id));},[items]);
 const toggle=(id:string)=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 const total=items.filter(i=>selectedIds.includes(i.id)).reduce((sum,i)=>sum+i.priceMYR*i.quantity,0);
 if(loading)return <div className="py-20 text-center">Loading your bag…</div>;
 if(!items.length)return <div className="max-w-4xl mx-auto px-6 py-20 text-center space-y-6"><h1 className="text-3xl font-light">Shopping Bag</h1><p className="text-gray-500 text-sm">Your shopping bag is currently empty.</p><button onClick={onGoShop} className="px-8 py-3 bg-black text-white rounded-full">Continue Shopping</button></div>;
 return <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-8"><h1 className="text-3xl font-light">Shopping Bag ({items.length})</h1>
 <div className="flex justify-between border-b pb-4 text-sm"><label className="flex gap-2 items-center"><input type="checkbox" checked={selectedIds.length===items.length} onChange={()=>setSelectedIds(selectedIds.length===items.length?[]:items.map(i=>i.id))}/>Select All</label><button onClick={()=>void clearCart()} className="text-red-600 text-xs">Clear Bag</button></div>
 <div className="space-y-4">{items.map(item=><div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-lg border"><div className="flex items-center gap-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={()=>toggle(item.id)}/><div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">{item.imageUrl&&<SiteImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover"/>}</div><div><span className="text-xs text-gray-400 uppercase">{item.brand}</span><h3 className="text-sm font-semibold">{item.name}</h3><p className="text-xs text-gray-500">Qty: {item.quantity}</p></div></div><div className="flex items-center gap-6"><span className="text-sm font-bold">{formatPrice(item.priceMYR*item.quantity,selectedCurrency)}</span><button onClick={()=>void removeFromCart(item.id)} className="text-xs text-red-500">Remove</button></div></div>)}</div>
 <div className="bg-gray-50 p-6 rounded-lg border flex flex-col md:flex-row items-center justify-between gap-4"><div className="text-lg font-semibold">Selected total: <span className="font-bold">{formatPrice(total,selectedCurrency)}</span></div><button onClick={()=>onGoCheckout(selectedIds)} disabled={!selectedIds.length} className="px-10 py-3.5 bg-black text-white rounded-full disabled:opacity-50">Proceed to Checkout</button></div>
 </div>;
};
export default BagPage;