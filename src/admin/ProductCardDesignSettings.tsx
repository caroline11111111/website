import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

export type ProductCardDesign={
 style:'classic'|'editorial'|'minimal'|'luxury';
 imageRatio:'1:1'|'4:5'|'3:2';
 imageFit:'cover'|'contain';
 textAlignment:'left'|'center';
 showBrand:boolean;
 showCondition:boolean;
};
export const DEFAULT_PRODUCT_CARD_DESIGN:ProductCardDesign={style:'classic',imageRatio:'1:1',imageFit:'cover',textAlignment:'left',showBrand:true,showCondition:true};
const presets:Array<{key:ProductCardDesign['style'];name:string;description:string}>=[
 {key:'classic',name:'Classic',description:'Clean product card with a subtle border and soft shadow'},
 {key:'editorial',name:'Editorial',description:'Minimal luxury catalogue with centered product details'},
 {key:'minimal',name:'Minimal',description:'Borderless layout with generous, simple presentation'},
 {key:'luxury',name:'Luxury Frame',description:'Rounded card with a refined frame and deeper shadow'}
];
const ratioValue=(ratio:ProductCardDesign['imageRatio'])=>ratio==='4:5'?'4 / 5':ratio==='3:2'?'3 / 2':'1 / 1';
const cardClasses=(style:ProductCardDesign['style'])=>({
 classic:'border border-gray-200 rounded-lg shadow-sm hover:shadow-md',
 editorial:'border-0 rounded-none shadow-none hover:shadow-none',
 minimal:'border-0 rounded-none shadow-none hover:shadow-none',
 luxury:'border border-stone-200 rounded-2xl shadow-md hover:shadow-lg'
}[style]);
function PreviewCard({design}:{design:ProductCardDesign}){
 return <div className={'overflow-hidden bg-white flex flex-col transition-shadow '+cardClasses(design.style)}>
  <div className="w-full overflow-hidden bg-stone-100" style={{aspectRatio:ratioValue(design.imageRatio)}}>
   <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300"><div className="w-2/3 h-3/4 rounded-[30%_30%_12%_12%] border border-stone-400/50 bg-gradient-to-br from-stone-400 to-stone-600 shadow-xl flex items-center justify-center"><span className="text-white/70 text-3xl">✦</span></div></div>
  </div>
  <div className={'p-4 space-y-2 '+(design.textAlignment==='center'?'text-center':'text-left')}>
   {design.showBrand&&<p className="text-[10px] uppercase tracking-[.18em] text-stone-500">Brand name</p>}
   <p className="text-sm font-semibold text-stone-800">Classic Leather Handbag</p>
   {design.showCondition&&<p className="text-xs text-stone-500">Condition · Excellent</p>}
   <p className="text-sm font-semibold text-stone-900">RM 2,800.00</p>
  </div>
 </div>;
}
export const ProductCardDesignSettings:React.FC=()=>{
 const[design,setDesign]=useState<ProductCardDesign>(DEFAULT_PRODUCT_CARD_DESIGN);
 const[saving,setSaving]=useState(false);const[loading,setLoading]=useState(true);const[message,setMessage]=useState('');const[messageTone,setMessageTone]=useState<'success'|'error'>('success');
 useEffect(()=>{let alive=true;supabase.from('site_settings').select('setting_value').eq('setting_key','product_card_design').maybeSingle().then(({data,error})=>{if(!alive)return;if(error){setMessage(error.message);setMessageTone('error');}else if(data?.setting_value&&typeof data.setting_value==='object')setDesign({...DEFAULT_PRODUCT_CARD_DESIGN,...data.setting_value} as ProductCardDesign);setLoading(false);});return()=>{alive=false;};},[]);
 const update=(patch:Partial<ProductCardDesign>)=>setDesign(current=>({...current,...patch}));
 const save=async()=>{setSaving(true);setMessage('');const{error}=await supabase.from('site_settings').upsert({setting_key:'product_card_design',setting_value:design,updated_at:new Date().toISOString()},{onConflict:'setting_key'});if(error){setMessage(error.message);setMessageTone('error');}else{setMessage('Product card design saved successfully.');setMessageTone('success');}setSaving(false);};
 return <section className="mt-6 rounded-xl border bg-white p-5 space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-lg">Product Card Design</h3><p className="mt-1 text-sm text-slate-500">Choose how products are displayed in the storefront Shop page. Changes apply to all product cards.</p></div><button type="button" onClick={()=>setDesign(DEFAULT_PRODUCT_CARD_DESIGN)} className="rounded-lg border px-3 py-2 text-sm">Reset options</button></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{presets.map(preset=><button type="button" key={preset.key} onClick={()=>update({style:preset.key})} className={'rounded-xl border p-3 text-left '+(design.style===preset.key?'border-slate-900 bg-slate-50 ring-1 ring-slate-900':'hover:bg-slate-50')}><span className="block font-medium text-sm">{preset.name}</span><span className="mt-1 block text-xs text-slate-500">{preset.description}</span></button>)}</div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
   <label className="grid gap-1 text-sm">Image ratio<select value={design.imageRatio} onChange={e=>update({imageRatio:e.target.value as ProductCardDesign['imageRatio']})} className="rounded-lg border p-2"><option value="1:1">Square · 1:1</option><option value="4:5">Portrait · 4:5</option><option value="3:2">Landscape · 3:2</option></select></label>
   <label className="grid gap-1 text-sm">Image display<select value={design.imageFit} onChange={e=>update({imageFit:e.target.value as ProductCardDesign['imageFit']})} className="rounded-lg border p-2"><option value="cover">Fill frame · Cover</option><option value="contain">Show full image · Contain</option></select></label>
   <label className="grid gap-1 text-sm">Text alignment<select value={design.textAlignment} onChange={e=>update({textAlignment:e.target.value as ProductCardDesign['textAlignment']})} className="rounded-lg border p-2"><option value="left">Left</option><option value="center">Center</option></select></label>
   <div className="flex flex-col justify-center gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={design.showBrand} onChange={e=>update({showBrand:e.target.checked})}/>Show brand</label><label className="flex items-center gap-2"><input type="checkbox" checked={design.showCondition} onChange={e=>update({showCondition:e.target.checked})}/>Show condition</label></div>
  </div>
  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] items-start"><div><h4 className="text-sm font-medium mb-2">Live sample</h4><p className="text-xs text-slate-500 mb-3">This preview uses sample content. Your actual product photos, names and prices will appear on the storefront.</p><div className="max-w-xs"><PreviewCard design={design}/></div></div><div className="flex flex-col gap-2 md:pt-7"><button type="button" disabled={loading||saving} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-5 py-3 text-sm text-white disabled:opacity-50">{saving?'Saving…':'Save Product Card Design'}</button>{message&&<p role={messageTone==='error'?'alert':'status'} className={'rounded-lg border p-3 text-xs '+(messageTone==='success'?'border-green-200 bg-green-50 text-green-800':'border-red-200 bg-red-50 text-red-700')}>{message}</p>}</div></div>
 </section>;
};
