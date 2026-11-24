import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

type Holiday={id:string;holiday_date:string;holiday_name:string;holiday_scope:'national'|'state';region_label:string|null;is_active:boolean;};
export const BusinessCalendarSettings:React.FC=()=>{
 const[rows,setRows]=useState<Holiday[]>([]);const[version,setVersion]=useState(1);
 const[date,setDate]=useState('');const[name,setName]=useState('');const[scope,setScope]=useState<'national'|'state'>('national');const[region,setRegion]=useState('');
 const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[message,setMessage]=useState('');
 const load=async()=>{const[h,m]=await Promise.all([supabase.from('business_calendar_holidays').select('id,holiday_date,holiday_name,holiday_scope,region_label,is_active').order('holiday_date'),supabase.from('business_calendar_meta').select('version').eq('singleton',true).maybeSingle()]);if(h.error)setError(h.error.message);else setRows((h.data||[]) as Holiday[]);if(m.error)setError(m.error.message);else setVersion(m.data?.version||1);};
 useEffect(()=>{void load();},[]);
 const add=async(e:React.FormEvent)=>{e.preventDefault();if(!date||!name.trim()){setError('Enter a date and holiday name.');return;}setBusy(true);setError('');setMessage('');const{data:userData}=await supabase.auth.getUser();const{error:saveError}=await supabase.from('business_calendar_holidays').insert({holiday_date:date,holiday_name:name.trim(),holiday_scope:scope,region_label:scope==='state'?(region.trim()||null):null,created_by:userData.user?.id||null});if(saveError)setError(saveError.message);else{setDate('');setName('');setRegion('');setMessage('Holiday added. New deadlines will use the updated calendar; existing communicated deadlines will not be shortened.');await load();}setBusy(false);};
 const toggle=async(row:Holiday)=>{setError('');const{error:updateError}=await supabase.from('business_calendar_holidays').update({is_active:!row.is_active,updated_at:new Date().toISOString()}).eq('id',row.id);if(updateError)setError(updateError.message);else{setMessage(row.is_active?'Holiday deactivated.':'Holiday activated.');await load();}};
 return <section className="max-w-4xl space-y-5">
  <div><h2 className="text-lg font-semibold">Business Calendar · Malaysia Time</h2><p className="text-sm text-slate-500 mt-1">Weekends and every active national or state holiday entered here are excluded from business-day deadlines. State holidays also apply globally, as previously specified.</p><p className="text-xs text-slate-500 mt-1">Calendar version: {version}. Editing the calendar affects new deadline calculations; already communicated deadlines are preserved and never shortened.</p></div>
  <form onSubmit={add} className="bg-white border rounded-xl p-5 grid gap-3 sm:grid-cols-2">
   <h3 className="sm:col-span-2 font-medium">Add Holiday</h3>
   <label className="grid gap-1 text-sm">Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded-lg p-2"/></label>
   <label className="grid gap-1 text-sm">Holiday Name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Malaysia Day" className="border rounded-lg p-2"/></label>
   <label className="grid gap-1 text-sm">Holiday Type<select value={scope} onChange={e=>setScope(e.target.value as 'national'|'state')} className="border rounded-lg p-2"><option value="national">National</option><option value="state">State</option></select></label>
   {scope==='state'&&<label className="grid gap-1 text-sm">State Name<input value={region} onChange={e=>setRegion(e.target.value)} placeholder="e.g. Penang" className="border rounded-lg p-2"/></label>}
   <button disabled={busy} className="sm:col-span-2 bg-slate-900 text-white rounded-lg px-5 py-3 text-sm disabled:opacity-50">{busy?'Saving…':'Add to Business Calendar'}</button>
  </form>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}
  <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Holiday</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">State</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-3 whitespace-nowrap">{row.holiday_date}</td><td className="p-3">{row.holiday_name}</td><td className="p-3 capitalize">{row.holiday_scope}</td><td className="p-3">{row.region_label||'—'}</td><td className="p-3">{row.is_active?'Active':'Inactive'}</td><td className="p-3"><button type="button" onClick={()=>void toggle(row)} className="underline">{row.is_active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table>{rows.length===0&&<p className="p-5 text-sm text-slate-500">No holidays have been configured.</p>}</div>
 </section>;
};
export default BusinessCalendarSettings;
