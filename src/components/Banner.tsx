import React,{useEffect,useState} from 'react';
import {SiteImage} from './SiteImage';
import {supabase} from '../lib/supabase';
import {useLanguage} from '../context/LanguageContext';

type BannerData={title:string|null;description:string|null;image_path:string;mobile_image_path:string|null;link_url:string|null};
type LayoutBlock={id:string;type:string;text?:string;text_en?:string;text_zh?:string;image_path?:string;alt?:string;align?:string;height?:number;shape?:string;size?:string;x?:number;y?:number;width?:number;heightPct?:number;fontSize?:number;color?:string;background?:string;mobileX?:number;mobileY?:number;mobileWidth?:number;mobileHeight?:number};
type Layout={version?:number;blocks:LayoutBlock[];background?:string;mobileBackground?:string};

export const Banner:React.FC=()=>{ const{language}=useLanguage(); const zh=language==='zh';
 const[banner,setBanner]=useState<BannerData|null>(null);
 const[layout,setLayout]=useState<Layout|null>(null);
 const[isMobile,setIsMobile]=useState(typeof window!=='undefined'&&window.matchMedia('(max-width: 767px)').matches);

 useEffect(()=>{
  const media=window.matchMedia('(max-width: 767px)');
  const update=()=>setIsMobile(media.matches);
  update();
  media.addEventListener?.('change',update);
  return()=>media.removeEventListener?.('change',update);
 },[]);

 useEffect(()=>{
  let alive=true;
  const load=async()=>{
   const[b,l]=await Promise.all([
    supabase.from('homepage_banners').select('title,description,image_path,mobile_image_path,link_url').eq('is_active',true).order('display_order').order('created_at').limit(1).maybeSingle(),
    supabase.from('storefront_page_layouts').select('layout_json').eq('page_key','banner').eq('is_published',true).maybeSingle()
   ]);
   if(!alive)return;
   if(!b.error&&b.data)setBanner(b.data as BannerData);
   if(!l.error&&l.data?.layout_json){
    const value=l.data.layout_json as Layout;
    if(Array.isArray(value.blocks))setLayout(value);
   }
  };
  void load();
  const channel=supabase.channel('homepage-banner-layout')
   .on('postgres_changes',{event:'*',schema:'public',table:'storefront_page_layouts',filter:'page_key=eq.banner'},()=>{void load();})
   .on('postgres_changes',{event:'*',schema:'public',table:'homepage_banners'},()=>{void load();})
   .subscribe();
  return()=>{alive=false;void supabase.removeChannel(channel);};
 },[]);

 const publicUrl=(path?:string)=>path?supabase.storage.from('homepage-media').getPublicUrl(path).data.publicUrl:'';
 const renderBlock=(block:LayoutBlock)=>{
  const x=isMobile?(block.mobileX??block.x??8):(block.x??8);
  const y=isMobile?(block.mobileY??block.y??8):(block.y??8);
  const width=isMobile?(block.mobileWidth??block.width??84):(block.width??84);
  const height=isMobile?(block.mobileHeight??block.heightPct??20):(block.heightPct??20);
  const common:React.CSSProperties={position:'absolute',left:x+'%',top:y+'%',width:width+'%',height:height+'%',boxSizing:'border-box',overflow:'hidden'};
  if(block.type==='text'){const text=zh?(block.text_zh||block.text_en||block.text||''):(block.text_en||block.text||'');return <div key={block.id} style={{...common,display:'flex',alignItems:'center',justifyContent:block.align==='center'?'center':block.align==='right'?'flex-end':'flex-start',padding:8,fontSize:block.fontSize||22,color:block.color||'#292524',textAlign:(block.align||'left') as any,whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.25}}>{text}</div>;}
  if(block.type==='image')return <div key={block.id} style={common}>{block.image_path?<SiteImage src={publicUrl(block.image_path)} alt={block.alt||'Banner image'} className="h-full w-full object-cover"/>:null}</div>;
  if(block.type==='divider')return <div key={block.id} style={{...common,display:'flex',alignItems:'center',padding:'0 8px'}}><div style={{height:1,width:'100%',background:'currentColor',opacity:.4}}/></div>;
  if(block.type==='spacer')return <div key={block.id} style={{...common,height:height+'%',pointerEvents:'none'}}/>;
  if(block.type==='shape')return <div key={block.id} style={{...common,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:'100%',height:'100%',maxWidth:'100%',maxHeight:'100%',background:block.background||'rgba(255,255,255,.55)',borderRadius:block.shape==='circle'?'50%':block.shape==='triangle'?0:6,clipPath:block.shape==='triangle'?'polygon(50% 0, 0 100%, 100% 100%)':undefined}}/></div>;
  return null;
 };

 if(layout){
  const canvas=<div className="w-full overflow-hidden" style={{background:isMobile?(layout.mobileBackground||layout.background||'transparent'):(layout.background||'transparent')}}><div className="relative mx-auto w-full overflow-hidden" style={{maxWidth:isMobile?390:1100,aspectRatio:isMobile?'390 / 680':'1100 / 620',background:isMobile?(layout.mobileBackground||layout.background||'transparent'):(layout.background||'transparent')}}>{layout.blocks.map(renderBlock)}</div></div>;
  return <section className="w-full overflow-hidden" style={{background:isMobile?(layout.mobileBackground||layout.background||'#ffffff'):(layout.background||'#ffffff')}}>{banner?.link_url?<a href={banner.link_url} className="block">{canvas}</a>:canvas}</section>;
 }

 const path=isMobile?banner?.mobile_image_path||banner?.image_path:banner?.image_path;
 const image=path?publicUrl(path):'';
 const content=<div className="w-full h-72 md:h-[480px] relative">{image?<SiteImage src={image} alt={banner?.title||'Storefront banner'} className="w-full h-full object-cover opacity-85"/>:null}<div className={'absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4 '+(image?'bg-black/20':'bg-transparent')}><h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-widest uppercase mb-4 drop-shadow-md">{banner?.title||(zh?'精选奢华商品':'CURATED LUXURY COLLECTION')}</h1><p className="text-xs md:text-base font-light tracking-wider max-w-xl opacity-90 leading-relaxed drop-shadow">{banner?.description||(zh?'探索精心甄选的二手奢侈品系列。':'Discover a considered collection of pre-owned luxury pieces.')}</p></div></div>;
 return <div className="w-full relative overflow-hidden bg-transparent">{banner?.link_url?<a href={banner.link_url}>{content}</a>:content}</div>;
};
