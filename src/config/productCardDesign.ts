export type ThemeTextColor='themeTextPrimary'|'themeTextSecondary'|'themeSecondary'|'custom';
export type ProductCardDesign={
 style:'classic'|'editorial'|'minimal'|'luxury';
 orientation:'vertical'|'horizontal';textPosition:'below'|'left'|'right';
 imageRatio:'1:1'|'4:5'|'3:2';
 imageFit:'cover'|'contain';
 textAlignment:'left'|'center';
 showBrand:boolean;
 showCondition:boolean;
 brandTextColor:ThemeTextColor;
 brandTextCustomColor:string;
 productNameColor:ThemeTextColor;
 productNameCustomColor:string;
 conditionTextColor:ThemeTextColor;
 conditionTextCustomColor:string;
 priceTextColor:ThemeTextColor;
 priceTextCustomColor:string;
 textAreaBackground:'surface'|'button'|'custom';
 textAreaCustomBackground:string;
 textAreaTextColor:'buttonText'|'textPrimary'|'custom';
 textAreaCustomTextColor:string;
};
export const DEFAULT_PRODUCT_CARD_DESIGN:ProductCardDesign={
 style:'classic',orientation:'vertical',textPosition:'below',imageRatio:'1:1',imageFit:'cover',textAlignment:'left',showBrand:true,showCondition:true,
 brandTextColor:'themeTextSecondary',brandTextCustomColor:'#6b625b',
 productNameColor:'themeTextPrimary',productNameCustomColor:'#2d2926',
 conditionTextColor:'themeTextSecondary',conditionTextCustomColor:'#6b625b',
 priceTextColor:'themeTextPrimary',priceTextCustomColor:'#2d2926',
 textAreaBackground:'surface',textAreaCustomBackground:'#fffdfb',
 textAreaTextColor:'textPrimary',textAreaCustomTextColor:'#2d2926'
};