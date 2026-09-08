/**
 * NetworkAdder — one-click "add BNB network to wallet" buttons.
 *
 * Uses the injected EIP-1193 provider's `wallet_addEthereumChain` (works with
 * MetaMask / Binance Wallet / Rabby). Rendered only on the /docs/networks page,
 * above the prose (which carries the same parameters as tables for agents and
 * for manual entry). The testnet RPC matches lib/wallet/config.ts.
 */

import { useState } from "react";

type ChainParams = {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

const NETWORKS: Array<{ key: string; label: string; sub: string; params: ChainParams }> = [
  {
    key: "mainnet",
    label: "BNB Smart Chain",
    sub: "Mainnet · chain 56",
    params: {
      chainId: "0x38",
      chainName: "BNB Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: ["https://bsc-dataseed.bnbchain.org"],
      blockExplorerUrls: ["https://bscscan.com"],
    },
  },
  {
    key: "testnet",
    label: "BNB Smart Chain Testnet",
    sub: "Testnet · chain 97",
    params: {
      chainId: "0x61",
      chainName: "BNB Smart Chain Testnet",
      nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
      rpcUrls: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
      blockExplorerUrls: ["https://testnet.bscscan.com"],
    },
  },
];

type State = "idle" | "pending" | "ok" | "error";

export function NetworkAdder() {
  const [status, setStatus] = useState<Record<string, State>>({});

  const add = async (key: string, params: ChainParams) => {
    const eth = (globalThis as { ethereum?: { request?: (a: unknown) => Promise<unknown> } })
      .ethereum;
    if (!eth?.request) {
      setStatus((s) => ({ ...s, [key]: "error" }));
      return;
    }
    setStatus((s) => ({ ...s, [key]: "pending" }));
    try {
      await eth.request({ method: "wallet_addEthereumChain", params: [params] });
      setStatus((s) => ({ ...s, [key]: "ok" }));
    } catch {
      setStatus((s) => ({ ...s, [key]: "error" }));
    }
  };

  const hasWallet =
    typeof window !== "undefined" &&
    !!(window as { ethereum?: unknown }).ethereum;

  return (
    <div className="my-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {NETWORKS.map((n) => {
        const st = status[n.key] ?? "idle";
        return (
          <div key={n.key} className="rounded-lg border border-border bg-surface p-4">
            <div className="text-sm font-semibold text-text">{n.label}</div>
            <div className="mt-0.5 text-xs text-text-3">{n.sub}</div>
            <button
              type="button"
              onClick={() => add(n.key, n.params)}
              disabled={st === "pending"}
              className="mt-3 inline-flex min-h-[36px] items-center rounded-[999px] bg-brand px-4 text-[13px] font-semibold text-bg transition-colors hover:bg-brand-bright disabled:opacity-70"
            >
              {st === "ok"
                ? "Added ✓"
                : st === "pending"
                  ? "Confirm in wallet…"
                  : "Add to wallet"}
            </button>
            {st === "error" && (
              <div className="mt-2 text-xs text-down">
                {hasWallet
                  ? "Couldn't add — check your wallet, or add it manually below."
                  : "No browser wallet detected — add it manually below."}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
