import React,{useEffect,useMemo,useState} from 'react';
import {Product} from '../config/products';
import {useCurrency} from '../context/CurrencyContext';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';
interface ShopPageProps{selectedCurrency:string;onSelectProduct:(product:Product)=>void;}
export const ShopPage:React.FC<ShopPageProps>=({selectedCurrency,onSelectProduct})=>{
 const{formatPrice}=useCurrency();
 const[products,setProducts]=useState<Product[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 const[selectedCategory,setSelectedCategory]=useState('All');const[selectedBrand,setSelectedBrand]=useState('All');const[currentPage,setCurrentPage]=useState(1);const pageSize=12;
 useEffect(()=>{let alive=true;(async()=>{setLoading(true);setError('');
  const{data,error}=await supabase.from('products').select('id,name,description,price_myr,condition,color,sku,specifications,brands(name),legacy_category:categories!products_category_id_fkey(name),product_categories(category:categories!product_categories_category_id_fkey(id,name,slug)),product_images(id,storage_path,alt_text,display_order,is_primary)').eq('is_published',true).eq('is_archived',false).order('created_at',{ascending:false});
  if(!alive)return;if(error){setError(error.message);setProducts([]);}else{
   const mapped=(data||[]).map((p:any)=>({id:p.id,name:p.name,brand:p.brands?.name||'',category:((p.product_categories||[]).map((link:any)=>link.category?.name).filter(Boolean)[0]||p.legacy_category?.name||'Other'),categories:Array.from(new Set([...(p.product_categories||[]).map((link:any)=>link.category?.name).filter(Boolean),p.legacy_category?.name].filter(Boolean))),condition:p.condition||'',color:p.color||'',sku:p.sku||'',specifications:p.specifications||{},priceMYR:Number(p.price_myr),description:p.description||'',images:(p.product_images||[]).sort((a:any,b:any)=>Number(b.is_primary)-Number(a.is_primary)||a.display_order-b.display_order).map((img:any)=>({id:img.id,url:supabase.storage.from('product-images').getPublicUrl(img.storage_path).data.publicUrl,alt:{en:img.alt_text||p.name,zh:img.alt_text||p.name},order:img.display_order}))}));
   setProducts(mapped);
  }setLoading(false);
 })();return()=>{alive=false;};},[]);
 const categories=useMemo(()=>['All',...Array.from(new Set(products.flatMap(p=>p.categories?.length?p.categories:[p.category]).filter(Boolean))).sort()], [products]);
 const brands=useMemo(()=>['All',...Array.from(new Set(products.map(p=>p.brand).filter(Boolean))).sort()], [products]);
 const filtered=products.filter(p=>(selectedCategory==='All'||(p.categories?.length?p.categories:[p.category]).includes(selectedCategory))&&(selectedBrand==='All'||p.brand===selectedBrand));
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));const current=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
 return <div className="w-full max-w-7xl mx-auto px-6 py-12 space-y-8"><h1 className="text-3xl font-light">Shop Collection</h1>
 <div className="flex flex-wrap gap-3 border-b pb-5"><label className="text-sm">Category <select value={selectedCategory} onChange={e=>{setSelectedCategory(e.target.value);setCurrentPage(1);}} className="ml-2 border rounded p-2">{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="text-sm">Brand <select value={selectedBrand} onChange={e=>{setSelectedBrand(e.target.value);setCurrentPage(1);}} className="ml-2 border rounded p-2">{brands.map(b=><option key={b}>{b}</option>)}</select></label></div>
 {loading?<p className="py-16 text-center text-sm text-gray-500">Loading products…</p>:error?<p role="alert" className="py-12 text-center text-sm text-red-600">Unable to load products: {error}</p>:current.length===0?<p className="py-16 text-center text-sm text-gray-500">No products are available yet.</p>:<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{current.map(p=><button type="button" key={p.id} onClick={()=>onSelectProduct(p)} className="text-left bg-white rounded-lg overflow-hidden border shadow-sm hover:shadow-md flex flex-col"><div className="h-64 bg-gray-100 overflow-hidden">{p.images[0]&&<SiteImage src={p.images[0].url} alt={p.name} className="w-full h-full object-cover"/>}</div><div className="p-4 space-y-2"><span className="text-[10px] text-gray-400 uppercase">{p.brand}</span><h3 className="text-sm font-semibold">{p.name}</h3><p className="text-sm font-bold">{formatPrice(p.priceMYR,selectedCurrency)}</p></div></button>)}</div>}
 {!loading&&!error&&pages>1&&<div className="flex justify-center gap-2">{Array.from({length:pages},(_,i)=>i+1).map(n=><button key={n} onClick={()=>setCurrentPage(n)} className={'w-9 h-9 rounded-full '+(n===currentPage?'bg-black text-white':'bg-gray-100')}>{n}</button>)}</div>}
 </div>;
};
