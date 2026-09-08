/**
 * useImageLoad — reveal-on-load image state that never shows a broken image.
 *
 * Spread `imgProps` onto an <img> and gate its visibility on `ok`: the image is
 * confirmed visible ONLY after a real `onLoad`, so a 404 / broken source never
 * appears (its `onLoad` never fires). The `useEffect` reconciles images that
 * finished loading (or errored) before React hydrated and attached the handlers —
 * the well-known React-18 gap where `onError`/`onLoad` are missed — by reading the
 * DOM's `complete`/`naturalWidth` directly. Reset whenever `src` changes.
 */

import { useEffect, useRef, useState } from "react";

export function useImageLoad(src?: string | null) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    const img = ref.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    }
  }, [src]);

  return {
    loaded,
    failed,
    /** true only once the image has genuinely loaded. */
    ok: !!src && loaded && !failed,
    imgProps: {
      ref,
      onLoad: () => setLoaded(true),
      onError: () => setFailed(true),
    },
  };
}
