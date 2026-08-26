import * as React from 'react';

type NextImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> & {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  quality?: number;
};

const Image = React.forwardRef<HTMLImageElement, NextImageProps>(
  ({ src, alt, fill, priority, quality, style, ...rest }, ref) => (
    <img
      ref={ref}
      src={src}
      alt={alt}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style } : style}
      {...rest}
    />
  )
);
Image.displayName = 'Image';

export default Image;
