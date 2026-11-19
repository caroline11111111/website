export type ProductCardDesign={
 style:'classic'|'editorial'|'minimal'|'luxury';
 imageRatio:'1:1'|'4:5'|'3:2';
 imageFit:'cover'|'contain';
 textAlignment:'left'|'center';
 showBrand:boolean;
 showCondition:boolean;
};
export const DEFAULT_PRODUCT_CARD_DESIGN:ProductCardDesign={style:'classic',imageRatio:'1:1',imageFit:'cover',textAlignment:'left',showBrand:true,showCondition:true};
