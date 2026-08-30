import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  // WalletConnect/wagmi esperan `global` en el cliente; el bundle CF no lo expone.
  // (Buffer se inyecta en runtime vía app/lib/wallet/polyfill.ts.)
  define: {
    global: "globalThis",
  },
  resolve: {
    tsconfigPaths: true,
  },
});
