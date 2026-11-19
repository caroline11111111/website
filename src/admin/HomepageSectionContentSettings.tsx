import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

type HomeSectionContent={heading:string;description:string;button_text:string};
const DEFAULT_VALUE:HomeSectionContent={heading:'FEATURED HIGHLIGHTS',description:'Discover our finest curated selections',button_text:'Explore Shop'};

export const HomepageSectionContentSettings:React.FC=()=>{
 const[value,setValue]=useState<HomeSectionContent>(DEFAULT_VALUE);
 const[busy,setBusy]=useState(false);
 const[loading,setLoading]=useState(true);
 const[message,setMessage]=useState('');
 const[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_homepage_section_content').maybeSingle().then(({data,error:loadError})=>{
   if(!alive)return;
   if(loadError){setError(loadError.message);setLoading(false);return;}
   const raw=data?.setting_value as Partial<HomeSectionContent>|null;
   if(raw)setValue({...DEFAULT_VALUE,...raw});
   setLoading(false);
  });
  return()=>{alive=false;};
 },[]);
 const update=(key:keyof HomeSectionContent,next:string)=>setValue(current=>({...current,[key]:next}));
 const save=async()=>{
  if(!value.heading.trim()||!value.button_text.trim()){setError('Section heading and button text are required.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const{data:userData,error:userError}=await supabase.auth.getUser();
   if(userError)throw userError;
   const payload={heading:value.heading.trim(),description:value.description.trim(),button_text:value.button_text.trim()};
   const{error:saveError}=await supabase.from('site_settings').upsert({setting_key:'storefront_homepage_section_content',setting_value:payload,updated_by:userData.user?.id||null,updated_at:new Date().toISOString()},{onConflict:'setting_key'});
   if(saveError)throw saveError;
   const{data:confirmed,error:verifyError}=await supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_homepage_section_content').maybeSingle();
   if(verifyError)throw verifyError;
   const saved=confirmed?.setting_value as Partial<HomeSectionContent>|null;
   if(!saved||saved.heading!==payload.heading||saved.description!==payload.description||saved.button_text!==payload.button_text){
    throw new Error('Save request completed, but the saved content could not be verified. Please try again.');
   }
   setMessage('Published successfully. The storefront will refresh the latest text automatically.');
  }catch(saveError){
   setError(saveError instanceof Error?saveError.message:'Unable to publish homepage section content. Please try again.');
  }finally{
   setBusy(false);
  }
 };
 return <section className="mt-5 max-w-3xl rounded-xl border bg-white p-5 space-y-4">
  <div><h3 className="font-semibold">Homepage Section Content</h3><p className="mt-1 text-xs text-slate-500">Edit the Featured Highlights heading, supporting description and Explore Shop button. The same text is used on Desktop and Mobile.</p></div>
  {loading?<p className="text-sm text-slate-500">Loading saved content…</p>:<>
   <label className="grid gap-1 text-sm font-medium">Section Heading<input maxLength={100} value={value.heading} onChange={e=>update('heading',e.target.value)} className="rounded-lg border p-2"/></label>
   <label className="grid gap-1 text-sm font-medium">Section Description<textarea maxLength={240} rows={2} value={value.description} onChange={e=>update('description',e.target.value)} className="rounded-lg border p-2"/></label>
   <label className="grid gap-1 text-sm font-medium">Button Text<input maxLength={60} value={value.button_text} onChange={e=>update('button_text',e.target.value)} className="rounded-lg border p-2"/></label>
   {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
   {message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}
   <div className="flex justify-end"><button type="button" disabled={busy} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-5 py-3 text-sm text-white disabled:opacity-50">{busy?'Publishing…':'Save & Publish'}</button></div>
  </>}
 </section>;
};
export default HomepageSectionContentSettings;
