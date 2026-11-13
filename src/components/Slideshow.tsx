import React, { useEffect, useState } from 'react';
import { siteImages } from '../config/siteConfig';
import { SiteImage } from './SiteImage';
import { supabase } from '../lib/supabase';

type SlideData = { id: string; title: string | null; subtitle: string | null; image_path: string };

type Slide = { id: string; url: string; alt: string };

export const Slideshow: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(
    siteImages.slideshow.map((slide) => ({ id: slide.id, url: slide.url, alt: 'Featured slide' }))
  );

  useEffect(() => {
    let alive = true;

    supabase
      .from('homepage_slides')
      .select('id,title,subtitle,image_path')
      .eq('is_active', true)
      .order('display_order')
      .order('created_at')
      .then(({ data, error }) => {
        if (!alive || error || !data || data.length === 0) return;

        setSlides(
          (data as SlideData[]).map((slide) => ({
            id: slide.id,
            url: supabase.storage.from('homepage-media').getPublicUrl(slide.image_path).data.publicUrl,
            alt: slide.title || slide.subtitle || 'Homepage slide',
          }))
        );
        setCurrentIndex(0);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((previous) => (previous + 1) % slides.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  const activeSlides = slides.length
    ? slides
    : [{ id: 'fallback', url: siteImages.desktopBanner.url, alt: 'Featured collection' }];

  const showControls = activeSlides.length > 1;
  const goToPrevious = () => {
    setCurrentIndex((previous) => (previous - 1 + activeSlides.length) % activeSlides.length);
  };
  const goToNext = () => {
    setCurrentIndex((previous) => (previous + 1) % activeSlides.length);
  };

  return (
    <div id="H007" className="w-full max-w-5xl mx-auto my-12 px-4">
      <div className="relative h-64 md:h-[450px] rounded-lg overflow-hidden shadow-md">
        {activeSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={
              'absolute inset-0 transition-opacity duration-1000 ' +
              (index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none')
            }
            aria-hidden={index !== currentIndex}
          >
            <SiteImage src={slide.url} alt={slide.alt} className="w-full h-full object-cover" />
          </div>
        ))}

        {showControls && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-full bg-black/35 text-white text-2xl leading-none backdrop-blur-sm transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToNext}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 grid h-10 w-10 md:h-12 md:w-12 place-items-center rounded-full bg-black/35 text-white text-2xl leading-none backdrop-blur-sm transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
            >
              ›
            </button>
          </>
        )}
      </div>

      {showControls && (
        <div className="mt-4 flex items-center justify-center gap-2.5" aria-label="Choose slide">
          {activeSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : undefined}
              className={
                'h-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black ' +
                (index === currentIndex ? 'w-7 bg-black' : 'w-2.5 bg-gray-300 hover:bg-gray-500')
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
