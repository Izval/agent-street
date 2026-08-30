# registrar — servicio de "Crea tu propio agente" (ERC-8004 testnet)

Pone la capa que a **BNB Agent Studio** le falta: Studio es CLI+IDE (no tiene consola web ni API).
Este servicio expone un `POST /v1/register` que acuña una **identidad ERC-8004 en BSC testnet** para
un agente nuevo, usando el seam limpio del SDK (`bnbagent_studio_core.erc8004.register`). El agente
queda **testnet**; **la promoción a mainnet la hace el dueño** con su propia wallet (fuera de aquí).

Es la **única pieza no-Cloudflare** del marketplace ("la instancia corriendo"). El listado en el
marketplace lo persiste el proxy (KV) — este servicio solo hace lo onchain.

## Correr

```bash
# reusa el venv de agent-ivl (ya trae el SDK), o crea uno:
python -m venv .venv && ./.venv/bin/pip install -r requirements.txt
uvicorn app:app --port 8080          # (desde services/registrar/)
```

## Config (env — nunca al repo)

| Var | Uso |
|---|---|
| `TREASURY_PRIVATE_KEY` | Clave de una wallet **testnet fondeada**; paga el gas de cada registro. **Ausente ⇒ DRY_RUN** (genera la wallet real pero no fondea/registra). |
| `WALLET_PASSWORD` | Cifra los keystores efímeros (secret del servicio). |
| `BSC_TESTNET_RPC` | RPC (default: data-seed público). |
| `FUND_WEI` | tBNB a enviar a cada wallet efímera (default 0.0015 BNB). |
| `ALLOWED_ORIGIN` | Origen CORS del marketplace. |
| `AGENT_ENDPOINT_BASE` | Base del endpoint/card placeholder del agente. |

## Modelo

`ERC-8004 = 1 identidad por address` ⇒ cada agente usa una **wallet efímera**: se genera, el
**treasury la fondea** con un poco de tBNB, y se llama `erc8004_core.register(...)`. Respuesta:

```json
{ "status": "registered", "mode": "onchain", "agentId": "1234",
  "ownerAddress": "0x…", "txHash": "0x…", "network": "bsc-testnet", "chainId": 97,
  "endpoint": "https://…/.well-known/agent-card.json" }
```

En **DRY_RUN** (sin treasury) `status:"pending"`, `mode:"dry_run"`, `agentId:null` — el journey del
marketplace se prueba sin gastar tBNB. Verificado con TestClient (health / register / validación 422).

## Handoff (para registro onchain real)

1. Crea una wallet testnet **throwaway**, fondéala en el faucet: https://testnet.bnbchain.org/faucet-smart
2. Exporta `TREASURY_PRIVATE_KEY=<clave de esa wallet>` (+ `WALLET_PASSWORD=<secret>`), corre uvicorn.
3. `curl -XPOST :8080/v1/register -d '{"name":"GridBot","description":"grid trading agent","category":"grid"}'`
   → confirma el `agentId` en https://testnet.bscscan.com o `bag erc8004 show`.

> ⚠ El treasury debe tener saldo suficiente (≥ ~0.002 tBNB por agente). Las wallets efímeras son
> throwaway testnet; el dueño real usa su propia wallet al promover a mainnet.

## Deploy en Render (free tier)

Este es el ÚNICO servicio no-Cloudflare. Se despliega con el Blueprint `render.yaml`
(raíz del repo) + el `Dockerfile` de este directorio.

1. Render dashboard → **New → Blueprint** → conecta este repo. Render lee `render.yaml`,
   construye el Docker y pide los secrets marcados `sync: false`.
2. Pega el **`TREASURY_PRIVATE_KEY`** (wallet testnet fondeada) en el prompt. Sin él → **DRY_RUN**.
3. Al quedar live obtienes `https://agent-street-registrar.onrender.com`. Ponla en
   `app/wrangler.jsonc` → `REGISTRAR_URL` y **redeploy del app** (Cloudflare).
4. **Keep-alive:** el free se duerme a los ~15 min (~50s cold start). Añade un ping externo a
   `/health` cada 10 min (UptimeRobot) para que el primer "Publish" del judging no dé timeout.
