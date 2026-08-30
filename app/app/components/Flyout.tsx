/**
 * Flyout — Steam-style side popover for product cards (DESIGN.md v3).
 *
 * Cards live inside `CollectionCarousel` (overflow-x-auto), which clips any
 * absolute popover. Solution: portal to `document.body` + `fixed` position
 * computed from the anchor's `getBoundingClientRect`, edge-aware (opens to the right, or
 * the left if it doesn't fit; snaps up/down if it runs off the viewport).
 *
 * `useHoverFlyout` handles hover-intent (open delay, bridge on leave) and
 * exposes handlers for the anchor. SSR-safe: the portal only mounts on the client
 * (guard `typeof document`), with no `window` access during render/initial state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const OPEN_DELAY = 120; // ms — avoids flicker when passing by
const CLOSE_DELAY = 90;
const PANEL_W = 320;
const GAP = 12;

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function useHoverFlyout() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const openT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (openT.current) clearTimeout(openT.current);
    if (closeT.current) clearTimeout(closeT.current);
    openT.current = closeT.current = null;
  };

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    });
  }, []);

  const onEnter = useCallback(() => {
    clear();
    openT.current = setTimeout(() => {
      measure();
      setOpen(true);
    }, OPEN_DELAY);
  }, [measure]);

  const onLeave = useCallback(() => {
    clear();
    closeT.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  // Close on scroll/resize (the fixed position would be misaligned).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => () => clear(), []);

  return {
    open,
    rect,
    anchorRef,
    anchorProps: { onPointerEnter: onEnter, onPointerLeave: onLeave },
    setOpen,
  };
}

/** Computes the panel's fixed position from the anchor rect and the viewport. */
function place(rect: AnchorRect): {
  left: number;
  top: number;
  maxHeight: number;
  origin: string;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer the right; if it doesn't fit, the left.
  const fitsRight = rect.right + GAP + PANEL_W <= vw - 8;
  const left = fitsRight
    ? rect.right + GAP
    : Math.max(8, rect.left - GAP - PANEL_W);

  // Align to the anchor and ensure it fits in the viewport (internal scroll otherwise).
  const top = Math.min(Math.max(rect.top, 8), vh - 120);
  const maxHeight = vh - top - 8;

  return { left, top, maxHeight, origin: fitsRight ? "left center" : "right center" };
}

export function Flyout({
  open,
  rect,
  onPointerEnter,
  onPointerLeave,
  children,
}: {
  open: boolean;
  rect: AnchorRect | null;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined" || !open || !rect) return null;

  const { left, top, maxHeight, origin } = place(rect);

  return createPortal(
    <div
      role="tooltip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="flyin pointer-events-auto fixed z-[60] w-[320px] overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-[var(--elev-2)] backdrop-blur-xl"
      style={{ left, top, maxHeight, transformOrigin: origin }}
    >
      {children}
    </div>,
    document.body,
  );
}
