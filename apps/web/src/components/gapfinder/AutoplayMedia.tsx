'use client';

import { useEffect, useRef, useState } from 'react';

interface AutoplayMediaProps {
  videoSrc: string;
  posterSrc?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function AutoplayMedia({
  videoSrc,
  posterSrc,
  alt,
  className = '',
  priority = false,
}: AutoplayMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    // Intersection Observer for autoplay/pause on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // Video is 60%+ visible, play it
            video.play().catch(() => {
              // Autoplay failed, that's okay
            });
          } else {
            // Video is out of view, pause to save resources
            video.pause();
          }
        });
      },
      {
        threshold: [0.6], // Trigger when 60% visible
        rootMargin: '0px',
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLoadedData = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-purple-100 to-blue-100 animate-pulse rounded-2xl" />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-2xl">
          <div className="text-center p-6">
            <p className="text-gray-600 font-medium">Video unavailable</p>
          </div>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className={`w-full h-full object-cover rounded-2xl transition-opacity duration-500 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        autoPlay
        loop
        muted
        playsInline
        poster={posterSrc}
        preload={priority ? 'auto' : 'metadata'}
        onLoadedData={handleLoadedData}
        onError={handleError}
        aria-label={alt}
      >
        <source src={videoSrc} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
