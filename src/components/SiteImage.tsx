import React, { useState } from 'react';

interface SiteImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackUrl?: string;
}

export const SiteImage: React.FC<SiteImageProps> = ({ src, fallbackUrl, alt, ...props }) => {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <img
      src={imgSrc}
      alt={alt || 'Image'}
      onError={() => {
        if (fallbackUrl && imgSrc !== fallbackUrl) {
          setImgSrc(fallbackUrl);
        } else {
          setImgSrc('https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop&q=80');
        }
      }}
      {...props}
    />
  );
};
