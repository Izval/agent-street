/**
 * WalletButton — real wallet-connect CTA (RainbowKit) with our own styling
 * (DESIGN.md: scarce yellow pill, only for the CTA). States:
 *   - disconnected → "Connect" (brand pill).
 *   - wrong network → "Wrong network" (data red) that forces a switch to BSC testnet.
 *   - connected → chip (profile) that opens a context MENU: My agents · Copy
 *     address · View on explorer · Switch network · Disconnect.
 *
 * SSR-safe: RainbowKit exposes `mounted`; the menu is handled with client state
 * (click-outside + Escape) and does not touch window in render.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";

import { useSavedAgents } from "../lib/saved";

const EXPLORER = "https://testnet.bscscan.com";

function ProfileMenu({
  address,
  displayName,
  openChainModal,
  openAccountModal,
}: {
  address: string;
  displayName: string;
  openChainModal: () => void;
  openAccountModal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { disconnect } = useDisconnect();
  const savedCount = useSavedAgents().length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked: ignore */
    }
  };

  const item =
    "flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-left text-sm text-text-2 transition-colors hover:bg-surface-2 hover:text-text";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-[999px] border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-text transition-colors hover:border-brand"
      >
        <span aria-hidden className="h-2 w-2 rounded-full bg-up" />
        <span className="tnum">{displayName}</span>
        <span aria-hidden className="text-[10px] text-text-3">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="glass absolute right-0 z-50 mt-2 w-52 rounded-[10px] border border-border p-1 shadow-lg"
        >
          <Link
            to="/me"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={item + " font-semibold text-text"}
          >
            <span aria-hidden>◈</span> My agents
          </Link>
          <Link
            to="/saved"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={item}
          >
            <span aria-hidden>♥</span> Saved
            {savedCount > 0 && (
              <span className="tnum ml-auto rounded-full bg-surface-2 px-1.5 text-[11px] font-semibold text-text-2">
                {savedCount}
              </span>
            )}
          </Link>
          <button type="button" role="menuitem" onClick={copy} className={item}>
            <span aria-hidden>⧉</span> {copied ? "Copied!" : "Copy address"}
          </button>
          <a
            href={`${EXPLORER}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={item}
          >
            <span aria-hidden>↗</span> View on explorer
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openChainModal();
            }}
            className={item}
          >
            <span aria-hidden>⇄</span> Switch network
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openAccountModal();
            }}
            className={item}
          >
            <span aria-hidden>ⓘ</span> Details
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
            className={item + " text-down hover:text-down"}
          >
            <span aria-hidden>⏻</span> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          // Loading placeholder: a shimmer pill (DESIGN.md v3 §21 — no dead
          // fills). While wagmi auto-reconnects to the last connector this can
          // linger if the injected wallet is slow/unresponsive; the shimmer is
          // compositor-animated so it keeps reading as "loading", not "broken".
          return (
            <span
              aria-hidden
              className="shimmer block h-9 w-[104px] rounded-[999px]"
            />
          );
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="rounded-[999px] bg-brand px-5 py-2 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
            >
              Connect
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="rounded-[999px] border border-down/50 px-4 py-2 text-sm font-semibold text-down transition-colors hover:bg-down/10"
            >
              Wrong network
            </button>
          );
        }

        return (
          <ProfileMenu
            address={account.address}
            displayName={account.displayName}
            openChainModal={openChainModal}
            openAccountModal={openAccountModal}
          />
        );
      }}
    </ConnectButton.Custom>
  );
}
