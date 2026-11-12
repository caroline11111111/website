import React,{useEffect,useState} from 'react';
import {siteImages} from '../config/siteConfig';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';

type AboutImage={id:string;title:string|null;alt_text:string|null;image_path:string};
export const AboutPage:React.FC=()=>{
 const[images,setImages]=useState<Array<{id:string;url:string;alt:string}>>(siteImages.aboutImages.map(img=>({id:img.id,url:img.url,alt:'About'})));
 useEffect(()=>{let alive=true;supabase.from('about_images').select('id,title,alt_text,image_path').eq('is_active',true).order('display_order').order('created_at').then(({data,error})=>{if(!alive||error||!data||data.length===0)return;setImages((data as AboutImage[]).map(img=>({id:img.id,url:supabase.storage.from('homepage-media').getPublicUrl(img.image_path).data.publicUrl,alt:img.alt_text||img.title||'About'})));});return()=>{alive=false;};},[]);
 return <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-12"><div className="text-center space-y-4"><h1 className="text-4xl font-light tracking-tight">About Our Platform</h1><p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">We specialize in curating the finest pre-owned luxury timepieces and designer handbags. Every piece in our collection is rigorously authenticated to ensure absolute luxury and peace of mind.</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{images.map(img=><div key={img.id} className="h-64 rounded-lg overflow-hidden shadow-sm"><SiteImage src={img.url} alt={img.alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/></div>)}</div></div>;
};
