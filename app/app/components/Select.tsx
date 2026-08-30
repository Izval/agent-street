/**
 * Select — accessible custom dropdown (DESIGN.md §5.6).
 *
 * Replaces the native `<select>` everywhere so the marketplace never falls back
 * to the OS menu (which ignores our dark theme and brand focus). Trigger and
 * panel are styled to the design tokens; focus is brand-yellow only (the cyan
 * `--focus` outline is reserved for buttons/links). Keyboard: Enter/Space to
 * open, ArrowUp/Down to move, Enter to pick, Esc to close; closes on
 * outside-click and blur.
 */

import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  // When opening, focus the currently-selected option.
  useEffect(() => {
    if (open) setActive(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  function commit(i: number) {
    const opt = options[i];
    if (opt) onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className={"relative " + className}>
      <button
        type="button"
        data-field
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={
          "flex w-full items-center justify-between gap-2 rounded-[8px] border bg-surface-2 px-3 py-2.5 text-left text-sm outline-none transition-colors " +
          (open ? "border-brand" : "border-border hover:border-brand/60") +
          (selected ? " text-text" : " text-text-3")
        }
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={"shrink-0 text-text-3 transition-transform " + (open ? "rotate-180" : "")}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-[8px] border border-border bg-surface-2 p-1 shadow-lg"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === active;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
                className={
                  "cursor-pointer rounded-[6px] px-3 py-2 text-sm transition-colors " +
                  (isSelected
                    ? "bg-brand/10 font-semibold text-text"
                    : isActive
                      ? "bg-white/5 text-text"
                      : "text-text-2")
                }
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
