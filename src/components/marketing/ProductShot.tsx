import Image from 'next/image';

/**
 * A real screenshot of the running application.
 *
 * Every image passed here is captured from the Serenity UI against the local
 * Firebase emulator with synthetic recipients — never production data, never a
 * drawn mock-up of an interface that does not exist.
 */
export function ProductShot({
  src,
  alt,
  caption,
  width,
  height,
  priority = false,
  sizes = '(min-width: 1024px) 640px, 100vw',
  className = '',
}: {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure className={`sr-shot ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        quality={82}
      />
      {caption && <figcaption className="sr-shot-caption">{caption}</figcaption>}
    </figure>
  );
}
