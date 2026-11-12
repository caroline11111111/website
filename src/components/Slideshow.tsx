import React,{useEffect,useState} from 'react';
import {siteImages} from '../config/siteConfig';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';

type SlideData={id:string;title:string|null;subtitle:string|null;image_path:string};
export const Slideshow:React.FC=()=>{
 const[currentIndex,setCurrentIndex]=useState(0);
 const[slides,setSlides]=useState<Array<{id:string;url:string;alt:string}>>(siteImages.slideshow.map(s=>({id:s.id,url:s.url,alt:'Featured slide'})));
 useEffect(()=>{let alive=true;supabase.from('homepage_slides').select('id,title,subtitle,image_path').eq('is_active',true).order('display_order').order('created_at').then(({data,error})=>{if(!alive||error||!data||data.length===0)return;setSlides((data as SlideData[]).map(s=>({id:s.id,url:supabase.storage.from('homepage-media').getPublicUrl(s.image_path).data.publicUrl,alt:s.title||s.subtitle||'Homepage slide'})));setCurrentIndex(0);});return()=>{alive=false;};},[]);
 useEffect(()=>{if(slides.length<2)return;const timer=window.setInterval(()=>setCurrentIndex(prev=>(prev+1)%slides.length),4000);return()=>window.clearInterval(timer);},[slides.length]);
 const activeSlides=slides.length?slides:[{id:'fallback',url:siteImages.desktopBanner.url,alt:'Featured collection'}];
 return <div id="H007" className="w-full max-w-5xl mx-auto my-12 px-4"><div className="relative h-64 md:h-[450px] rounded-lg overflow-hidden shadow-md">{activeSlides.map((slide,idx)=><div key={slide.id} className={'absolute inset-0 transition-opacity duration-1000 '+(idx===currentIndex?'opacity-100':'opacity-0 pointer-events-none')}><SiteImage src={slide.url} alt={slide.alt} className="w-full h-full object-cover"/></div>)}</div></div>;
};
