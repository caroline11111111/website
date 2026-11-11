import React,{useEffect,useState} from 'react';
import {siteImages,SiteImageItem} from '../config/siteConfig';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';
export const AboutPage:React.FC=()=>{
 const[images,setImages]=useState<SiteImageItem[]>(siteImages.aboutImages);
 useEffect(()=>{let alive=true;supabase.from('about_images').select('id,title,image_path,alt_text,display_order').eq('is_active',true).order('display_order').then(({data})=>{if(!alive||!data?.length)return;setImages(data.map((x:any)=>({id:x.id,url:supabase.storage.from('homepage-media').getPublicUrl(x.image_path).data.publicUrl,alt:{en:x.alt_text||x.title||'About us',zh:x.alt_text||x.title||'关于我们'},order:x.display_order})));});return()=>{alive=false;};},[]);
 return <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-12"><div className="text-center space-y-4"><h1 className="text-4xl font-light tracking-tight">About Our Store</h1><p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">We curate pre-owned luxury pieces with care, offering customers a thoughtful way to discover exceptional handbags and timepieces.</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{images.map(img=><div key={img.id} className="h-64 rounded-lg overflow-hidden shadow-sm"><SiteImage src={img.url} alt={img.alt.en} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/></div>)}</div></div>;
};
