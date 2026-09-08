/**
 * Marketplace wagmi + RainbowKit config (WS Phase 3 · real wallet connect).
 * Single chain: BSC testnet (chainId 97) — the initial pair is BNB-USDT (CLAUDE.md §5)
 * and the hire settlement is paid here (client-pays, Option 3).
 *
 * **Injected-only** on purpose: connectors come from RainbowKit's
 * `connectorsForWallets` with a single `injectedWallet` (pure EIP-1193). This
 * covers any browser wallet — MetaMask / Binance Wallet / Rabby — through the one
 * injected provider, and deliberately drops WalletConnect/AppKit (Reown). That
 * removes the per-load AppKit init + its failing remote fetch (403 with a
 * placeholder projectId) which was the main thing delaying hydration, and needs no
 * `projectId` secret. Trade-off: no WalletConnect mobile QR modal — low value on a
 * testnet demo where injected wallets are the primary path. Re-add a real
 * `getDefaultConfig` + `VITE_WALLETCONNECT_PROJECT_ID` later if mobile/mainnet
 * wallets are wanted; the two are not exclusive.
 *
 * `ssr: true` to hydrate cleanly in React Router v7 (framework mode on Cloudflare).
 */

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";

/**
 * Hire settlement always lands on BSC **testnet** (the initial pair is
 * BNB-USDT, CLAUDE.md §5). Mainnet is added below only so the wallet can toggle
 * between the two networks from the profile menu — the hire flow still forces
 * `PAYMENT_CHAIN` before paying, so switching to mainnet never mis-settles.
 */
export const PAYMENT_CHAIN = bscTestnet;

/** Networks the wallet may switch between, shown as the testnet/mainnet toggle. */
export const NETWORKS = [
  { id: bscTestnet.id, label: "Testnet" },
  { id: bsc.id, label: "Mainnet" },
] as const;

/** Public RPCs (keyless) used by wagmi's reads/writes. */
const TESTNET_RPC = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const MAINNET_RPC = "https://bsc-dataseed.bnbchain.org";

// One injected entry, no WalletConnect connector → no AppKit init, no Reown 403.
// `projectId` is required by the type but unused here (no WC-based wallet exists).
const connectors = connectorsForWallets(
  [{ groupName: "Installed", wallets: [injectedWallet] }],
  { appName: "Agent-Street", projectId: "" },
);

export const wagmiConfig = createConfig({
  chains: [bscTestnet, bsc],
  connectors,
  transports: {
    [bscTestnet.id]: http(TESTNET_RPC),
    [bsc.id]: http(MAINNET_RPC),
  },
  ssr: true,
});
