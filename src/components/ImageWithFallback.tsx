import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackTitle,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100 text-violet-800 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="w-8 h-8 mb-2 text-violet-500" aria-hidden="true" />
        <span className="text-sm font-medium text-violet-900">
          {fallbackTitle || 'Imagem indisponível'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
