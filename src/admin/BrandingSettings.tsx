import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

type BrandingSettingsValue={logo_path:string|null;labels:{en:{home:string;shop:string;about:string;account:string};zh:{home:string;shop:string;about:string;account:string}};nav_font_family:string;};
const DEFAULT_VALUE:BrandingSettingsValue={logo_path:null,labels:{en:{home:'Home',shop:'Shop',about:'About',account:'Account'},zh:{home:'首页',shop:'商店',about:'关于我们',account:'账户'}},nav_font_family:'inherit'};
const normalize=(raw:any):BrandingSettingsValue=>({logo_path:raw?.logo_path||null,nav_font_family:raw?.nav_font_family||'inherit',labels:raw?.labels?{en:{...DEFAULT_VALUE.labels.en,...raw.labels.en},zh:{...DEFAULT_VALUE.labels.zh,...raw.labels.zh}}:{en:{home:raw?.home_label||'Home',shop:raw?.shop_label||'Shop',about:raw?.about_label||'About',account:raw?.account_label||'Account'},zh:{...DEFAULT_VALUE.labels.zh}}});

export const BrandingSettings:React.FC=()=>{
 const[value,setValue]=useState<BrandingSettingsValue>(DEFAULT_VALUE);
 const[locale,setLocale]=useState<'en'|'zh'>('en');
 const[file,setFile]=useState<File|null>(null);
 const[preview,setPreview]=useState('');
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState('');
 const[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_branding_settings').maybeSingle().then(({data,error:loadError})=>{
   if(!alive)return;
   if(loadError){setError(loadError.message);return;}
   const raw=data?.setting_value as any;
   if(raw)setValue(normalize(raw));
  });
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  if(!file){setPreview('');return;}
  const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);
 },[file]);
 const removeLogo=()=>{
  setFile(null);
  setValue(current=>({...current,logo_path:null}));
  setError('');
  setMessage('Logo removal selected. Click Save Branding Settings to apply it.');
 };
 const save=async()=>{
  if((['home','shop','about','account'] as const).some(key=>!value.labels.en[key].trim()||!value.labels.zh[key].trim())){
   setError('All four navigation labels are required in both languages.');return;
  }
  setBusy(true);setError('');setMessage('');
  let logoPath=value.logo_path;
  if(file){
   if(file.size>5242880||!['image/jpeg','image/png','image/webp'].includes(file.type)){
    setError('Logo must be JPG, PNG or WebP and no larger than 5MB.');setBusy(false);return;
   }
   const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
   const path='branding/'+crypto.randomUUID()+'.'+ext;
   const{error:uploadError}=await supabase.storage.from('homepage-media').upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError){setError(uploadError.message);setBusy(false);return;}
   logoPath=path;
  }
  const{data:userData}=await supabase.auth.getUser();
  const{error:saveError}=await supabase.from('site_settings').upsert({
   setting_key:'storefront_branding_settings',
   setting_value:{...value,logo_path:logoPath},
   updated_by:userData.user?.id||null,
   updated_at:new Date().toISOString()
  },{onConflict:'setting_key'});
  if(saveError){setError(saveError.message);setBusy(false);return;}
  setValue(current=>({...current,logo_path:logoPath}));setFile(null);setMessage(logoPath?'Logo and bilingual bilingual navigation labels saved.':'Logo removed and navigation labels saved.');
  setBusy(false);
 };
 const imageUrl=value.logo_path?supabase.storage.from('homepage-media').getPublicUrl(value.logo_path).data.publicUrl:'';
 const update=(key:'home'|'shop'|'about'|'account',next:string)=>setValue(current=>({...current,labels:{...current.labels,[locale]:{...current.labels[locale],[key]:next}}}));
 const updateFont=(next:string)=>setValue(current=>({...current,nav_font_family:next}));
 return <section className="max-w-3xl space-y-5">
  <div><h2 className="text-lg font-semibold">Logo & Navigation Labels</h2><p className="text-sm text-slate-500 mt-1">These labels are shared by desktop and mobile storefront navigation.</p></div>
  <div className="bg-white border rounded-xl p-5 space-y-4">
   <div><h3 className="font-medium">Store Logo</h3><p className="text-xs text-slate-500 mt-1">JPG, PNG or WebP · Maximum 5 MB.</p></div>
   <div className="flex flex-wrap items-center gap-4">{(preview||imageUrl)?<img src={preview||imageUrl} alt="Store logo preview" className="max-h-20 max-w-48 object-contain border rounded p-2"/>:<div className="h-20 w-48 border border-dashed rounded flex items-center justify-center text-xs text-slate-400">No logo uploaded</div>}
    <label className="text-sm underline cursor-pointer">Choose logo<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    {(value.logo_path||file)&&<button type="button" onClick={removeLogo} disabled={busy} className="text-sm text-red-600 underline disabled:opacity-50">Remove logo</button>}
   </div>
   <div className="border-t pt-4 space-y-3"><h3 className="font-medium">Navigation Labels</h3><div className="flex gap-2"><button type="button" onClick={()=>setLocale('en')} className={'rounded-lg border px-3 py-2 text-sm '+(locale==='en'?'bg-slate-900 text-white':'')}>English</button><button type="button" onClick={()=>setLocale('zh')} className={'rounded-lg border px-3 py-2 text-sm '+(locale==='zh'?'bg-slate-900 text-white':'')}>简体中文</button></div>
    {([['home','Home'],['shop','Shop'],['about','About'],['account','Account']] as const).map(([key,label])=><label key={key} className="grid gap-1 text-sm">{label}<input maxLength={32} value={value.labels[locale][key]} onChange={e=>update(key,e.target.value)} className="border rounded-lg p-2"/></label>)}
    <label className="grid gap-1 text-sm">Navigation Font<select value={value.nav_font_family} onChange={e=>updateFont(e.target.value)} className="border rounded-lg p-2"><option value="inherit">Use Storefront Font</option><option value="Arial, sans-serif">Arial · Sans Serif</option><option value="Georgia, serif">Georgia · Serif</option><option value="Times New Roman, serif">Times New Roman · Serif</option><option value="system-ui, sans-serif">System UI · Sans Serif</option></select></label>
   </div>
   {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
   {message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}
   <button type="button" disabled={busy} onClick={()=>void save()} className="bg-slate-900 text-white rounded-lg px-5 py-3 text-sm disabled:opacity-50">{busy?'Saving…':'Save Branding Settings'}</button>
  </div>
 </section>;
};
export default BrandingSettings;
