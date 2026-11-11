import React,{useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

const DEFAULT_WHATSAPP_PHONE='+601158892234';

export function WhatsAppButton(){
 const[phone,setPhone]=useState(DEFAULT_WHATSAPP_PHONE);
 useEffect(()=>{let alive=true;supabase.from('site_settings').select('setting_value').eq('setting_key','whatsapp_support_phone').maybeSingle().then(({data})=>{if(!alive||!data)return;const value=(data.setting_value as {phone?:string}|null)?.phone;if(value)setPhone(value);});return()=>{alive=false;};},[]);
 const digits=phone.replace(/\\D/g,'');
 const message=encodeURIComponent('Hello, I would like to enquire about your products.');
 return <a href={`https://wa.me/${digits}?text=${message}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp" className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-200">
  <svg viewBox="0 0 32 32" className="h-8 w-8" fill="currentColor" aria-hidden="true"><path d="M16.02 3C8.86 3 3.04 8.8 3.04 15.94c0 2.28.6 4.5 1.74 6.47L3 29l6.77-1.77a13.1 13.1 0 0 0 6.25 1.58h.01c7.15 0 12.97-5.8 12.97-12.94A12.85 12.85 0 0 0 25.2 6.7 12.9 12.9 0 0 0 16.02 3Zm0 23.62h-.01a10.9 10.9 0 0 1-5.55-1.52l-.4-.24-4.02 1.05 1.07-3.9-.26-.4a10.73 10.73 0 0 1-1.66-5.67c0-5.96 4.86-10.8 10.84-10.8 2.9 0 5.62 1.13 7.67 3.17a10.72 10.72 0 0 1 3.18 7.65c0 5.96-4.86 10.8-10.86 10.8Zm5.95-8.1c-.33-.16-1.94-.95-2.24-1.06-.3-.11-.52-.16-.74.16-.22.33-.85 1.06-1.04 1.28-.19.22-.38.25-.71.08-.33-.16-1.38-.51-2.63-1.63-.97-.86-1.63-1.93-1.82-2.26-.19-.33-.02-.5.14-.66.15-.15.33-.38.49-.57.16-.19.22-.33.33-.55.11-.22.05-.41-.03-.57-.08-.16-.74-1.77-1.02-2.42-.27-.64-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.41-.3.33-1.14 1.11-1.14 2.71s1.17 3.14 1.33 3.36c.16.22 2.3 3.5 5.57 4.91.78.34 1.39.54 1.86.69.78.25 1.49.22 2.05.13.63-.1 1.94-.79 2.21-1.55.27-.76.27-1.41.19-1.55-.08-.14-.3-.22-.63-.38Z"/></svg>
 </a>;
}
