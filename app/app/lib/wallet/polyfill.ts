/**
 * Browser polyfills that WalletConnect/wagmi expect and that the Cloudflare
 * bundle doesn't expose on the client: `Buffer` and `global`. Must be imported
 * BEFORE wagmi/rainbowkit (see WalletProvider.tsx). On the server (nodejs_compat)
 * Buffer already exists, so we only install it if it's missing.
 */

import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: unknown; global?: unknown };
if (typeof g.Buffer === "undefined") g.Buffer = Buffer;
if (typeof g.global === "undefined") g.global = globalThis;
