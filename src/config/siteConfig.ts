export interface SiteImageItem {
  id: string;
  url: string;
  alt: { en: string; zh: string };
  order: number;
}

export const siteImages = {
  logo: {
    id: 'logo',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80',
    alt: { en: 'Brand Logo', zh: '品牌标志' },
  },
  desktopBanner: {
    id: 'desktopBanner',
    url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1440&auto=format&fit=crop&q=80',
    alt: { en: 'Desktop Promotion Banner', zh: '桌面端促销横幅' },
  },
  mobileBanner: {
    id: 'mobileBanner',
    url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
    alt: { en: 'Mobile Promotion Banner', zh: '移动端促销横幅' },
  },
  slideshow: [
    {
      id: 'slide-1',
      url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80',
      alt: { en: 'Slide 1', zh: '轮播图 1' },
      order: 1,
    },
    {
      id: 'slide-2',
      url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
      alt: { en: 'Slide 2', zh: '轮播图 2' },
      order: 2,
    },
    {
      id: 'slide-3',
      url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop&q=80',
      alt: { en: 'Slide 3', zh: '轮播图 3' },
      order: 3,
    },
  ] as SiteImageItem[],
  aboutImages: [
    {
      id: 'about-1',
      url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
      alt: { en: 'About us image 1', zh: '关于我们图片 1' },
      order: 1,
    },
    {
      id: 'about-2',
      url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
      alt: { en: 'About us image 2', zh: '关于我们图片 2' },
      order: 2,
    },
    {
      id: 'about-3',
      url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop&q=80',
      alt: { en: 'About us image 3', zh: '关于我们图片 3' },
      order: 3,
    },
  ] as SiteImageItem[],
  uploadValidation: {
    allowedFormats: ['image/png', 'image/jpeg', 'image/webp'],
    maxImageSizeMB: 5,
    maxSlots: {
      slideshow: 5,
      product: 5,
      about: 10,
    },
  },
};
