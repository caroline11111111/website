import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';

export interface StoreCurrency {
  code:string;
  name:string;
  symbol:string;
  rateAgainstMYR:number;
  isActive:boolean;
}

export const DEFAULT_CURRENCIES:StoreCurrency[]=[
  {code:'MYR',name:'Malaysian Ringgit',symbol:'RM',rateAgainstMYR:1,isActive:true},
  {code:'USD',name:'US Dollar',symbol:'$',rateAgainstMYR:0.22,isActive:true},
  {code:'EUR',name:'Euro',symbol:'€',rateAgainstMYR:0.20,isActive:true},
  {code:'SGD',name:'Singapore Dollar',symbol:'S$',rateAgainstMYR:0.30,isActive:true},
];

interface CurrencyContextValue {
  currencies:StoreCurrency[];
  defaultCurrency:string;
  loading:boolean;
  formatPrice:(priceInMYR:number,currencyCode:string)=>string;
}
const CurrencyContext=createContext<CurrencyContextValue|undefined>(undefined);

export const CurrencyProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const[currencies,setCurrencies]=useState<StoreCurrency[]>(DEFAULT_CURRENCIES);
 const[defaultCurrency,setDefaultCurrency]=useState('MYR');
 const[loading,setLoading]=useState(true);
 useEffect(()=>{
  let alive=true;
  supabase.from('site_settings').select('setting_value').eq('setting_key','storefront_currency_settings').maybeSingle().then(({data,error})=>{
   if(!alive)return;
   const rawValue=data?.setting_value;
   if(!error&&rawValue&&typeof rawValue==='object'&&!Array.isArray(rawValue)){
    const value=rawValue as {defaultCurrency?:string;currencies?:unknown};
    // Database settings can be edited independently of the storefront. Validate the
    // shape before mapping so malformed JSON cannot crash the entire customer app.
    const sourceRows=Array.isArray(value.currencies)?value.currencies:[];
    const rows=sourceRows.map((entry:unknown)=>{
     const row=entry&&typeof entry==='object'?entry as Partial<StoreCurrency>:{};
     return {code:String(row.code||'').toUpperCase(),name:String(row.name||row.code||''),symbol:String(row.symbol||row.code||''),rateAgainstMYR:Number(row.rateAgainstMYR),isActive:row.isActive!==false};
    }).filter((row:StoreCurrency)=>/^[A-Z]{3}$/.test(row.code)&&Number.isFinite(row.rateAgainstMYR)&&row.rateAgainstMYR>0);
    if(rows.some((row:StoreCurrency)=>row.code==='MYR'))setCurrencies(rows);
    const selected=String(value.defaultCurrency||'MYR').toUpperCase();
    if(rows.some((row:StoreCurrency)=>row.code===selected&&row.isActive))setDefaultCurrency(selected);
   }
   setLoading(false);
  });
  return()=>{alive=false;};
 },[]);
 const value=useMemo<CurrencyContextValue>(()=>({
  currencies,defaultCurrency,loading,
  formatPrice:(priceInMYR,currencyCode)=>{
   const currency=currencies.find(row=>row.code===currencyCode&&row.isActive)||currencies.find(row=>row.code==='MYR')||DEFAULT_CURRENCIES[0];
   const converted=priceInMYR*currency.rateAgainstMYR;
   return `${currency.symbol} ${converted.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  }
 }),[currencies,defaultCurrency,loading]);
 return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
export const useCurrency=()=>{
 const context=useContext(CurrencyContext);
 if(!context)throw new Error('useCurrency must be used within CurrencyProvider');
 return context;
};
