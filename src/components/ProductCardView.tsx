import React from 'react';
import {SiteImage} from './SiteImage';
import {ProductCardDesign,ThemeTextColor} from '../config/productCardDesign';
import {useTheme} from '../context/ThemeContext';

export interface ProductCardViewProps {
 design:ProductCardDesign;
 brand?:string;
 name:string;
 condition?:string;
 price:string;
 imageUrl?:string;
 onClick?:()=>void;
}
const ratioValue=(ratio:ProductCardDesign['imageRatio'])=>ratio==='4:5'?'4 / 5':ratio==='3:2'?'3 / 2':'1 / 1';
const cardClasses=(style:ProductCardDesign['style'])=>({
 classic:'bg-white rounded-lg border shadow-sm hover:shadow-md',
 editorial:'bg-white border-0 rounded-none shadow-none',
 minimal:'bg-transparent border-0 rounded-none shadow-none',
 luxury:'bg-white rounded-2xl border shadow-md hover:shadow-lg'
}[style]);

/** Shared storefront/admin product card renderer. Keep all card layout and styling here. */
export const ProductCardView:React.FC<ProductCardViewProps>=({design,brand,name,condition,price,imageUrl,onClick})=>{
 const{currentTheme}=useTheme();
 const themeColor=(mode:ThemeTextColor,custom:string)=>mode==='themeTextPrimary'?currentTheme.textPrimary:mode==='themeTextSecondary'?currentTheme.textSecondary:mode==='themeSecondary'?currentTheme.secondary:custom;
 const textAreaBackground=design.textAreaBackground==='button'?currentTheme.buttonPrimary:design.textAreaBackground==='custom'?design.textAreaCustomBackground:currentTheme.surface;
 const textAreaColor=design.textAreaTextColor==='buttonText'?currentTheme.buttonText:design.textAreaTextColor==='textPrimary'?currentTheme.textPrimary:design.textAreaCustomTextColor;
 const horizontal=design.orientation==='horizontal'||design.textPosition!=='below';
 const imageOnLeft=design.textPosition!=='left';
 const imageStyle:React.CSSProperties=horizontal
  ?{flex:'0 0 38%',minWidth:0,minHeight:'160px',aspectRatio:ratioValue(design.imageRatio)}
  :{width:'100%',aspectRatio:ratioValue(design.imageRatio)};
 return <button type="button" onClick={onClick} style={{display:'flex',flexDirection:horizontal?(imageOnLeft?'row':'row-reverse'):'column',alignItems:'stretch',backgroundColor:!horizontal?textAreaBackground:undefined,minHeight:horizontal?'160px':undefined,cursor:onClick?'pointer':'default'}} className={'w-full min-w-0 text-left overflow-hidden transition-shadow '+cardClasses(design.style)}>
  <div className="bg-transparent overflow-hidden" style={imageStyle}>
   {imageUrl?<SiteImage src={imageUrl} alt={name} className="w-full h-full" style={{objectFit:design.imageFit}}/>:<div className="w-full h-full min-h-[160px] flex items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300"><div className="w-2/3 h-3/4 rounded-[30%_30%_12%_12%] border border-stone-400/50 bg-gradient-to-br from-stone-400 to-stone-600 shadow-xl flex items-center justify-center"><span className="text-white/70 text-3xl">✦</span></div></div>}
  </div>
  <div className={'min-w-0 flex-1 p-4 space-y-2 '+(horizontal?'self-center':'')+(design.textAlignment==='center'?' text-center':' text-left')} style={{backgroundColor:textAreaBackground,color:textAreaColor}}>
   {design.showBrand&&brand&&<span className="block text-[10px] uppercase tracking-wider" style={{color:themeColor(design.brandTextColor,design.brandTextCustomColor)}}>{brand}</span>}
   <h3 className="text-sm font-semibold" style={{color:themeColor(design.productNameColor,design.productNameCustomColor)}}>{name}</h3>
   {design.showCondition&&condition&&<p className="text-xs" style={{color:themeColor(design.conditionTextColor,design.conditionTextCustomColor)}}>{condition}</p>}
   <p className="text-sm font-bold" style={{color:themeColor(design.priceTextColor,design.priceTextCustomColor)}}>{price}</p>
  </div>
 </button>;
};
