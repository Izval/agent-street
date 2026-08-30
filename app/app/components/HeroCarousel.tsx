/**
 * HeroCarousel — "Discover" slideshow (DESIGN.md v3 §5.3, Apple App Store lineage).
 *
 * Each slide is full-bleed media with direct WHITE text (uppercase eyebrow,
 * large title, subtitle) — no glass window, no button: **the whole slide is a
 * link**. Behind the card, a scaled-up, heavily blurred copy of the slide itself
 * ("ambient") tints the top area and fades downward. Prev/next arrows sit
 * OUTSIDE the card, on the sides. Apple-style dots.
 *
 * Supported media per slide (priority): YouTube (`youtubeId`) → background iframe ·
 * self-hosted / uploaded video (`videoSrc`, an .mp4 in /public or URL) → <video> ·
 * image (`imageSrc`, e.g. Unsplash) → <img> · if none, abstract art (`cover`).
 * The ambient blur is derived from the YouTube thumbnail / `poster` / `imageSrc` / art.
 *
 * SSR-safe: no `window`/`matchMedia` in render or initial state. Autoplay,
 * reduced-motion, drag/swipe and keyboard run in effects/handlers (client only).
 * Swipe doesn't navigate (the click is canceled if there was a drag).
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { coverStyle } from "../lib/cover";

export interface HeroSlide {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Self-hosted / uploaded video: path to an .mp4 in /public or an absolute URL. */
  videoSrc?: string;
  /** Background image (e.g. Unsplash). Tints the dynamic ambient blur. */
  imageSrc?: string;
  /** ID of a YouTube video (autoplay, muted, looping background). */
  youtubeId?: string;
  poster?: string;
  /** Abstract art seed if there's no media (lib/cover). */
  cover?: string;
  /** Link destination (the whole slide). */
  ctaTo?: string;
  ctaLabel?: string; // ignored (no button); kept for type compatibility
  live?: boolean; // no longer renders a badge; kept for compatibility
  accent?: string;
}

const AUTOPLAY_MS = 7000;
const TICK_MS = 50;
const SWIPE_THRESHOLD = 48; // px

