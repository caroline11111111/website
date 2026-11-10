import React from 'react';
import { siteImages } from '../config/siteConfig';
import { SiteImage } from './SiteImage';

export const Banner: React.FC = () => {
  return (
    <div className="w-full relative overflow-hidden bg-gray-900">
      {/* Banner 图片 */}
      <div className="w-full h-72 md:h-[480px] relative">
        <SiteImage
          src={window.innerWidth >= 768 ? siteImages.desktopBanner.url : siteImages.mobileBanner.url}
          alt="Luxury Collection Banner"
          className="w-full h-full object-cover opacity-85"
        />
        
        {/* H005 & H006: 标题与副标题覆盖层 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4 bg-black/20">
          {/* H005: Hero Title */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-widest uppercase mb-4 drop-shadow-md">
            E-LUXURY COLLECTION
          </h1>
          {/* H006: Hero Subtitle */}
          <p className="text-xs md:text-base font-light tracking-wider max-w-xl opacity-90 leading-relaxed drop-shadow">
            Curated pre-owned luxury timepieces and designer handbags. Authenticity guaranteed with flawless craftsmanship.
          </p>
        </div>
      </div>
    </div>
  );
};
