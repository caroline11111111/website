import { SiteImageItem } from './siteConfig';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: 'Handbags' | 'Watches';
  priceMYR: number;
  description: string;
  images: SiteImageItem[];
}

export const mockProducts: Product[] = [
  {
    id: 'prod-1',
    name: 'Classic Leather Tote',
    brand: 'Brand A',
    category: 'Handbags',
    priceMYR: 12800,
    description: 'A timeless handcrafted leather tote made with premium calfskin.',
    images: [
      { id: 'p1-img1', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80', alt: { en: 'Classic Leather Tote', zh: '经典皮革托特包' }, order: 1 },
      { id: 'p1-img2', url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80', alt: { en: 'Classic Leather Tote side', zh: '经典皮革托特包侧面' }, order: 2 },
      { id: 'p1-img3', url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&auto=format&fit=crop&q=80', alt: { en: 'Classic Leather Tote detail', zh: '经典皮革托特包细节' }, order: 3 },
    ],
  },
  {
    id: 'prod-2',
    name: 'Chronograph Executive Watch',
    brand: 'Brand B',
    category: 'Watches',
    priceMYR: 34500,
    description: 'Precision mechanical movement encased in brushed stainless steel.',
    images: [
      { id: 'p2-img1', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80', alt: { en: 'Chronograph Executive Watch', zh: '计时行政腕表' }, order: 1 },
      { id: 'p2-img2', url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80', alt: { en: 'Chronograph Executive Watch back', zh: '计时行政腕表背面' }, order: 2 },
    ],
  },
  {
    id: 'prod-3',
    name: 'Monogram Crossbody Bag',
    brand: 'Brand C',
    category: 'Handbags',
    priceMYR: 9800,
    description: 'Compact elegant crossbody bag with adjustable gold-chain strap.',
    images: [
      { id: 'p3-img1', url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80', alt: { en: 'Monogram Crossbody Bag', zh: '老花斜挎包' }, order: 1 },
    ],
  },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `prod-mock-${i + 4}`,
    name: `Luxury Item ${i + 4}`,
    brand: i % 2 === 0 ? 'Brand A' : 'Brand B',
    category: (i % 2 === 0 ? 'Handbags' : 'Watches') as 'Handbags' | 'Watches',
    priceMYR: 5000 + i * 1200,
    description: `Detailed description for luxury product ${i + 4}. Exceptional quality and craft.`,
    images: [
      { id: `pm-${i}-1`, url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80', alt: { en: `Luxury Item ${i + 4}`, zh: `奢侈品 ${i + 4}` }, order: 1 },
    ],
  })),
];
