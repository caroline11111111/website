import React, { useEffect, useState } from 'react';

interface SiteImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackUrl?: string;
}

export const SiteImage: React.FC<SiteImageProps> = ({ src, fallbackUrl, alt, ...props }) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(src);
  useEffect(() => { setImgSrc(src); }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt || 'Image'}
      onError={() => {
        if (fallbackUrl && imgSrc !== fallbackUrl) {
          setImgSrc(fallbackUrl);
        } else {
          setImgSrc(undefined);
        }
      }}
      {...props}
    />
  );
};
