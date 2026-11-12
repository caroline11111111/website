import React,{useEffect,useState} from 'react';
import {siteImages} from '../config/siteConfig';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';

type BannerData={title:string|null;description:string|null;image_path:string;mobile_image_path:string|null;link_url:string|null};
export const Banner:React.FC=()=>{
 const[banner,setBanner]=useState<BannerData|null>(null);
 useEffect(()=>{let alive=true;supabase.from('homepage_banners').select('title,description,image_path,mobile_image_path,link_url').eq('is_active',true).order('display_order').order('created_at').limit(1).maybeSingle().then(({data,error})=>{if(alive&&!error&&data)setBanner(data as BannerData);});return()=>{alive=false;};},[]);
 const path=typeof window!=='undefined'&&window.innerWidth<768?banner?.mobile_image_path||banner?.image_path:banner?.image_path;
 const image=path?supabase.storage.from('homepage-media').getPublicUrl(path).data.publicUrl:(typeof window!=='undefined'&&window.innerWidth<768?siteImages.mobileBanner.url:siteImages.desktopBanner.url);
 const content=<div className="w-full h-72 md:h-[480px] relative"><SiteImage src={image} alt={banner?.title||'Storefront banner'} className="w-full h-full object-cover opacity-85"/><div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4 bg-black/20"><h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-widest uppercase mb-4 drop-shadow-md">{banner?.title||'CURATED LUXURY COLLECTION'}</h1><p className="text-xs md:text-base font-light tracking-wider max-w-xl opacity-90 leading-relaxed drop-shadow">{banner?.description||'Discover a considered collection of pre-owned luxury pieces.'}</p></div></div>;
 return <div className="w-full relative overflow-hidden bg-gray-900">{banner?.link_url?<a href={banner.link_url}>{content}</a>:content}</div>;
};
