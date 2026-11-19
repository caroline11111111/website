export type ProductCardDesign={
 style:'classic'|'editorial'|'minimal'|'luxury';
 orientation:'vertical'|'horizontal';
 imageRatio:'1:1'|'4:5'|'3:2';
 imageFit:'cover'|'contain';
 textAlignment:'left'|'center';
 showBrand:boolean;
 showCondition:boolean;
};
export const DEFAULT_PRODUCT_CARD_DESIGN:ProductCardDesign={style:'classic',orientation:'vertical',imageRatio:'1:1',imageFit:'cover',textAlignment:'left',showBrand:true,showCondition:true};
