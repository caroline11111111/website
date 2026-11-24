import React,{useEffect,useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

type Access={is_admin:boolean;is_owner:boolean;permissions:string[]};
type Props={supabase:SupabaseClient;access:Access;timezone:string;now:Date;onNavigate:(view:string)=>void};
type Order={id:string;created_at:string;order_status:string;payment_status:string;total_myr:number|null;order_items:Array<{product_name:string;quantity:number}>};

const money=(value:number)=>'RM '+value.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const startOf=(date:Date,period:string,tz:string)=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const y=Number(p.year),m=Number(p.month),d=Number(p.day);
 let target:Date;
 if(period==='yearly') target=new Date(Date.UTC(y,0,1));
 else if(period==='monthly') target=new Date(Date.UTC(y,m-1,1));
 else if(period==='weekly'){const weekday=new Date(Date.UTC(y,m-1,d)).getUTCDay();target=new Date(Date.UTC(y,m-1,d-(weekday===0?6:weekday-1)));}
 else target=new Date(Date.UTC(y,m-1,d));
 return target;
};
const addPeriod=(date:Date,period:string)=>{const next=new Date(date);if(period==='yearly')next.setUTCFullYear(next.getUTCFullYear()+1);else if(period==='monthly')next.setUTCMonth(next.getUTCMonth()+1);else if(period==='weekly')next.setUTCDate(next.getUTCDate()+7);else next.setUTCDate(next.getUTCDate()+1);return next;};
const keyFor=(date:Date,period:string,tz:string)=>{
 if(period==='yearly')return new Intl.DateTimeFormat('en',{timeZone:tz,year:'numeric'}).format(date);
 if(period==='monthly')return new Intl.DateTimeFormat('en',{timeZone:tz,month:'short',year:'2-digit'}).format(date);
 return new Intl.DateTimeFormat('en',{timeZone:tz,month:'short',day:'numeric'}).format(date);
};

