import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
type LocaleContent={heading:string;description:string;button_text:string};
type BilingualContent={en:LocaleContent;zh:LocaleContent};
const DEFAULT_VALUE:BilingualContent={
 en:{heading:'FEATURED HIGHLIGHTS',description:'Discover our finest curated selections',button_text:'Explore Shop'},
 zh:{heading:'精选推荐',description:'探索我们精心挑选的优质商品',button_text:'浏览商品'}
};
const normalize=(raw:any):BilingualContent=>{
 if(raw?.en||raw?.zh)return {en:{...DEFAULT_VALUE.en,...(raw.en||{})},zh:{...DEFAULT_VALUE.zh,...(raw.zh||{})}};
 return {en:{heading:raw?.heading||DEFAULT_VALUE.en.heading,description:raw?.description||DEFAULT_VALUE.en.description,button_text:raw?.button_text||DEFAULT_VALUE.en.button_text},zh:{...DEFAULT_VALUE.zh}};
};
export const HomepageSectionContentSettings:React.FC=()=>{
 const[value,setValue]=useState<BilingualContent>(DEFAULT_VALUE);
 const[locale,setLocale]=useState<'en'|'zh'>('en');
 const[busy,setBusy]=useState(false);const[loading,setLoading]=useState(true);const[message,setMessage]=useState('');const[error,setError]=useState('');
 useEffect(()=>{let alive=true;supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_homepage_section_content').maybeSingle().then(({data,error:loadError})=>{if(!alive)return;if(loadError)setError(loadError.message);else if(data?.setting_value)setValue(normalize(data.setting_value));setLoading(false);});return()=>{alive=false;};},[]);
 const update=(key:keyof LocaleContent,next:string)=>setValue(current=>({...current,[locale]:{...current[locale],[key]:next}}));
 const save=async()=>{if(!value.en.heading.trim()||!value.en.button_text.trim()||!value.zh.heading.trim()||!value.zh.button_text.trim()){setError('Please complete both English and Chinese headings and button text.');return;}setBusy(true);setError('');setMessage('');try{const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const payload={en:{heading:value.en.heading.trim(),description:value.en.description.trim(),button_text:value.en.button_text.trim()},zh:{heading:value.zh.heading.trim(),description:value.zh.description.trim(),button_text:value.zh.button_text.trim()}};const{error:saveError}=await supabase.from('site_settings').upsert({setting_key:'storefront_homepage_section_content',setting_value:payload,updated_by:userData.user?.id||null,updated_at:new Date().toISOString()},{onConflict:'setting_key'});if(saveError)throw saveError;const{data:confirmed,error:verifyError}=await supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_homepage_section_content').maybeSingle();if(verifyError)throw verifyError;const saved=normalize(confirmed?.setting_value);if(JSON.stringify(saved)!==JSON.stringify(payload))throw new Error('Saved content could not be verified. Please try again.');setMessage('Both language versions saved and published.');}catch(e){setError(e instanceof Error?e.message:'Unable to publish homepage section content.');}finally{setBusy(false);}};
 return <section className="mt-5 max-w-3xl rounded-xl border bg-white p-5 space-y-4"><div><h3 className="font-semibold">Homepage Section Content</h3><p className="mt-1 text-xs text-slate-500">Maintain separate English and Simplified Chinese text. The selected language is shown on the storefront, on both Desktop and Mobile.</p></div>
 {loading?<p className="text-sm text-slate-500">Loading saved content…</p>:<><div className="flex gap-2"><button type="button" onClick={()=>setLocale('en')} className={'rounded-lg border px-4 py-2 text-sm '+(locale==='en'?'bg-slate-900 text-white':'')}>English</button><button type="button" onClick={()=>setLocale('zh')} className={'rounded-lg border px-4 py-2 text-sm '+(locale==='zh'?'bg-slate-900 text-white':'')}>简体中文</button></div>
 <label className="grid gap-1 text-sm font-medium">Section Heading<input maxLength={100} value={value[locale].heading} onChange={e=>update('heading',e.target.value)} className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm font-medium">Section Description<textarea maxLength={240} rows={2} value={value[locale].description} onChange={e=>update('description',e.target.value)} className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm font-medium">Button Text<input maxLength={60} value={value[locale].button_text} onChange={e=>update('button_text',e.target.value)} className="rounded-lg border p-2"/></label>
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}<div className="flex justify-end"><button type="button" disabled={busy} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-5 py-3 text-sm text-white disabled:opacity-50">{busy?'Publishing…':'Save & Publish Both Languages'}</button></div></>}</section>;
};
export default HomepageSectionContentSettings;
