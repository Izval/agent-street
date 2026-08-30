/**
 * Toast — ephemeral action notification (plan §5.11: "hire started").
 * Dual API:
 *   - `Toast` presentational (a glass-hair card, controlled by the parent).
 *   - `ToastProvider` + `useToast()` — lightweight context: `push({...})` enqueues and the
 *     viewport auto-unmounts after `duration`. SSR-safe (state on the client; the
 *     provider does not touch `window` in render).
 * A11y: `aria-live="polite"` region; tone does not depend on color alone.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

export type ToastTone = "info" | "success" | "error";

const TONE_ICON: Record<ToastTone, string> = {
  info: "●",
  success: "✓",
  error: "!",
};

const TONE_COLOR: Record<ToastTone, string> = {
  info: "text-text-2",
  success: "text-up",
  error: "text-down",
};

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms before auto-close. 0 = no auto-close. Default 4000. */
  duration?: number;
}

// ---- Presentational --------------------------------------------------- //

export interface ToastProps {
  title: string;
  description?: string;
  tone?: ToastTone;
  onClose?: () => void;
}

export function Toast({ title, description, tone = "info", onClose }: ToastProps) {
  return (
    <div
      role="status"
      className="glass-hair pointer-events-auto flex w-[min(92vw,22rem)] items-start gap-3 rounded-lg px-3.5 py-3 shadow-[var(--elev-2)]"
    >
      <span
        aria-hidden
        className={`mt-0.5 text-sm leading-none ${TONE_COLOR[tone]}`}
      >
        {TONE_ICON[tone]}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-text">{title}</p>
        {description != null && (
          <p className="mt-0.5 text-xs text-text-3">{description}</p>
        )}
      </div>
      {onClose != null && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="-mr-1 rounded p-1 text-text-3 transition-colors hover:text-text"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ---- Lightweight context ---------------------------------------------- //

interface ToastContextValue {
  push: (t: Omit<ToastData, "id"> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (t: Omit<ToastData, "id"> & { id?: string }) => {
      const id =
        t.id ?? `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const next: ToastData = { duration: 4000, tone: "info", ...t, id };
      setToasts((prev) => [...prev.filter((x) => x.id !== id), next]);
      if (next.duration && next.duration > 0) {
        const timer = setTimeout(() => dismiss(id), next.duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed bottom-16 right-4 z-[60] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <Toast
            key={t.id}
            title={t.title}
            description={t.description}
            tone={t.tone}
            onClose={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Convenience hook. Must be used inside <ToastProvider>. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx == null) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
