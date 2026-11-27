import React,{useEffect,useMemo,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {useCart} from '../context/CartContext';
import {useCurrency} from '../context/CurrencyContext';
import {supabase} from '../lib/supabase';
import {useLanguage} from '../context/LanguageContext';
import {cleanupUnlinkedPaymentProof} from '../lib/cleanupUnlinkedPaymentProof';
interface CheckoutPageProps{selectedCurrency:string;selectedItemIds:string[];onOrderComplete:()=>void;}
const MALAYSIA_REGIONS=[{code:'JHR',name:'Johor'},{code:'KDH',name:'Kedah'},{code:'KTN',name:'Kelantan'},{code:'MLK',name:'Melaka'},{code:'NSN',name:'Negeri Sembilan'},{code:'PHG',name:'Pahang'},{code:'PNG',name:'Penang'},{code:'PRK',name:'Perak'},{code:'PLS',name:'Perlis'},{code:'SGR',name:'Selangor'},{code:'TRG',name:'Terengganu'},{code:'KUL',name:'Kuala Lumpur'},{code:'LBN',name:'Labuan'},{code:'PJY',name:'Putrajaya'},{code:'SBH',name:'Sabah'},{code:'SWK',name:'Sarawak'}];
const normalizeMalaysiaRegion=(value:string)=>{const v=(value||'').trim().toLowerCase();const found=MALAYSIA_REGIONS.find(x=>x.code.toLowerCase()===v||x.name.toLowerCase()===v||(x.name==='Penang'&&v==='pulau pinang'));return found?.code||value;};
const getCheckoutErrorMessage=(err:unknown):string=>{
 if(typeof err==='string')return err;
 if(err&&typeof err==='object'){
  const value=err as {message?:unknown;details?:unknown;hint?:unknown;code?:unknown};
  const message=typeof value.message==='string'?value.message:'';
  const details=typeof value.details==='string'?value.details:'';
  const hint=typeof value.hint==='string'?value.hint:'';
  const code=typeof value.code==='string'?value.code:'';
  return [message,details,hint,code?(`Reference: ${code}`):''].filter(Boolean).join(' — ')||'An unexpected error occurred.';
 }
 return 'An unexpected error occurred.';
};
const explainCheckoutError=(message:string,proofUploaded:boolean):string=>{
 const lower=message.toLowerCase();
 let explanation=message;
 if(lower.includes('insufficient stock'))explanation=`Insufficient stock. ${message.replace(/insufficient stock for product/i,'').trim()} Please reduce the quantity or contact support to confirm availability.`;
 else if(lower.includes('shipping is not available'))explanation='Shipping is not available for this address. Please check your country and state / region, or contact support.';
 else if(lower.includes('shipping rate is missing')||lower.includes('shipping rate changed'))explanation='A valid shipping rate is not configured for this destination and package weight. Please contact support before trying again.';
 else if(lower.includes('price or shipping changed'))explanation='The product price or shipping fee has changed. Please review the updated checkout total and confirm again.';
 else if(lower.includes('payment proof'))explanation=`Payment proof issue: ${message}`;
 else if(lower.includes('selected cart')||lower.includes('cart items'))explanation='Your selected cart items have changed. Please return to your bag, refresh it, and review the items.';
 else if(lower.includes('authentication required'))explanation='Your session has expired. Please sign in again before submitting your order.';
 return proofUploaded
  ? `Order was not created. ${explanation} Your payment receipt has already uploaded successfully and is being retained; do not upload it again. Correct the issue and retry, or contact support if you are unsure.`
  : `Order was not created. ${explanation}`;
};
export const CheckoutPage:React.FC<CheckoutPageProps>=({selectedCurrency,selectedItemIds,onOrderComplete})=>{
 const{formatPrice,convertFromMYR}=useCurrency(); const{language}=useLanguage(); const zh=language==='zh';const{user}=useAuth();const{items,refresh}=useCart();
 const[recipientName,setRecipientName]=useState(user?.name||'');const[phone,setPhone]=useState(user?.phone||'');
 const[line1,setLine1]=useState('');const[line2,setLine2]=useState('');const[city,setCity]=useState('');
 const[region,setRegion]=useState('');const[postal,setPostal]=useState('');const[country,setCountry]=useState('MY');
 const[file,setFile]=useState<File|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 const[uploadedProofPath,setUploadedProofPath]=useState<string|null>(null);
 const[idempotencyKey,setIdempotencyKey]=useState<string|null>(null);
 const[quote,setQuote]=useState<any>(null);const[quoteError,setQuoteError]=useState('');const[whatsappPhone,setWhatsappPhone]=useState('+601158892234');
 const selected=useMemo(()=>items.filter(i=>selectedItemIds.includes(i.id)),[items,selectedItemIds]);
 const hasAllPrices=selected.every(i=>convertFromMYR(i.priceMYR,selectedCurrency)!==null);const subtotal=selected.reduce((sum,i)=>sum+(convertFromMYR(i.priceMYR,selectedCurrency)||0)*i.quantity,0);
 useEffect(()=>{let alive=true;if(!user||!selectedItemIds.length){setQuote(null);setQuoteError('');return;}
  supabase.rpc('quote_shipping_currency',{p_cart_item_ids:selectedItemIds,p_country_code:country,p_region_code:region||null,p_currency_code:selectedCurrency}).then(({data,error})=>{if(!alive)return;if(error){setQuote(null);setQuoteError(error.message);}else{setQuote(data);setQuoteError('');}});
  return()=>{alive=false;};
 },[user,selectedItemIds.join(','),country,region,selectedCurrency]);
 useEffect(()=>{let alive=true;supabase.from('site_settings').select('setting_value').eq('setting_key','whatsapp_support_phone').maybeSingle().then(({data})=>{if(!alive||!data?.setting_value)return;const phone=(data.setting_value as {phone?:string}|null)?.phone;if(phone)setWhatsappPhone(phone);});return()=>{alive=false;};},[]);
 useEffect(()=>{if(!user)return;supabase.from('customer_addresses').select('*').eq('user_id',user.id).eq('is_default',true).maybeSingle().then(({data})=>{if(data){setRecipientName(data.recipient_name);setPhone(data.phone);setLine1(data.address_line_1);setLine2(data.address_line_2||'');setCity(data.city);setRegion((data.country_code||'').toUpperCase()==='MY'?normalizeMalaysiaRegion(data.state_region||''):(data.state_region||''));setPostal(data.postal_code||'');setCountry(data.country_code);}});},[user]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');
  if(!user){setError('Please sign in before checkout.');return;}if(!selected.length){setError('Please return to your bag and select items.');return;}
  if(!hasAllPrices){setError(`One or more selected items do not have a ${selectedCurrency} price configured.`);return;}if(!quote){setError(quoteError||'Please wait for a valid shipping quote before submitting.');return;}if(!whatsappPhone.replace(/\D/g,'')){setError('WhatsApp customer service is currently unavailable. Please contact the store through another support channel.');return;}
  if(!file){setError('Please upload your payment proof before placing the order.');return;}
  if(file.size>5242880){setError('Payment proof must not exceed 5MB.');return;}
  if(!['image/jpeg','image/png','application/pdf'].includes(file.type)){setError('Only JPG, PNG, or PDF files are accepted.');return;}
  setBusy(true);
  let proofPathForAttempt=uploadedProofPath;
  try{
   if(!proofPathForAttempt){
    const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'pdf';
    proofPathForAttempt=user.id+'/'+crypto.randomUUID()+'.'+ext;
    const{error:uploadError}=await supabase.storage.from('payment-proofs').upload(proofPathForAttempt,file,{contentType:file.type,upsert:false});
    if(uploadError)throw uploadError;
    setUploadedProofPath(proofPathForAttempt);
   }
   const requestKey=idempotencyKey||crypto.randomUUID();
   if(!idempotencyKey)setIdempotencyKey(requestKey);
   const{error:submitError}=await supabase.rpc('submit_order_confirmed_currency',{
    p_cart_item_ids:selectedItemIds,p_recipient_name:recipientName,p_recipient_phone:phone,
    p_shipping_address:{address_line_1:line1,address_line_2:line2,city,region_code:region,postal_code:postal,country_code:country},
    p_payment_proof_path:proofPathForAttempt,p_original_filename:file.name,p_mime_type:file.type,p_file_size:file.size,
    p_currency_code:selectedCurrency,p_expected_subtotal:Number(quote.subtotal),p_expected_shipping_fee:Number(quote.shipping_fee),
    p_idempotency_key:requestKey
   });
   if(submitError)throw submitError;
   await refresh();onOrderComplete();
  }catch(err){
   const message=getCheckoutErrorMessage(err);
   setError(explainCheckoutError(message,Boolean(proofPathForAttempt)));
  }finally{setBusy(false);}
 };
 if(!user)return <div className="max-w-2xl mx-auto px-6 py-16 text-center">{zh?'请先登录以继续结账。':'Please sign in to continue checkout.'}</div>;
 return <div className="w-full max-w-3xl mx-auto px-6 py-12"><h1 className="text-3xl font-light mb-8">{zh?'结账':'Checkout'}</h1><form onSubmit={submit} className="space-y-6 bg-white p-8 rounded-lg border shadow-sm">
  <section className="space-y-4"><h2 className="font-semibold">{zh?'收件人资料':'Recipient Details'}</h2>
   <label className="block text-sm">{zh?'收件人姓名':'Recipient Name'}<input required value={recipientName} onChange={e=>setRecipientName(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
   <label className="block text-sm">{zh?'电话号码':'Phone Number'}<input required value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
  </section>
  <section className="space-y-4 border-t pt-5"><h2 className="font-semibold">{zh?'收货地址':'Shipping Address'}</h2>
   <label className="block text-sm">{zh?'地址第一行':'Address Line 1'}<input required value={line1} onChange={e=>setLine1(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
   <label className="block text-sm">{zh?'地址第二行':'Address Line 2'}<input value={line2} onChange={e=>setLine2(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <label className="block text-sm">{zh?'城市':'City'}<input required value={city} onChange={e=>setCity(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
    <label className="block text-sm">{zh?'州属／地区':'State / Region'}{country.trim().toUpperCase()==='MY'?<select required value={region} onChange={e=>setRegion(e.target.value)} className="mt-1 w-full border rounded p-3"><option value="">{zh?'选择州属／地区':'Select state / region'}</option>{MALAYSIA_REGIONS.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>:<input value={region} onChange={e=>setRegion(e.target.value)} placeholder={zh?'输入州属／地区':'Enter state / region'} className="mt-1 w-full border rounded p-3"/>}</label>
    <label className="block text-sm">{zh?'邮政编码':'Postal Code'}<input value={postal} onChange={e=>setPostal(e.target.value)} className="mt-1 w-full border rounded p-3"/></label>
    <label className="block text-sm">{zh?'国家代码':'Country Code'}<input required maxLength={2} value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} className="mt-1 w-full border rounded p-3"/></label>
   </div>
  </section>
  <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{zh?'通过 WhatsApp 获取银行转账资料':'Bank Transfer via WhatsApp'} · {selectedCurrency}</h2><p className="text-sm text-gray-600">{zh?'请通过 WhatsApp 联系客服，获取所选货币的银行账户资料。我们的团队会协助您完成转账，然后再提交付款凭证。':'Please contact our customer service on WhatsApp to receive the bank account details for your selected currency. Our team will assist you with the transfer before you submit your payment receipt.'}</p><a href={`https://wa.me/${whatsappPhone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi, I would like to request bank transfer details for my ${selectedCurrency} checkout.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full bg-[#25D366] px-6 py-3 text-sm font-medium text-white hover:opacity-90">{zh?'通过 WhatsApp 获取银行资料':'Get Bank Details on WhatsApp'}</a></section>
  <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{zh?'付款凭证':'Payment Proof'}</h2><p className="text-xs text-gray-500">{zh?'上传付款收据（JPG、PNG 或 PDF；最大 5MB）。上传收据不代表付款已获确认，团队将进行人工审核。':'Upload your payment receipt (JPG, PNG, or PDF; maximum 5MB). Uploading a receipt does not confirm payment. Our team will review it manually.'}</p><input type="file" required disabled={busy} accept="image/jpeg,image/png,application/pdf" onChange={e=>{const nextFile=e.target.files?.[0]||null;const previousPath=uploadedProofPath;setFile(nextFile);setUploadedProofPath(null);setIdempotencyKey(null);setError('');if(previousPath)void cleanupUnlinkedPaymentProof(previousPath);}} className="block w-full text-sm"/>{uploadedProofPath&&<p className="text-xs text-green-700">Payment receipt uploaded and retained for this checkout attempt. It will not be uploaded again when you retry.</p>}</section>
  <section className="border-t pt-5 space-y-3"><h2 className="font-semibold">{zh?'已选商品':'Selected Items'}</h2>
   {selected.map(i=><div key={i.id} className="flex justify-between text-sm"><span>{i.name} × {i.quantity}</span><span>{convertFromMYR(i.priceMYR,selectedCurrency)!==null?formatPrice((convertFromMYR(i.priceMYR,selectedCurrency)||0)*i.quantity,selectedCurrency):'Price not configured'}</span></div>)}
   <div className="border-t pt-3 flex justify-between font-semibold"><span>{zh?'商品小计':'Subtotal'}</span><span>{quote?formatPrice(Number(quote.subtotal),selectedCurrency):hasAllPrices?formatPrice(subtotal,selectedCurrency):'Price not configured'}</span></div>
   <div className="flex justify-between text-sm"><span>{zh?'运费':'Shipping'}</span><span>{quote?formatPrice(Number(quote.shipping_fee),selectedCurrency):'—'}</span></div>
   <div className="flex justify-between font-bold text-lg"><span>{zh?'总计':'Total'}</span><span>{quote?formatPrice(Number(quote.total),selectedCurrency):'—'}</span></div>
   {quoteError&&<p className="text-xs text-red-600">{quoteError}</p>}
   <p className="text-xs text-gray-500">{zh?'如商品价格或运费发生变化，您需要重新检查报价并确认。':'If the price or shipping changes, you will need to review the updated quote and confirm again.'}</p>
  </section>
  {!hasAllPrices&&<p role="status" className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">One or more selected products cannot be priced in {selectedCurrency}. Please check that the currency is active and its exchange rate is configured.</p>}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  <button type="submit" disabled={busy||!selected.length||!hasAllPrices||!quote||!whatsappPhone.replace(/\D/g,'')} className="w-full py-4 bg-black text-white rounded-full disabled:opacity-50">{busy?(zh?'正在提交订单…':'Submitting Order…'):(zh?'提交订单及付款凭证':'Submit Order with Payment Proof')}</button>
 </form></div>;
};
export default CheckoutPage;
