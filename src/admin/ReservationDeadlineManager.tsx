import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

type Reservation={id:string;order_id:string;quantity:number;status:string;reserved_at:string;original_deadline_at:string|null;current_deadline_at:string|null;deadline_stage:string|null;deadline_calendar_version:number|null;orders?:any;products?:any;product_variants?:any;};
type History={id:string;order_id:string;event_type:string;deadline_stage:string|null;old_deadline_at:string|null;new_deadline_at:string|null;reason:string|null;created_at:string;orders?:any;};
const fmt=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-MY',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(value)):'—';
export const ReservationDeadlineManager:React.FC<{canExtend:boolean}>={({canExtend})=>{
 const[rows,setRows]=useState<Reservation[]>([]);const[history,setHistory]=useState<History[]>([]);
 const[dates,setDates]=useState<Record<string,string>>({});const[busyId,setBusyId]=useState<string|null>(null);const[error,setError]=useState('');const[message,setMessage]=useState('');
 const load=async()=>{
  const[r,h]=await Promise.all([
   supabase.from('inventory_reservations').select('id,order_id,quantity,status,reserved_at,original_deadline_at,current_deadline_at,deadline_stage,deadline_calendar_version,orders(order_number,order_status,payment_status,deadline_stage,deadline_status,current_deadline_at),products(name),product_variants(variant_name,variant_value)').eq('status','reserved').order('reserved_at',{ascending:false}).limit(100),
   supabase.from('order_deadline_history').select('id,order_id,event_type,deadline_stage,old_deadline_at,new_deadline_at,reason,created_at,orders(order_number)').order('created_at',{ascending:false}).limit(80)
  ]);
  if(r.error)setError(r.error.message);else setRows((r.data||[]) as Reservation[]);
  if(h.error)setError(h.error.message);else setHistory((h.data||[]) as History[]);
 };
 useEffect(()=>{void load();},[]);
 const extend=async(row:Reservation)=>{
  const date=dates[row.order_id];if(!date){setError('Choose a new business-day deadline date first.');return;}
  const reason=window.prompt('Enter the reason for extending or reopening this deadline:');if(!reason?.trim())return;
  setBusyId(row.order_id);setError('');setMessage('');
  const{data,error:rpcError}=await supabase.rpc('extend_order_deadline',{p_order_id:row.order_id,p_new_deadline_date:date,p_reason:reason.trim()});
  if(rpcError)setError(rpcError.message);else{setMessage('Deadline updated to '+fmt(data)+'. The action and reason were recorded in deadline history.');await load();}
  setBusyId(null);
 };
 return <section className="space-y-5">
  <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Active Inventory Reservations & Deadlines</h3><p className="text-xs text-slate-500 mt-1">Overdue deadlines never cancel orders or release stock automatically. Inventory remains reserved until an authorized person takes a manual action.</p></div><button onClick={()=>void load()} className="text-sm underline">Refresh</button></div>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}
  <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Order / Item</th><th className="p-3 text-left">Deadline Stage</th><th className="p-3 text-left">Original Deadline</th><th className="p-3 text-left">Current Deadline</th><th className="p-3 text-left">Status</th>{canExtend&&<th className="p-3 text-left">Admin Action</th>}</tr></thead><tbody>{rows.map(row=>{const order=row.orders||{};const item=row.products?.name||[row.product_variants?.variant_name,row.product_variants?.variant_value].filter(Boolean).join(' ')||'Inventory item';return <tr key={row.id} className="border-t align-top"><td className="p-3"><div className="font-medium">{order.order_number||row.order_id}</div><div>{item} × {row.quantity}</div><div className="text-xs text-slate-500">{order.payment_status||''}</div></td><td className="p-3 capitalize">{row.deadline_stage||order.deadline_stage||'—'}</td><td className="p-3 whitespace-nowrap">{fmt(row.original_deadline_at)}</td><td className="p-3 whitespace-nowrap">{fmt(row.current_deadline_at||order.current_deadline_at)}</td><td className="p-3"><span className={order.deadline_status==='overdue'?'text-red-700 font-medium':'text-slate-700'}>{order.deadline_status||'active'}</span></td>{canExtend&&<td className="p-3 min-w-48"><input type="date" value={dates[row.order_id]||''} onChange={e=>setDates(current=>({...current,[row.order_id]:e.target.value}))} className="border rounded p-2 w-full mb-2"/><button type="button" disabled={busyId===row.order_id} onClick={()=>void extend(row)} className="rounded bg-slate-900 text-white px-3 py-2 text-xs disabled:opacity-50">{busyId===row.order_id?'Saving…':order.deadline_status==='overdue'?'Reopen / Extend':'Extend Deadline'}</button></td>}</tr>;})}</tbody></table>{rows.length===0&&<p className="p-5 text-sm text-slate-500">No active reservations.</p>}</div>
  <div className="bg-white border rounded-xl overflow-x-auto"><div className="p-4 border-b"><h3 className="font-semibold">Append-only Deadline History</h3><p className="text-xs text-slate-500 mt-1">Original deadlines, extensions, reopenings and calendar versions are retained.</p></div><table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-3 text-left">Time (MYT)</th><th className="p-3 text-left">Order</th><th className="p-3 text-left">Event</th><th className="p-3 text-left">Old Deadline</th><th className="p-3 text-left">New Deadline</th><th className="p-3 text-left">Reason</th></tr></thead><tbody>{history.map(item=><tr key={item.id} className="border-t"><td className="p-3 whitespace-nowrap">{fmt(item.created_at)}</td><td className="p-3">{item.orders?.order_number||item.order_id}</td><td className="p-3">{item.event_type}</td><td className="p-3 whitespace-nowrap">{fmt(item.old_deadline_at)}</td><td className="p-3 whitespace-nowrap">{fmt(item.new_deadline_at)}</td><td className="p-3">{item.reason||'—'}</td></tr>)}</tbody></table>{history.length===0&&<p className="p-5 text-sm text-slate-500">No deadline history yet.</p>}</div>
 </section>;
};
export default ReservationDeadlineManager;
