/**
 * Single-element GPU flying thumbnail animation from product trigger/image to header bag icon.
 * Runs exclusively on desktop fine-pointer devices when reduced motion is off and hardware is capable.
 */
export function flyThumbnailToBag(sourceEl: HTMLElement | null, imageUrl: string | null): void {
  if (typeof window === "undefined" || !sourceEl || !imageUrl) return;
  if (window.innerWidth < 1024) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia?.("(hover: none), (pointer: coarse)").matches) return;
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4) {
    return;
  }

  const targetEl = document.querySelector<HTMLElement>('[data-cart-bag-target="true"]');
  if (!targetEl) return;

  const card = sourceEl.closest("article");
  const imgContainer = card?.querySelector<HTMLElement>("[data-product-media]");
  const originRect = (imgContainer ?? sourceEl).getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  if (originRect.width <= 0 || targetRect.width <= 0) return;

  const startX = originRect.left + originRect.width * 0.5 - 20;
  const startY = originRect.top + originRect.height * 0.5 - 20;
  const endX = targetRect.left + targetRect.width * 0.5 - 20;
  const endY = targetRect.top + targetRect.height * 0.5 - 20;

  const flyer = document.createElement("div");
  flyer.setAttribute("aria-hidden", "true");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: "40px",
    height: "40px",
    borderRadius: "9999px",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "90",
    border: "1px solid var(--accent)",
    backgroundColor: "var(--muted)",
    willChange: "transform, opacity",
  });

  const img = document.createElement("img");
  img.src = imageUrl;
  img.alt = "";
  Object.assign(img.style, {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  });
  flyer.appendChild(img);
  document.body.appendChild(flyer);

  const dx = endX - startX;
  const dy = endY - startY;

  const anim = flyer.animate(
    [
      { opacity: 0.95, transform: "translate3d(0, 0, 0) scale3d(1, 1, 1)" },
      {
        opacity: 0.85,
        transform: `translate3d(${(dx * 0.5).toFixed(1)}px, ${(dy * 0.5 - 24).toFixed(1)}px, 0) scale3d(0.7, 0.7, 1)`,
      },
      {
        opacity: 0.1,
        transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale3d(0.3, 0.3, 1)`,
      },
    ],
    {
      duration: 420,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  const cleanup = () => {
    flyer.remove();
  };
  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
}
