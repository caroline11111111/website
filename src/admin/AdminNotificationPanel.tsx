import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
type Notice={id:string;notification_type:string;title:string;message:string;created_at:string;order_id:string|null;};
export const AdminNotificationPanel:React.FC=()=>{
 const[rows,setRows]=useState<Notice[]>([]);const[busy,setBusy]=useState<string|null>(null);const[error,setError]=useState('');
 const load=async()=>{const{data,error:loadError}=await supabase.from('admin_notifications').select('id,notification_type,title,message,created_at,order_id').is('read_at',null).order('created_at',{ascending:false}).limit(12);if(loadError)setError(loadError.message);else setRows((data||[]) as Notice[]);};
 useEffect(()=>{void load();},[]);
 const markRead=async(id:string)=>{setBusy(id);const{error:rpcError}=await supabase.rpc('mark_admin_notification_read',{p_notification_id:id});if(rpcError)setError(rpcError.message);else await load();setBusy(null);};
 if(!rows.length&&!error)return null;
 return <section className="bg-white border rounded-xl p-5 space-y-3"><div className="flex justify-between items-center"><h3 className="font-semibold">Staff Notifications</h3><button onClick={()=>void load()} className="text-xs underline">Refresh</button></div>{error&&<p className="text-sm text-red-600">{error}</p>}{rows.map(row=><article key={row.id} className="border-t pt-3 flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{row.title}</p><p className="text-xs text-slate-600 mt-1">{row.message}</p><p className="text-[11px] text-slate-400 mt-1">{new Date(row.created_at).toLocaleString()} · {row.order_id||''}</p></div><button type="button" disabled={busy===row.id} onClick={()=>void markRead(row.id)} className="text-xs underline whitespace-nowrap">{busy===row.id?'…':'Mark read'}</button></article>)}</section>;
};
export default AdminNotificationPanel;
