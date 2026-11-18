import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';

export interface StoreCurrency {
  code:string;
  name:string;
  symbol:string;
  decimalPlaces:number;
  isActive:boolean;
}

export const DEFAULT_CURRENCIES:StoreCurrency[]=[
  {code:'MYR',name:'Malaysian Ringgit',symbol:'RM',decimalPlaces:2,isActive:true},
  {code:'SGD',name:'Singapore Dollar',symbol:'S$',decimalPlaces:2,isActive:true},
  {code:'USD',name:'US Dollar',symbol:'$',decimalPlaces:2,isActive:true},
  {code:'CNY',name:'Chinese Yuan',symbol:'¥',decimalPlaces:2,isActive:true},
];

interface CurrencyContextValue {
  currencies:StoreCurrency[];
  defaultCurrency:string;
  loading:boolean;
  formatPrice:(amount:number,currencyCode:string)=>string;
}
const CurrencyContext=createContext<CurrencyContextValue|undefined>(undefined);

export const CurrencyProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const[currencies,setCurrencies]=useState<StoreCurrency[]>(DEFAULT_CURRENCIES);
 const[defaultCurrency,setDefaultCurrency]=useState('MYR');
 const[loading,setLoading]=useState(true);
 useEffect(()=>{
  let alive=true;
  supabase.from('store_currencies').select('code,name,symbol,decimal_places,is_active').order('display_order',{ascending:true}).then(({data,error})=>{
   if(!alive)return;
   if(!error&&data){
    const rows=data.map((row:any)=>({code:String(row.code||'').toUpperCase(),name:String(row.name||row.code||''),symbol:String(row.symbol||row.code||''),decimalPlaces:Number(row.decimal_places??2),isActive:row.is_active===true})).filter(row=>/^[A-Z]{3}$/.test(row.code)&&Number.isInteger(row.decimalPlaces)&&row.decimalPlaces>=0&&row.decimalPlaces<=4);
    if(rows.some(row=>row.code==='MYR')){setCurrencies(rows);const selected=String((defaultRow?.setting_value as any)?.code||'MYR').toUpperCase();if(rows.some(row=>row.code===selected&&row.isActive))setDefaultCurrency(selected);}
   }
   setLoading(false);
  });
  return()=>{alive=false;};
 },[]);
 const value=useMemo<CurrencyContextValue>(()=>({
  currencies,defaultCurrency,loading,
  formatPrice:(amount,currencyCode)=>{
   const currency=currencies.find(row=>row.code===currencyCode&&row.isActive);
   if(!currency||!Number.isFinite(amount))return 'Price unavailable';
   // Amounts passed to this formatter must already be denominated in currencyCode.
   // Never convert a MYR amount and present it as another currency.
   return `${currency.symbol} ${amount.toLocaleString(undefined,{minimumFractionDigits:currency.decimalPlaces,maximumFractionDigits:currency.decimalPlaces})}`;
  }
 }),[currencies,defaultCurrency,loading]);
 return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
export const useCurrency=()=>{
 const context=useContext(CurrencyContext);
 if(!context)throw new Error('useCurrency must be used within CurrencyProvider');
 return context;
};
