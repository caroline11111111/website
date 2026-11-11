import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {useAuth} from './AuthContext';
import {supabase} from '../lib/supabase';
export interface CartItem{id:string;productId:string;variantId?:string|null;name:string;brand:string;priceMYR:number;imageUrl:string;quantity:number;}
interface CartContextType{items:CartItem[];addToCart:(item:Omit<CartItem,'quantity'>)=>Promise<void>;removeFromCart:(id:string)=>Promise<void>;clearCart:()=>Promise<void>;totalItemsCount:number;loading:boolean;}
const CartContext=createContext<CartContextType|undefined>(undefined);
export const CartProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const{user}=useAuth();const[items,setItems]=useState<CartItem[]>([]);const[cartId,setCartId]=useState<string|null>(null);const[loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{
  if(!user){setItems([]);setCartId(null);return;}
  setLoading(true);
  try{
   const{data:id,error:idError}=await supabase.rpc('get_or_create_my_cart');
   if(idError)throw idError;setCartId(id as string);
   const{data,error}=await supabase.from('cart_items').select('id,product_id,variant_id,quantity,products(name,price_myr,brands(name),product_images(storage_path,display_order,is_primary)),product_variants(variant_name,variant_value,price_myr)').eq('cart_id',id);
   if(error)throw error;
   const mapped=(data||[]).map((row:any)=>{
    const product=row.products||{};const variant=row.product_variants;
    const pics=product.product_images||[];const primary=pics.find((p:any)=>p.is_primary)||pics.sort((a:any,b:any)=>a.display_order-b.display_order)[0];
    const path=primary?.storage_path;
    const image=path?supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl:'';
    return{id:row.id,productId:row.product_id,variantId:row.variant_id,name:product.name+(variant?' · '+variant.variant_name+': '+variant.variant_value:''),brand:product.brands?.name||'',priceMYR:Number(variant?.price_myr??product.price_myr??0),imageUrl:image,quantity:row.quantity};
   });
   setItems(mapped);
  }catch(error){console.error('Cart load failed',error);setItems([]);}
  finally{setLoading(false);}
 },[user]);
 useEffect(()=>{void refresh();},[refresh]);
 const addToCart=async(item:Omit<CartItem,'quantity'>)=>{
  if(!user)throw new Error('Please sign in before adding items to your bag.');
  let id=cartId;
  if(!id){const{data,error}=await supabase.rpc('get_or_create_my_cart');if(error)throw error;id=data as string;setCartId(id);}
  let query=supabase.from('cart_items').select('id,quantity').eq('cart_id',id).eq('product_id',item.productId);
  query=item.variantId?query.eq('variant_id',item.variantId):query.is('variant_id',null);
  const{data:existing,error:findError}=await query.maybeSingle();if(findError)throw findError;
  if(existing){const{error}=await supabase.from('cart_items').update({quantity:existing.quantity+1}).eq('id',existing.id);if(error)throw error;}
  else{const{error}=await supabase.from('cart_items').insert({cart_id:id,product_id:item.productId,variant_id:item.variantId||null,quantity:1});if(error)throw error;}
  await refresh();
 };
 const removeFromCart=async(id:string)=>{const{error}=await supabase.from('cart_items').delete().eq('id',id);if(error)throw error;await refresh();};
 const clearCart=async()=>{if(!cartId)return;const{error}=await supabase.from('cart_items').delete().eq('cart_id',cartId);if(error)throw error;await refresh();};
 const totalItemsCount=useMemo(()=>items.reduce((sum,item)=>sum+item.quantity,0),[items]);
 return <CartContext.Provider value={{items,addToCart,removeFromCart,clearCart,totalItemsCount,loading}}>{children}</CartContext.Provider>;
};
export const useCart=()=>{const context=useContext(CartContext);if(!context)throw new Error('useCart must be used within a CartProvider');return context;};
