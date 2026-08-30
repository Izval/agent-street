/**
 * WalletProvider — mounts the real wallet stack (wagmi + react-query + RainbowKit)
 * around the app. Placed in root.tsx `App()` wrapping the <Outlet/>, so that every
 * route (including /hire and the shell) has access to the connected wallet.
 *
 * Dark theme aligned to DESIGN.md: BNB brand accent (#F0B90B), background #0B0E11.
 * The QueryClient is created per render (useState) so state is not shared across
 * requests in SSR.
 */

import "../lib/wallet/polyfill";
import "@rainbow-me/rainbowkit/styles.css";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";

import { wagmiConfig } from "../lib/wallet/config";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#F0B90B",
            accentColorForeground: "#0B0E11",
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
