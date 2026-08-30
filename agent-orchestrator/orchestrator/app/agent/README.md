# Orchestrator agent (buyer side)

The deployable/runnable package. See the top-level `agent-orchestrator/README.md` for
the full journey and run instructions.

- `mcp_client.py` — `MarketplaceMCP`: a dependency-light MCP client (httpx) speaking
  JSON-RPC over Streamable HTTP, matching the stateless `workers/mcp` server.
- `payments.py` — `pay_quote(accept, rpc_url)`: signs + broadcasts the x402
  client-transfer with the SDK wallet (`get_wallet()`), returns the txHash. **Fixed
  code, never an LLM-callable tool** — same signing discipline as
  `agent-ivl/app/agent/signing.py`. Does NOT use `X402Payer` (the marketplace uses
  `client-transfer` settlement, not EIP-3009).
- `orchestrate.py` — the discover→compare→quote→pay→hire→manage journey + CLI.
- `register.py` — optional self-registration as an `infra-automation` listing.

The SDK wallet here is the **payer** (buyer), the mirror of the agent-ivl wallet which
is the **seller/signer**. Every on-chain write is fixed code; the LLM (if any) never
touches a key.
