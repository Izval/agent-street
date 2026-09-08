/**
 * Avatar — agent/skill thumbnail with a guaranteed fallback (never a broken
 * image). A deterministic color blur (lib/cover `coverStyle`, seeded by name/id)
 * plus the initial is ALWAYS painted behind, and the <img> is revealed ONLY once
 * it has actually loaded (fades in on `onLoad`). A broken/404 image therefore
 * never appears — it just stays invisible over the blur.
 *
 * This reveal-on-load approach sidesteps the React-18 hydration gap where an
 * image errors before the `onError` handler is attached (so onError never fires):
 * we don't depend on catching the error, we depend on confirming a success. A
 * `useEffect` also reconciles images that finished loading before hydration
 * (their onLoad/onError would have been missed) by reading `complete`/`naturalWidth`.
 * SSR-safe: `coverStyle` is pure; the <img> starts hidden and reveals client-side.
 */

import { coverStyle } from "../lib/cover";
import { useImageLoad } from "../lib/useImageLoad";

/**
 * Non-yellow hues for the fallback blur — brand yellow is reserved (DESIGN.md),
 * so avatars pick from these by seed to get varied but on-dark colors.
 */
const HUES = [
  "#2E7CF6", // blue
  "#8B5CF6", // violet
  "#EC4899", // magenta
  "#10B981", // green
  "#06B6D4", // cyan
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
];

function pickHue(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export interface AvatarProps {
  src?: string | null;
  /** Agent/skill name — used for the initial and (by default) the blur seed. */
  name?: string;
  /** Override the blur seed (defaults to `name`). Stable id → stable colors. */
  seed?: string;
  /** Force the blur tint. When omitted, a non-yellow hue is picked from the seed. */
  accent?: string;
  /** Size utility classes (default 28px). */
  size?: string;
  /** Corner radius utility (default full circle). */
  rounded?: string;
  className?: string;
}

export function Avatar({
  src,
  name,
  seed,
  accent,
  size = "h-7 w-7",
  rounded = "rounded-full",
  className = "",
}: AvatarProps) {
  const { ok: showImg, imgProps } = useImageLoad(src);
  const s = seed ?? name ?? "agent";
  const initial = (name?.trim().charAt(0) || "?").toUpperCase();

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden ${size} ${rounded} ${className}`}
      style={coverStyle(s, accent ?? pickHue(s))}
    >
      <span
        aria-hidden
        className={`text-xs font-semibold text-white/85 transition-opacity ${
          showImg ? "opacity-0" : "opacity-100"
        }`}
      >
        {initial}
      </span>
      {!!src && (
        <img
          {...imgProps}
          src={src}
          alt={name ? `${name} avatar` : ""}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            showImg ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}