/** Background (backgroundImage) for a slide's ambient blur. */
function ambientBg(s: HeroSlide): string | undefined {
  if (s.imageSrc) return `url("${s.imageSrc}")`;
  if (s.youtubeId) return `url("https://img.youtube.com/vi/${s.youtubeId}/hqdefault.jpg")`;
  if (s.poster) return `url("${s.poster}")`;
  return coverStyle(s.cover ?? s.title, s.accent).backgroundImage;
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const dragX = useRef<number | null>(null);
  const dragged = useRef(false);
  const n = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
    dragged.current = false;
    setPaused(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragX.current;
    dragX.current = null;
    setPaused(false);
    if (start == null) return;
    const dx = e.clientX - start;
    if (dx <= -SWIPE_THRESHOLD) {
      dragged.current = true;
      next();
    } else if (dx >= SWIPE_THRESHOLD) {
      dragged.current = true;
      prev();
    }
  };
  // Cancels the <Link> navigation if the gesture was a drag.
  const onLinkClick = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      dragged.current = false;
    }
  };

  const active = slides[index];

  /** Media for a slide (by priority). `isActive` decides iframe vs thumbnail. */
  const mediaFor = (s: HeroSlide, i: number, isActive: boolean) => {
    if (s.youtubeId) {
      // YouTube only mounts (autoplay) on the active slide and without reduced-motion.
      if (isActive && !reduced) {
        return (
          <div className="absolute inset-0 overflow-hidden">
            <iframe
              title={s.title}
              src={`https://www.youtube-nocookie.com/embed/${s.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${s.youtubeId}&playsinline=1&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3`}
              allow="autoplay; encrypted-media; picture-in-picture"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: "100%",
                height: "100%",
                minWidth: "177.78vh",
                minHeight: "56.25vw",
                border: 0,
              }}
              aria-hidden
            />
          </div>
        );
      }
      // Fallback (inactive / reduced-motion): video thumbnail.
      return (
        <img
          src={`https://img.youtube.com/vi/${s.youtubeId}/maxresdefault.jpg`}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
        />
      );
    }
    if (s.videoSrc) {
      return (
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
      );
    }
    if (s.imageSrc) {
      return (
        <img
          src={s.imageSrc}
          alt=""
          aria-hidden
          className="kenburns h-full w-full object-cover"
        />
      );
    }
    return (
      <div
        aria-hidden
        className="kenburns h-full w-full"
        style={coverStyle(s.cover ?? s.title, s.accent)}
      />
    );
  };

  // Absolute arrows in the side gutters: they do NOT steal width from the slide.
  const arrowCls =
    "absolute top-1/2 z-20 hidden h-9 w-7 -translate-y-1/2 place-items-center rounded-full text-3xl leading-none text-text-3 transition-colors hover:text-brand focus-visible:text-brand md:grid";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Marketplace highlights"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="group relative isolate select-none py-3 outline-none"
    >
      {/* Ambient: a scaled-up, blurred copy of the active slide. Covers the top
          area and fades out with a radial mask that dies off INSIDE the
          container (no-repeat) → no border or rectangular cut. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-4 -right-4 -z-10 md:-left-8 md:-right-8"
        style={{
          top: "-200px",
          bottom: "-40px",
          opacity: 0.9,
          WebkitMaskImage:
            "radial-gradient(120% 92% at 55% 20%, #000 18%, rgba(0,0,0,0.5) 50%, transparent 78%)",
          maskImage:
            "radial-gradient(120% 92% at 55% 20%, #000 18%, rgba(0,0,0,0.5) 50%, transparent 78%)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 bg-bg bg-cover bg-center transition-opacity duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
            style={{
              opacity: i === index ? 1 : 0,
              backgroundImage: ambientBg(s),
              filter: "blur(64px) saturate(1.35)",
            }}
          />
        ))}
      </div>

      {/* Full-width card (max panoramic); absolute arrows in the gutters. */}
      <div className="relative">
        {n > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className={`${arrowCls} -left-3 md:-left-6`}
          >
            ‹
          </button>
        )}
        {n > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className={`${arrowCls} -right-3 md:-right-6`}
          >
            ›
          </button>
        )}

        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragX.current = null;
            setPaused(false);
          }}
          className="relative h-[240px] touch-pan-y overflow-hidden rounded-2xl shadow-[var(--elev-hero)] sm:h-[320px] lg:h-[440px]"
        >
          {/* Stacked slides: media + gradient + text, all cross-fade together.
              Each slide is a link; only the active one captures the click. */}
          {slides.map((s, i) => {
            const isActive = i === index;
            return (
              <Link
                key={i}
                to={s.ctaTo ?? "/"}
                onClick={onLinkClick}
                role="group"
                aria-roledescription="slide"
                aria-label={s.title}
                aria-hidden={!isActive}
                tabIndex={isActive ? 0 : -1}
                className={
                  "absolute inset-0 flex flex-col justify-end p-6 transition-opacity duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] md:p-9 lg:p-11 " +
                  (isActive ? "opacity-100" : "pointer-events-none opacity-0")
                }
              >
                <div className="absolute inset-0 -z-10 overflow-hidden bg-bg">
                  {mediaFor(s, i, isActive)}
                </div>
                {/* Legibility gradient (stronger at the bottom-left). */}
                <div
                  aria-hidden
                  className="absolute inset-0 -z-10"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.36) 40%, rgba(0,0,0,0) 72%), linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 55%)",
                  }}
                />
                <div className="max-w-[54ch]">
                  {s.eyebrow && (
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                      {s.eyebrow}
                    </div>
                  )}
                  <h2 className="mt-1.5 text-2xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:text-4xl lg:text-5xl">
                    {s.title}
                  </h2>
                  {s.subtitle && (
                    <p className="mt-2.5 line-clamp-2 max-w-[46ch] text-sm text-white/80 md:text-base">
                      {s.subtitle}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Apple-style dots (translucent pill, centered at the bottom). */}
          {n > 1 && (
            <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center">
              <div className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-md">
                {slides.map((s, i) => {
                  const isActive = i === index;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={isActive}
                      className="h-1.5 overflow-hidden rounded-full bg-white/35 transition-all duration-200"
                      style={{ width: isActive ? 22 : 6 }}
                    >
                      {isActive && (
                        <span
                          className="block h-full rounded-full bg-white"
                          style={{
                            width: reduced ? "100%" : `${Math.round(progress * 100)}%`,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {`Slide ${index + 1} of ${n}: ${active.title}`}
      </div>
    </section>
  );
}
