import React,{useEffect,useMemo,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {useCart} from '../context/CartContext';
import {formatPrice} from '../config/currencies';
import {supabase} from '../lib/supabase';
interface CheckoutPageProps{selectedCurrency:string;selectedItemIds:string[];onOrderComplete:()=>void;}
const MALAYSIA_REGIONS=[{code:'JHR',name:'Johor'},{code:'KDH',name:'Kedah'},{code:'KTN',name:'Kelantan'},{code:'MLK',name:'Melaka'},{code:'NSN',name:'Negeri Sembilan'},{code:'PHG',name:'Pahang'},{code:'PNG',name:'Penang'},{code:'PRK',name:'Perak'},{code:'PLS',name:'Perlis'},{code:'SGR',name:'Selangor'},{code:'TRG',name:'Terengganu'},{code:'KUL',name:'Kuala Lumpur'},{code:'LBN',name:'Labuan'},{code:'PJY',name:'Putrajaya'},{code:'SBH',name:'Sabah'},{code:'SWK',name:'Sarawak'}];
const normalizeMalaysiaRegion=(value:string)=>{const v=(value||'').trim().toLowerCase();const found=MALAYSIA_REGIONS.find(x=>x.code.toLowerCase()===v||x.name.toLowerCase()===v||(x.name==='Penang'&&v==='pulau pinang'));return found?.code||value;};
export const CheckoutPage:React.FC<CheckoutPageProps>=({selectedCurrency,selectedItemIds,onOrderComplete})=>{
 const{user}=useAuth();const{items,refresh}=useCart();
 const[recipientName,setRecipientName]=useState(user?.name||'');const[phone,setPhone]=useState(user?.phone||'');
 const[line1,setLine1]=useState('');const[line2,setLine2]=useState('');const[city,setCity]=useState('');
 const[region,setRegion]=useState('');const[postal,setPostal]=useState('');const[country,setCountry]=useState('MY');
 const[file,setFile]=useState<File|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 const[quote,setQuote]=useState<any>(null);const[quoteError,setQuoteError]=useState('');
 const selected=useMemo(()=>items.filter(i=>selectedItemIds.includes(i.id)),[items,selectedItemIds]);
 const subtotal=selected.reduce((sum,i)=>sum+i.priceMYR*i.quantity,0);
 useEffect(()=>{let alive=true;if(!user||!selectedItemIds.length){setQuote(null);setQuoteError('');return;}
  supabase.rpc('quote_shipping',{p_cart_item_ids:selectedItemIds,p_country_code:country,p_region_code:region||null}).then(({data,error})=>{if(!alive)return;if(error){setQuote(null);setQuoteError(error.message);}else{setQuote(data);setQuoteError('');}});
  return()=>{alive=false;};
 },[user,selectedItemIds.join(','),country,region]);
 useEffect(()=>{if(!user)return;supabase.from('customer_addresses').select('*').eq('user_id',user.id).eq('is_default',true).maybeSingle().then(({data})=>{if(data){setRecipientName(data.recipient_name);setPhone(data.phone);setLine1(data.address_line_1);setLine2(data.address_line_2||'');setCity(data.city);setRegion(country==='MY'?normalizeMalaysiaRegion(data.state_region||''):(data.state_region||''));setPostal(data.postal_code||'');setCountry(data.country_code);}});},[user]);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');
  if(!user){setError('Please sign in before checkout.');return;}if(!selected.length){setError('Please return to your bag and select items.');return;}
  if(!quote){setError(quoteError||'Please wait for a valid shipping quote before submitting.');return;}
  if(!file){setError('Please upload your payment proof before placing the order.');return;}
  if(file.size>5242880){setError('Payment proof must not exceed 5MB.');return;}
  if(!['image/jpeg','image/png','application/pdf'].includes(file.type)){setError('Only JPG, PNG, or PDF files are accepted.');return;}
  setBusy(true);
  try{
   const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'pdf';const path=user.id+'/'+crypto.randomUUID()+'.'+ext;
   const{error:uploadError}=await supabase.storage.from('payment-proofs').upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError)throw uploadError;
   const{error:submitError}=await supabase.rpc('submit_order_confirmed',{
    p_cart_item_ids:selectedItemIds,p_recipient_name:recipientName,p_recipient_phone:phone,
    p_shipping_address:{address_line_1:line1,address_line_2:line2,city,region_code:region,postal_code:postal,country_code:country},
    p_payment_proof_path:path,p_original_filename:file.name,p_mime_type:file.type,p_file_size:file.size,
    p_expected_subtotal_myr:Number(quote.subtotal_myr),p_expected_shipping_fee_myr:Number(quote.shipping_fee_myr),
    p_idempotency_key:crypto.randomUUID()
   });
   if(submitError)throw submitError;
   await refresh();onOrderComplete();
  }catch(err){setError(err instanceof Error?err.message:'Unable to submit your order. If the proof uploaded but submission failed, contact support before retrying.');}
  finally{setBusy(false);}
 };
 if(!user)return <div className="max-w-2xl mx-auto px-6 py-16 text-center">Please sign in to continue checkout.</div>;
 return <div className="w-full max-w-3xl mx-auto px-6 py-12"><h1 className="text-3xl font-light mb-8">Checkout</h1><form onSubmit={submit} className="space-y-6 bg-white p-8 rounded-lg border shadow-sm">
  <section className="space-y-4"><h2 className="font-semibold">Recipient Details</h2>
   <label className="block text-sm">Recipient Name<input required value={recipientName} onChange={e=>setRecipientName(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
   <label className="block text-sm">Phone Number<input required value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
  </section>
  <section className="space-y-4 border-t pt-5"><h2 className="font-semibold">Shipping Address</h2>
   <label className="block text-sm">Address Line 1<input required value={line1} onChange={e=>setLine1(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
   <label className="block text-sm">Address Line 2<input value={line2} onChange={e=>setLine2(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <label className="block text-sm">City<input required value={city} onChange={e=>setCity(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
    <label className="block text-sm">State / Region{country.trim().toUpperCase()==='MY'?<select required value={region} onChange={e=>setRegion(e.target.value)} className="mt-1 w-full border rounded p-3"><option value="">Select state / region</option>{MALAYSIA_REGIONS.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>:<input value={region} onChange={e=>setRegion(e.target.value)} placeholder="Enter state / region" className="mt-1 w-full border rounded p-3"/>}</label>
    <label className="block text-sm">Postal Code<input value={postal} onChange={e=>setPostal(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
    <label className="block text-sm">Country Code<input required maxLength={2} value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} className="mt-1 w-full border rounded p-3"/></label>
   </div>
  </section>
  <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">Payment Proof</h2><p className="text-xs text-gray-500">Upload your payment receipt (JPG, PNG, or PDF; maximum 5MB). Uploading a receipt does not confirm payment. Our team will review it manually.</p><input type="file" required accept="image/jpeg,image/png,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="block w-full text-sm"/></section>
  <section className="border-t pt-5 space-y-3"><h2 className="font-semibold">Selected Items</h2>
   {selected.map(i=><div key={i.id} className="flex justify-between text-sm"><span>{i.name} × {i.quantity}</span><span>{formatPrice(i.priceMYR*i.quantity,selectedCurrency)}</span></div>)}
   <div className="border-t pt-3 flex justify-between font-semibold"><span>Subtotal</span><span>{quote?formatPrice(Number(quote.subtotal_myr),selectedCurrency):formatPrice(subtotal,selectedCurrency)}</span></div>
   <div className="flex justify-between text-sm"><span>Shipping</span><span>{quote?formatPrice(Number(quote.shipping_fee_myr),selectedCurrency):'—'}</span></div>
   <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{quote?formatPrice(Number(quote.total_myr),selectedCurrency):'—'}</span></div>
   {quoteError&&<p className="text-xs text-red-600">{quoteError}</p>}
   <p className="text-xs text-gray-500">If the price or shipping changes, you will need to review the updated quote and confirm again.</p>
  </section>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  <button type="submit" disabled={busy||!selected.length||!quote} className="w-full py-4 bg-black text-white rounded-full disabled:opacity-50">{busy?'Submitting Order…':'Submit Order with Payment Proof'}</button>
 </form></div>;
};
export default CheckoutPage;