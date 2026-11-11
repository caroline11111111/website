import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../lib/supabase';
interface AccountPageProps{initialSubTab?:string;selectedCurrency:string;}
export const AccountPage:React.FC<AccountPageProps>=({initialSubTab='profile'})=>{
 const{user,logout}=useAuth();const[name,setName]=useState(user?.name||'');const[phone,setPhone]=useState(user?.phone||'');const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');
 useEffect(()=>{if(!user)return;supabase.from('profiles').select('display_name,phone,whatsapp').eq('id',user.id).maybeSingle().then(({data})=>{if(data){setName(data.display_name||user.name);setPhone(data.phone||data.whatsapp||user.phone||'');}});},[user]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!user)return;setBusy(true);setMessage('');const{error}=await supabase.from('profiles').upsert({id:user.id,display_name:name,phone,whatsapp:phone},{onConflict:'id'});setMessage(error?error.message:'Profile updated.');setBusy(false);};
 if(!user)return <div className="py-16 text-center">Please sign in to view your account.</div>;
 return <div className="w-full max-w-3xl mx-auto px-6 py-12 space-y-8"><div className="flex justify-between items-center border-b pb-6"><h1 className="text-3xl font-light">My Account</h1><button onClick={()=>void logout()} className="text-xs text-red-600 underline">Sign Out</button></div><form onSubmit={save} className="bg-white p-6 rounded-lg border max-w-xl space-y-4"><h2 className="font-semibold">Profile Information</h2><p className="text-sm text-gray-500">Email: {user.email}</p><label className="block text-sm">Full Name<input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full border rounded p-3"/></label><label className="block text-sm">Phone Number<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>{message&&<p role="status" className="text-sm text-slate-600">{message}</p>}<button disabled={busy} className="px-6 py-3 bg-black text-white rounded-full text-xs">{busy?'Saving…':'Save Profile'}</button></form></div>;
};
export default AccountPage;