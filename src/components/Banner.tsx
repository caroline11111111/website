import React,{useEffect,useState} from 'react';
import {siteImages} from '../config/siteConfig';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';

type BannerData={title:string|null;description:string|null;image_path:string;mobile_image_path:string|null;link_url:string|null};
type LayoutBlock={id:string;type:string;text?:string;image_path?:string;alt?:string;align?:string;height?:number;shape?:string;size?:string};
type Layout={blocks:LayoutBlock[]};
export const Banner:React.FC=()=>{
 const[banner,setBanner]=useState<BannerData|null>(null);const[layout,setLayout]=useState<Layout|null>(null);
 useEffect(()=>{let alive=true;Promise.all([supabase.from('homepage_banners').select('title,description,image_path,mobile_image_path,link_url').eq('is_active',true).order('display_order').order('created_at').limit(1).maybeSingle(),supabase.from('storefront_page_layouts').select('layout_json').eq('page_key','banner').eq('is_published',true).maybeSingle()]).then(([b,l])=>{if(!alive)return;if(!b.error&&b.data)setBanner(b.data as BannerData);if(!l.error&&l.data?.layout_json){const value=l.data.layout_json as Layout;if(Array.isArray(value.blocks)&&value.blocks.length)setLayout(value);}});return()=>{alive=false;};},[]);
 const publicUrl=(path?:string)=>path?supabase.storage.from('homepage-media').getPublicUrl(path).data.publicUrl:'';
 const renderBlock=(block:LayoutBlock)=>{if(block.type==='text')return <div key={block.id} className="px-5 py-3 text-white text-2xl md:text-4xl font-light tracking-wide drop-shadow" style={{textAlign:(block.align||'center') as any}}>{block.text}</div>;if(block.type==='image')return block.image_path?<SiteImage key={block.id} src={publicUrl(block.image_path)} alt={block.alt||'Banner image'} className="h-full max-h-[480px] w-full object-cover"/>:null;if(block.type==='divider')return <div key={block.id} className="mx-auto my-3 h-px w-4/5 bg-current opacity-40"/>;if(block.type==='spacer')return <div key={block.id} style={{height:block.height||48}}/>;if(block.type==='shape')return <div key={block.id} className="flex justify-center p-3"><div className={block.shape==='circle'?'rounded-full':block.shape==='triangle'?'h-0 w-0 border-x-[30px] border-b-[52px] border-x-transparent border-b-white/60':'rounded'} style={block.shape==='triangle'?{}:{width:block.size==='large'?100:block.size==='small'?36:64,height:block.size==='large'?100:block.size==='small'?36:64,background:'rgba(255,255,255,.55)'}}/></div>;return null;};
 if(layout)return <div className="w-full overflow-hidden bg-slate-900"><div className="relative flex min-h-64 flex-col items-center justify-center md:min-h-[480px]">{layout.blocks.map(renderBlock)}</div></div>;
 const path=typeof window!=='undefined'&&window.innerWidth<768?banner?.mobile_image_path||banner?.image_path:banner?.image_path;
 const image=path?publicUrl(path):(typeof window!=='undefined'&&window.innerWidth<768?siteImages.mobileBanner.url:siteImages.desktopBanner.url);
 const content=<div className="w-full h-72 md:h-[480px] relative"><SiteImage src={image} alt={banner?.title||'Storefront banner'} className="w-full h-full object-cover opacity-85"/><div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4 bg-black/20"><h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-widest uppercase mb-4 drop-shadow-md">{banner?.title||'CURATED LUXURY COLLECTION'}</h1><p className="text-xs md:text-base font-light tracking-wider max-w-xl opacity-90 leading-relaxed drop-shadow">{banner?.description||'Discover a considered collection of pre-owned luxury pieces.'}</p></div></div>;
 return <div className="w-full relative overflow-hidden bg-gray-900">{banner?.link_url?<a href={banner.link_url}>{content}</a>:content}</div>;
};
