import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../lib/supabase';
import {useTheme,themeToCssVars} from '../context/ThemeContext';

interface AccountPageProps{initialSubTab?:string;selectedCurrency:string;onGoOrders:()=>void;}
type AddressRow={id:string;recipient_name:string;phone:string;address_line_1:string;address_line_2:string|null;city:string;state_region:string|null;postal_code:string|null;country_code:string;};

export const AccountPage:React.FC<AccountPageProps>=({onGoOrders})=>{
 const{user,logout}=useAuth();
 const[name,setName]=useState(user?.name||'');
 const[phone,setPhone]=useState(user?.phone||'');
 const[addressLine1,setAddressLine1]=useState('');
 const[addressLine2,setAddressLine2]=useState('');
 const[city,setCity]=useState('');
 const[region,setRegion]=useState('');
 const[postalCode,setPostalCode]=useState('');
 const[countryCode,setCountryCode]=useState('MY');
 const[defaultAddressId,setDefaultAddressId]=useState<string|null>(null);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState('');
 const[error,setError]=useState('');
 const{currentTheme}=useTheme();

 useEffect(()=>{
  if(!user)return;
  let alive=true;
  Promise.all([
   supabase.from('profiles').select('display_name,phone,whatsapp').eq('id',user.id).maybeSingle(),
   supabase.from('customer_addresses').select('id,recipient_name,phone,address_line_1,address_line_2,city,state_region,postal_code,country_code').eq('user_id',user.id).eq('is_default',true).maybeSingle()
  ]).then(([profileResult,addressResult])=>{
   if(!alive)return;
   if(profileResult.error)setError(profileResult.error.message);
   else if(profileResult.data){setName(profileResult.data.display_name||user.name||'');setPhone(profileResult.data.phone||profileResult.data.whatsapp||user.phone||'');}
   if(addressResult.error)setError(addressResult.error.message);
   else if(addressResult.data){
    const row=addressResult.data as AddressRow;
    setDefaultAddressId(row.id);setAddressLine1(row.address_line_1||'');setAddressLine2(row.address_line_2||'');
    setCity(row.city||'');setRegion(row.state_region||'');setPostalCode(row.postal_code||'');setCountryCode(row.country_code||'MY');
   }
  });
  return()=>{alive=false;};
 },[user?.id]);

 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(!user)return;
  const hasAddress=[addressLine1,addressLine2,city,region,postalCode].some(value=>value.trim()!=='');
  if(hasAddress&&(!addressLine1.trim()||!city.trim()||!name.trim()||!phone.trim()||!/^[A-Z]{2}$/.test(countryCode.trim().toUpperCase()))){
   setError('Please enter your name, phone number, Address Line 1, City and a valid two-letter Country Code before saving your delivery address.');return;
  }
  setBusy(true);setMessage('');setError('');
  const[{error:profileError},{error:authError}]=await Promise.all([
   supabase.from('profiles').update({display_name:name.trim(),phone:phone.trim(),whatsapp:phone.trim()}).eq('id',user.id),
   supabase.auth.updateUser({data:{full_name:name.trim(),phone:phone.trim()}})
  ]);
  if(profileError||authError){setError(profileError?.message||authError?.message||'Unable to save profile.');setBusy(false);return;}
  if(!hasAddress&&defaultAddressId){
   const{error:clearAddressError}=await supabase.from('customer_addresses').update({is_default:false}).eq('id',defaultAddressId).eq('user_id',user.id);
   if(clearAddressError){setError('Profile saved, but the default address could not be cleared: '+clearAddressError.message);setBusy(false);return;}
   setDefaultAddressId(null);
  }
  if(hasAddress){
   const payload={user_id:user.id,recipient_name:name.trim(),phone:phone.trim(),address_line_1:addressLine1.trim(),address_line_2:addressLine2.trim()||null,city:city.trim(),state_region:region.trim()||null,postal_code:postalCode.trim()||null,country_code:countryCode.trim().toUpperCase(),is_default:true};
   let addressError:null|string=null;
   if(defaultAddressId){
    const result=await supabase.from('customer_addresses').update(payload).eq('id',defaultAddressId).eq('user_id',user.id);
    addressError=result.error?.message||null;
   }else{
    const result=await supabase.from('customer_addresses').insert(payload).select('id').single();
    addressError=result.error?.message||null;
    if(result.data?.id)setDefaultAddressId(result.data.id);
   }
   if(addressError){setError('Profile saved, but the delivery address could not be saved: '+addressError);setBusy(false);return;}
  }
  setMessage(hasAddress?'Profile and default delivery address saved successfully.':'Profile saved successfully.');setBusy(false);
 };

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
   <div className="border-t pt-4 space-y-3">
    <h3 className="font-semibold">Default Delivery Address</h3>
    <p className="text-xs" style={{color:'var(--theme-text-secondary)'}}>This address will be filled in automatically at Checkout. Leave all address fields blank if you do not want to save a delivery address yet.</p>
    <label className="block text-sm">Address Line 1
     <input value={addressLine1} onChange={e=>setAddressLine1(e.target.value)} className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/>
    </label>
    <label className="block text-sm">Address Line 2
     <input value={addressLine2} onChange={e=>setAddressLine2(e.target.value)} className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/>
    </label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
     <label className="block text-sm">City<input value={city} onChange={e=>setCity(e.target.value)} className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/></label>
     <label className="block text-sm">State / Region<input value={region} onChange={e=>setRegion(e.target.value)} className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/></label>
     <label className="block text-sm">Postal Code<input value={postalCode} onChange={e=>setPostalCode(e.target.value)} className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/></label>
     <label className="block text-sm">Country Code<input maxLength={2} value={countryCode} onChange={e=>setCountryCode(e.target.value.toUpperCase())} className="mt-1 w-full rounded p-3 border outline-none" style={fieldStyle}/></label>
    </div>
   </div>
   {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
   {message&&<p role="status" className="text-sm" style={{color:'var(--theme-text-secondary)'}}>{message}</p>}
   <button disabled={busy} className="px-6 py-3 rounded-full text-xs disabled:opacity-50" style={{backgroundColor:'var(--theme-button-primary)',color:'var(--theme-button-text)'}}>{busy?'Saving…':'Save Profile & Address'}</button>
  </form>
 </div>;
};
export default AccountPage;
