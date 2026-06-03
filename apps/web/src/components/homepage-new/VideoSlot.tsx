'use client';

import { useEffect, useRef } from 'react';

interface VideoSlotProps {
  label: string;
  ratio?: string;
  note?: string;
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
  videoSrc?: string;
  posterSrc?: string;
  alt?: string;
}

export function VideoSlot({
  label,
  ratio = "16/9",
  note,
  theme = "light",
  className = "",
  style = {},
  videoSrc,
  posterSrc,
  alt,
}: VideoSlotProps) {
  const isDark = theme === "dark";
  const stripeA = isDark ? "#2A2433" : "#F3F0FA";
  const stripeB = isDark ? "#241E2B" : "#EDE8F6";
  const textColor = isDark ? "#A89DB8" : "#8A7FA0";
  const labelColor = isDark ? "#E6E2EF" : "#3A2E55";
  const borderColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(60,40,100,0.08)";

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoSrc || !videoRef.current) return;

    const video = videoRef.current;

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
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Video is 50%+ visible, play it
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
        threshold: [0.5],
        rootMargin: '0px',
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [videoSrc]);

  // If video source is provided, render video instead of placeholder
  if (videoSrc) {
    return (
      <div
        className={`video-slot ${className}`}
        style={{
          aspectRatio: ratio,
          position: "relative",
          width: "100%",
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${borderColor}`,
          ...style,
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          loop
          muted
          playsInline
          poster={posterSrc}
          preload="auto"
          aria-label={alt || label}
        >
          <source src={videoSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  // Otherwise, render the placeholder
  return (
    <div
      className={`video-slot ${className}`}
      style={{
        aspectRatio: ratio,
        position: "relative",
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        background: `repeating-linear-gradient(135deg, ${stripeA} 0 14px, ${stripeB} 14px 28px)`,
        border: `1px solid ${borderColor}`,
        ...style,
      }}
    >
      {/* Center caption */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px 32px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
            borderRadius: 999,
            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            letterSpacing: 0.4,
            color: textColor,
            textTransform: "uppercase",
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            style={{ width: 8, height: 8, borderRadius: 999, background: "#7C3AED" }}
          />
          mp4 / gif placeholder
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 13,
            color: labelColor,
            fontWeight: 500,
            maxWidth: 420,
            lineHeight: 1.45,
          }}
        >
          {label}
        </div>
        {note && (
          <div
            style={{
              marginTop: 6,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11,
              color: textColor,
              lineHeight: 1.5,
              maxWidth: 360,
            }}
          >
            {note}
          </div>
        )}
      </div>
      {/* corner play affordance */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: textColor,
          letterSpacing: 0.4,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(124,58,237,0.12)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 0.5L7 4L1 7.5V0.5Z" fill="#7C3AED" />
          </svg>
        </span>
        00:00 / 00:24
      </div>
    </div>
  );
}
