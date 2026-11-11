import React,{useEffect,useState} from 'react';
import {siteImages,SiteImageItem} from '../config/siteConfig';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';
export const Slideshow:React.FC=()=>{
 const[currentIndex,setCurrentIndex]=useState(0);const[slides,setSlides]=useState<SiteImageItem[]>(siteImages.slideshow);
 useEffect(()=>{let alive=true;supabase.from('homepage_slides').select('id,title,image_path,display_order').eq('is_active',true).order('display_order').then(({data})=>{if(!alive||!data?.length)return;setSlides(data.map((s:any)=>({id:s.id,url:supabase.storage.from('homepage-media').getPublicUrl(s.image_path).data.publicUrl,alt:{en:s.title||'Storefront slide',zh:s.title||'首页轮播'},order:s.display_order})));});return()=>{alive=false;};},[]);
 useEffect(()=>{if(slides.length<2)return;const timer=window.setInterval(()=>setCurrentIndex(prev=>(prev+1)%slides.length),4000);return()=>window.clearInterval(timer);},[slides.length]);
 useEffect(()=>{if(currentIndex>=slides.length)setCurrentIndex(0);},[currentIndex,slides.length]);
 const prev=()=>setCurrentIndex(i=>i===0?slides.length-1:i-1);const next=()=>setCurrentIndex(i=>(i+1)%slides.length);
 return <div id="H007" className="w-full max-w-5xl mx-auto my-12 px-4 relative group"><div className="relative h-64 md:h-[450px] rounded-lg overflow-hidden shadow-md">{slides.map((s,i)=><div key={s.id} className={'absolute inset-0 transition-opacity duration-1000 '+(i===currentIndex?'opacity-100':'opacity-0 pointer-events-none')}><SiteImage src={s.url} alt={s.alt.en} className="w-full h-full object-cover"/></div>)}</div>{slides.length>1&&<><button onClick={prev} className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100" aria-label="Previous slide">‹</button><button onClick={next} className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100" aria-label="Next slide">›</button><div className="flex justify-center gap-2 mt-4">{slides.map((s,i)=><button key={s.id} onClick={()=>setCurrentIndex(i)} className={'w-3 h-3 rounded-full '+(i===currentIndex?'bg-black w-6':'bg-gray-300')} aria-label={'Go to slide '+(i+1)}/>)}</div></>}</div>;
};
