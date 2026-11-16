import { getImageProps } from "next/image";

/**
 * Art-directed hero image: phones (< 1024px) get the admin "mobile" banner when one is set,
 * larger screens the desktop banner. One <picture>, so the browser downloads only the image it
 * shows. The box takes the image's own shape (no crop, no empty bands), capped in height.
 */
export function HeroBannerImage({
  desktopSrc,
  mobileSrc,
  alt,
}: {
  desktopSrc: string;
  mobileSrc?: string | null;
  alt: string;
}) {
  const common = { alt, width: 1600, height: 1200, quality: 85, preload: true } as const;
  const {
    props: { srcSet: desktopSrcSet, ...desktopProps },
  } = getImageProps({ ...common, src: desktopSrc, sizes: "(max-width: 1279px) 46vw, 600px" });
  const mobile = mobileSrc
    ? getImageProps({ ...common, src: mobileSrc, sizes: "100vw" }).props
    : null;

  return (
    <picture>
      {mobile ? <source media="(max-width: 1023px)" srcSet={mobile.srcSet} sizes="100vw" /> : null}
      <source media="(min-width: 1024px)" srcSet={desktopSrcSet} sizes={desktopProps.sizes} />
      <img
        {...desktopProps}
        srcSet={desktopSrcSet}
        alt={alt}
        width={undefined}
        height={undefined}
        className="block h-auto max-h-[70vh] w-full object-cover object-center lg:aspect-[4/3] lg:max-h-none dark:brightness-90"
      />
    </picture>
  );
}
