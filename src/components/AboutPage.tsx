import React from 'react';
import { siteImages } from '../config/siteConfig';
import { SiteImage } from './SiteImage';

export const AboutPage: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-light tracking-tight">About Our Platform</h1>
        <p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
          We specialize in curating the finest pre-owned luxury timepieces and designer handbags. Every piece in our collection is rigorously authenticated to ensure absolute luxury and peace of mind.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {siteImages.aboutImages.map(img => (
          <div key={img.id} className="h-64 rounded-lg overflow-hidden shadow-sm">
            <SiteImage src={img.url} alt="About" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          </div>
        ))}
      </div>
    </div>
  );
};
