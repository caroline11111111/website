import React, { useState, useEffect } from 'react';
import { siteImages } from '../config/siteConfig';
import { SiteImage } from './SiteImage';

export const Slideshow: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slides = siteImages.slideshow;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="w-full max-w-5xl mx-auto my-12 px-4">
      <div className="relative h-64 md:h-[450px] rounded-lg overflow-hidden shadow-md">
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentIndex ? 'opacity-100' : 'opacity-0'}`}
          >
            <SiteImage src={slide.url} alt="Slide" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
};
