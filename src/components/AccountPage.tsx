import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../lib/supabase';
import {useTheme,themeToCssVars} from '../context/ThemeContext';
interface AccountPageProps{initialSubTab?:string;selectedCurrency:string;onGoOrders:()=>void;}
export const AccountPage:React.FC<AccountPageProps>=({onGoOrders})=>{
 const{user,logout}=useAuth();const[name,setName]=useState(user?.name||'');const[phone,setPhone]=useState(user?.phone||'');const[address,setAddress]=useState('');const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const[error,setError]=useState('');
 const{currentTheme}=useTheme();
 useEffect(()=>{if(!user)return;setAddress((user as typeof user & {address?:string}).address||'');supabase.from('profiles').select('display_name,phone,whatsapp').eq('id',user.id).maybeSingle().then(({data, error:loadError})=>{if(loadError){setError(loadError.message);return;}if(data){setName(data.display_name||user.name);setPhone(data.phone||data.whatsapp||user.phone||'');}});},[user?.id]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!user)return;setBusy(true);setMessage('');setError('');const[{error:profileError},{error:authError}]=await Promise.all([supabase.from('profiles').update({display_name:name,phone,whatsapp:phone}).eq('id',user.id),supabase.auth.updateUser({data:{full_name:name,phone,address}})]);if(profileError||authError)setError(profileError?.message||authError?.message||'Unable to save profile.');else setMessage('Profile updated successfully.');setBusy(false);};
 const fieldStyle={backgroundColor:'var(--theme-input-background)',borderColor:'var(--theme-input-border)',color:'var(--theme-text-primary)'};
 if(!user)return <div className="py-16 text-center" style={{...themeToCssVars(currentTheme),backgroundColor:'var(--theme-background)',color:'var(--theme-text-primary)'}}>Please sign in to view your account.</div>;
 return <div className="w-full max-w-3xl mx-auto px-6 py-12 space-y-8" style={{...themeToCssVars(currentTheme),backgroundColor:'var(--theme-background)',color:'var(--theme-text-primary)'}}>
  <div className="flex justify-between items-center border-b pb-6" style={{borderColor:'var(--theme-border)'}}>
   <h1 className="text-3xl font-light">My Account</h1>
   <button onClick={()=>void logout()} className="text-xs underline" style={{color:'var(--theme-secondary)'}}>Sign Out</button>
  </div>
  <div className="flex flex-wrap gap-3">
   <button type="button" onClick={onGoOrders} className="px-6 py-3 rounded-full text-xs border" style={{borderColor:'var(--theme-border)',color:'var(--theme-secondary)'}}>My Orders</button>
  </div>
  <form onSubmit={save} className="p-6 rounded-lg border max-w-xl space-y-4" style={{backgroundColor:'var(--theme-surface)',borderColor:'var(--theme-border)'}}>
   <h2 className="font-semibold">Profile Information</h2>
   <p className="text-sm" style={{color:'var(--theme-text-secondary)'}}>Email: {user.email}</p>
   <label className="block text-sm">Full Name
    <input value={name} onChange={e=>setName(e.target.value)} required className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/>
   </label>
   <label className="block text-sm">Phone Number
    <input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/>
   </label>
   <label className="block text-sm">Address
    <textarea value={address} onChange={e=>setAddress(e.target.value)} rows={4} placeholder="Enter your delivery address" className="mt-1 w-full rounded p-3 border outline-none resize-y" style={fieldStyle}/>
   </label>
   {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
   {message&&<p role="status" className="text-sm" style={{color:'var(--theme-text-secondary)'}}>{message}</p>}
   <button disabled={busy} className="px-6 py-3 rounded-full text-xs disabled:opacity-50" style={{backgroundColor:'var(--theme-button-primary)',color:'var(--theme-button-text)'}}>{busy?'Saving…':'Save Profile'}</button>
  </form>
 </div>;
};
export default AccountPage;
