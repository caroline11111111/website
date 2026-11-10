import React from 'react';
import { siteImages } from '../config/siteConfig';
import { SiteImage } from './SiteImage';

export const Banner: React.FC = () => {
  return (
    <div className="w-full h-72 md:h-96 relative overflow-hidden bg-gray-900">
      <SiteImage
        src={window.innerWidth >= 768 ? siteImages.desktopBanner.url : siteImages.mobileBanner.url}
        alt="Banner"
        className="w-full h-full object-cover opacity-80"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
        <h1 className="text-3xl md:text-5xl font-light tracking-widest mb-4">E-LUXURY COLLECTION</h1>
        <p className="text-sm md:text-base tracking-wider max-w-lg opacity-90">Discover our exclusive curated pre-owned luxury timepieces and designer handbags.</p>
      </div>
    </div>
  );
};
