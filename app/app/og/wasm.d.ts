// Wasm modules imported for OG-image rendering are pre-compiled by the
// Cloudflare Vite plugin / Wrangler into WebAssembly.Module instances (workerd
// forbids compiling wasm from bytes at runtime, so we import the module).
declare module "*.wasm" {
  const mod: WebAssembly.Module;
  export default mod;
}
