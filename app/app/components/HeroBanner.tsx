/**
 * HeroBanner — bloque grande superior (DESIGN.md v2 §12).
 * Con `videoSrc`: <video autoplay muted loop playsinline poster> a cubierta +
 * overlay gradiente inferior para legibilidad. Sin video: fallback `.hero-anim`
 * (gradiente marca en deriva). CTA pill amarillo (§5). Pausa con reduced-motion.
 */

import { useEffect, useRef } from "react";
import { Link } from "react-router";

export function HeroBanner({
  title,
  subtitle,
  videoSrc,
  poster,
  ctaLabel,
  ctaTo,
}: {
  title: string;
  subtitle?: string;
  videoSrc?: string;
  poster?: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // reduced-motion: pausar el vídeo (SSR-safe: solo corre en cliente).
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) el.pause();
      else void el.play().catch(() => {});
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [videoSrc]);

  return (
    <section className="relative isolate flex min-h-[280px] flex-col justify-end overflow-hidden rounded-lg p-6 md:min-h-[340px] md:p-10">
      {videoSrc ? (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={poster}
            aria-hidden
          >
            <source src={videoSrc} />
          </video>
          {/* Overlay inferior para legibilidad del texto sobre vídeo. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(to top, rgba(11,14,17,0.92) 0%, rgba(11,14,17,0.55) 45%, rgba(11,14,17,0.1) 100%)",
            }}
          />
        </>
      ) : (
        <div className="hero-anim absolute inset-0 -z-10" aria-hidden />
      )}

      <div className="relative max-w-[42ch]">
        <h1 className="text-3xl font-bold leading-tight text-text md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-base text-text-2 md:text-lg">{subtitle}</p>
        )}
        {ctaLabel && ctaTo && (
          <Link
            to={ctaTo}
            className="mt-5 inline-flex min-h-[44px] items-center rounded-[999px] bg-brand px-6 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright active:bg-brand-active"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
