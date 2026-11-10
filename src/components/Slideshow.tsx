import React, { useState, useEffect } from 'react';
import { siteImages } from '../config/siteConfig';
import { SiteImage } from './SiteImage';

export const Slideshow: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slides = siteImages.slideshow;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <div id="H007" className="w-full max-w-5xl mx-auto my-12 px-4 relative group">
      {/* H007: 轮播容器 */}
      <div className="relative h-64 md:h-[450px] rounded-lg overflow-hidden shadow-md">
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              idx === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <SiteImage src={slide.url} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* H008: 左右切换箭头按钮 */}
      <button
        onClick={goToPrev}
        className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        aria-label="Previous Slide"
      >
        &#10094;
      </button>
      <button
        onClick={goToNext}
        className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        aria-label="Next Slide"
      >
        &#10095;
      </button>

      {/* H009: 圆点指示器 */}
      <div className="flex justify-center space-x-2.5 mt-4">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-3 h-3 rounded-full transition-all ${
              idx === currentIndex ? 'bg-black w-6' : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
