/**
 * HeroCarousel — slideshow panorámico full-width (DESIGN.md v3 §5.3).
 *
 * Firma "mission control": media de fondo (video loop o imagen) con Ken Burns +
 * panel `.glass-frost` abajo-izquierda con gradiente de legibilidad, dots + barra
 * de progreso del autoplay, flechas en hover, swipe/drag y teclado ←/→.
 *
 * SSR-safe: nada de `window`/`matchMedia` en render ni estado inicial. Autoplay,
 * detección de reduced-motion, control de video, drag y teclado corren en efectos
 * o handlers (solo cliente). Autoplay 7s/slide, pausa en hover/focus/reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

export interface HeroSlide {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  videoSrc?: string;
  imageSrc?: string;
  poster?: string;
  ctaLabel?: string;
  ctaTo?: string;
  live?: boolean;
  accent?: string;
}

const AUTOPLAY_MS = 7000;
const TICK_MS = 50;
const SWIPE_THRESHOLD = 48; // px

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const dragX = useRef<number | null>(null);
  const n = slides.length;

  // Detección de reduced-motion (solo cliente).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Autoplay + barra de progreso. Se reinicia con cada cambio de `index`.
  useEffect(() => {
    if (paused || reduced || n <= 1) return;
    setProgress(0);
    const start = Date.now();
    const id = window.setInterval(() => {
      const p = (Date.now() - start) / AUTOPLAY_MS;
      if (p >= 1) setIndex((i) => (i + 1) % n);
      else setProgress(p);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, n, index]);

  // Solo el slide activo reproduce vídeo (ahorra recursos + respeta reduced-motion).
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index && !reduced) {
        try {
          v.currentTime = 0;
        } catch {
          /* noop */
        }
        void v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [index, reduced]);

  if (n === 0) return null;

  const goTo = (i: number) => setIndex(((i % n) + n) % n);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragX.current = e.clientX;
    setPaused(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragX.current;
    dragX.current = null;
    setPaused(false);
    if (start == null) return;
    const dx = e.clientX - start;
    if (dx <= -SWIPE_THRESHOLD) next();
    else if (dx >= SWIPE_THRESHOLD) prev();
  };

  const active = slides[index];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Destacados del marketplace"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragX.current = null;
        setPaused(false);
      }}
      className="group relative isolate h-[220px] touch-pan-y select-none overflow-hidden rounded-lg outline-none sm:h-[300px] lg:h-[420px]"
    >
      {/* Slides apilados con cross-fade. */}
      {slides.map((s, i) => {
        const isActive = i === index;
        return (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${n}`}
            aria-hidden={!isActive}
            className="absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
            style={{ opacity: isActive ? 1 : 0 }}
          >
            {/* Media de fondo. */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
              {s.videoSrc ? (
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  className="kenburns h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  poster={s.poster}
                  aria-hidden
                >
                  <source src={s.videoSrc} />
                </video>
              ) : s.imageSrc ? (
                <img
                  src={s.imageSrc}
                  alt=""
                  aria-hidden
                  className="kenburns h-full w-full object-cover"
                />
              ) : (
                <div className="hero-anim kenburns absolute inset-0" aria-hidden />
              )}
            </div>

            {/* Gradiente de legibilidad (negro→transparente) bajo el panel. */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background:
                  "linear-gradient(to top, rgba(11,14,17,0.92) 0%, rgba(11,14,17,0.5) 42%, rgba(11,14,17,0.05) 78%), linear-gradient(to right, rgba(11,14,17,0.6) 0%, rgba(11,14,17,0) 60%)",
              }}
            />
          </div>
        );
      })}

      {/* Panel frost abajo-izquierda. */}
      <div className="absolute inset-x-4 bottom-4 md:inset-x-auto md:bottom-8 md:left-8 md:max-w-[46ch]">
        <div
          className="glass-frost rounded-lg p-5 md:p-7"
          style={
            active.accent
              ? ({ borderTopColor: active.accent } as React.CSSProperties)
              : undefined
          }
        >
          {active.live && (
            <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-up">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
              En vivo
            </span>
          )}
          {active.eyebrow && (
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: active.accent ?? "var(--text-3)" }}
            >
              {active.eyebrow}
            </div>
          )}
          <h2 className="mt-1 text-2xl font-bold leading-[1.08] tracking-tight text-text sm:text-3xl md:text-4xl">
            {active.title}
          </h2>
          {active.subtitle && (
            <p className="mt-2 line-clamp-2 text-sm text-text-2 md:text-base">
              {active.subtitle}
            </p>
          )}
          {active.ctaLabel && active.ctaTo && (
            <Link
              to={active.ctaTo}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-[999px] bg-brand px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright active:bg-brand-active"
            >
              {active.ctaLabel}
            </Link>
          )}
        </div>
      </div>

      {/* Flechas prev/next (aparecen en hover/focus). */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Slide anterior"
            className="glass-hair absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[999px] text-lg text-text opacity-0 transition-opacity duration-200 hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Slide siguiente"
            className="glass-hair absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[999px] text-lg text-text opacity-0 transition-opacity duration-200 hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
          >
            ›
          </button>
        </>
      )}

      {/* Dots + barra de progreso del autoplay. */}
      {n > 1 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 md:bottom-8">
          {slides.map((s, i) => {
            const isActive = i === index;
            return (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir al slide ${i + 1}`}
                aria-current={isActive}
                className="h-1.5 overflow-hidden rounded-[999px] bg-white/25 transition-all duration-200"
                style={{ width: isActive ? 28 : 8 }}
              >
                {isActive && (
                  <span
                    className="block h-full rounded-[999px] bg-brand"
                    style={{
                      width: reduced ? "100%" : `${Math.round(progress * 100)}%`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Live region del slide activo. */}
      <div className="sr-only" aria-live="polite">
        {`Slide ${index + 1} de ${n}: ${active.title}`}
      </div>
    </section>
  );
}