export function DashboardOverview({supabase,access,timezone,now,onNavigate}:Props){
 const[period,setPeriod]=useState('daily');const[custom,setCustom]=useState(false);const[from,setFrom]=useState('');const[to,setTo]=useState('');
 const[orders,setOrders]=useState<Order[]>([]);const[products,setProducts]=useState<number|null>(null);const[customers,setCustomers]=useState<number|null>(null);const[admins,setAdmins]=useState<number|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 const can=(p:string)=>access.is_owner||access.permissions.includes(p);
 useEffect(()=>{let alive=true;const load=async()=>{
  setLoading(true);setError('');
  const tasks:any[]=[];
  if(can('products.view'))tasks.push(supabase.from('products').select('id',{count:'exact',head:true}));
  else tasks.push(Promise.resolve({count:null,error:null}));
  if(can('customers.view'))tasks.push(supabase.from('profiles').select('id'));
  else tasks.push(Promise.resolve({data:null,error:null}));
  if(can('admins.manage'))tasks.push(supabase.from('admin_users').select('user_id,is_active'));
  else tasks.push(Promise.resolve({data:null,error:null}));
  if(can('orders.view'))tasks.push(supabase.from('orders').select('id,created_at,order_status,payment_status,total_myr,order_items(product_name,quantity)').order('created_at',{ascending:true}));
  else tasks.push(Promise.resolve({data:null,error:null}));
  const [p,c,a,o]=await Promise.all(tasks);
  if(!alive)return;
  const errors=[p.error,c.error,a.error,o.error].filter(Boolean);
  if(errors.length)setError(errors.map((x:any)=>x.message).join(' · '));
  setProducts(p.count??null);
  if(c.data){const adminIds=new Set((a.data||[]).map((x:any)=>x.user_id));setCustomers(c.data.filter((x:any)=>!adminIds.has(x.id)).length);}
  else setCustomers(null);
  setAdmins(a.data?.filter((x:any)=>x.is_active).length??null);
  setOrders((o.data||[]) as Order[]);
  setLoading(false);
 };void load();return()=>{alive=false;};},[supabase,access]);
 const range=useMemo(()=>{
  if(custom&&from&&to){const start=new Date(from+'T00:00:00');const end=new Date(to+'T23:59:59.999');return {start,end};}
  const start=startOf(now,period,timezone);return {start,end:addPeriod(start,period)};
 },[custom,from,to,now,period,timezone]);
 const filtered=orders.filter(o=>{const t=new Date(o.created_at).getTime();return t>=range.start.getTime()&&t<range.end.getTime();});
 const valid=filtered.filter(o=>o.order_status!=='cancelled'&&o.payment_status==='verified');
 const sales=valid.reduce((sum,o)=>sum+Number(o.total_myr||0),0);
 const units=valid.reduce((sum,o)=>sum+(o.order_items||[]).reduce((n,i)=>n+Number(i.quantity||0),0),0);
 const chart=useMemo(()=>{
  const labels:string[]=[];const values:number[]=[];
  let cursor=new Date(range.start);let guard=0;
  while(cursor<range.end&&guard<400){labels.push(keyFor(cursor,period,timezone));values.push(0);cursor=addPeriod(cursor,period);guard++;}
  const index=new Map(labels.map((label,i)=>[label,i]));
  for(const order of valid){const i=index.get(keyFor(new Date(order.created_at),period,timezone));if(i!==undefined)values[i]+=Number(order.total_myr||0);}
  return labels.map((label,i)=>({label,value:values[i]}));
 },[range,period,timezone,valid]);
 const top=useMemo(()=>{const map=new Map<string,number>();for(const order of valid)for(const item of order.order_items||[])map.set(item.product_name,(map.get(item.product_name)||0)+Number(item.quantity||0));return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);},[valid]);
 const max=Math.max(1,...chart.map(x=>x.value));
 const card=(label:string,value:number|null,sub:string,view:string)=><button onClick={()=>onNavigate(view)} className="bg-white border rounded-xl p-5 text-left hover:shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="text-3xl font-semibold mt-2">{loading?'…':value===null?'—':value.toLocaleString()}</p><p className="text-xs text-slate-500 mt-2">{sub}</p></button>;
 return <div className="space-y-5">
  {error&&<p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">Dashboard data could not be fully loaded: {error}</p>}
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   {can('orders.view')&&card('Total Orders',orders.length,'All recorded orders','orders')}
   {can('products.view')&&card('Total Products',products,'Includes drafts and archived items','products')}
   {can('customers.view')&&card('Customer Accounts',customers,'Excludes registered Admin accounts','customers')}
   {can('admins.manage')&&card('Active Admin Accounts',admins,'Active Admin and Owner accounts','admins')}
  </div>
  <section className="bg-white border rounded-xl p-5 space-y-4">
   <div className="flex flex-wrap justify-between items-center gap-3"><div><h3 className="font-semibold">Sales Analytics</h3><p className="text-xs text-slate-500">Verified payments only · Cancelled orders excluded · MYR base amount</p></div>
    <div className="flex flex-wrap gap-2">{['daily','weekly','monthly','yearly'].map(x=><button key={x} onClick={()=>{setPeriod(x);setCustom(false);}} className={'px-3 py-2 rounded-lg text-xs border '+(!custom&&period===x?'bg-slate-900 text-white':'')}>{x[0].toUpperCase()+x.slice(1)}</button>)}<button onClick={()=>setCustom(v=>!v)} className={'px-3 py-2 rounded-lg text-xs border '+(custom?'bg-slate-900 text-white':'')}>Custom</button></div>
   </div>
   {custom&&<div className="flex flex-wrap gap-3 items-end text-sm"><label className="grid gap-1">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border rounded-lg p-2"/></label><label className="grid gap-1">To<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)} className="border rounded-lg p-2"/></label></div>}
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Sales</p><p className="font-semibold mt-1">{money(sales)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Paid Orders</p><p className="font-semibold mt-1">{valid.length}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Units Sold</p><p className="font-semibold mt-1">{units}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Cancelled</p><p className="font-semibold mt-1">{filtered.filter(o=>o.order_status==='cancelled').length}</p></div></div>
   {!loading&&(!from||!to)&&custom&&<p className="text-xs text-slate-500">Choose both dates to view the custom range.</p>}
   <div className="space-y-2">{chart.length===0?<p className="text-sm text-slate-500">No sales data for this period.</p>:chart.map((x,i)=><div key={i} className="grid grid-cols-[5rem_1fr_auto] gap-3 items-center text-xs"><span className="text-slate-500">{x.label}</span><div className="h-3 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-slate-800 rounded" style={{width:(x.value/max*100)+'%'}}/></div><span className="tabular-nums text-slate-700">{money(x.value)}</span></div>)}</div>
  </section>
  <section className="bg-white border rounded-xl p-5 space-y-3"><div><h3 className="font-semibold">Top-Selling Products</h3><p className="text-xs text-slate-500">Ranked by units sold from verified, non-cancelled orders in the selected period.</p></div>{top.length===0?<p className="text-sm text-slate-500">No paid product sales in this period.</p>:top.map(([name,qty],i)=><div key={name} className="flex items-center gap-3 border-t pt-3 text-sm"><span className="w-7 text-slate-400">#{i+1}</span><span className="flex-1">{name}</span><strong>{qty} units</strong></div>)}</section>
  <p className="text-xs text-slate-500">Reporting timezone: {timezone}. Period filters use this timezone. Data is loaded from Supabase according to your Admin permissions.</p>
 </div>;
}
