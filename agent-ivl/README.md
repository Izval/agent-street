# agent-ivl — IVL Rebalancer (BNBAgent SDK)

Agente ERC-8004 que lee el rango LP en vivo del motor IVL (`api.zvlint.com/v1/ivl/ticks`)
y **abre / mantiene / resetea** una posición PancakeSwap v3 en BSC testnet. Es el flagship
del marketplace y cubre el bounty PancakeSwap. Ver [`../docs/plan.md`](../docs/plan.md) §4.

## Entorno (verificado 17-ago-2026)

- **Python 3.12.14** (Homebrew: `/opt/homebrew/bin/python3.12`). El Python del sistema (3.9)
  es demasiado viejo para el SDK.
- Virtualenv aislado en `.venv/` (gitignored).

```bash
cd agent-ivl
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt      # instala bnbagent-studio 0.0.5 + web3, eth-account, mcp, …
```

## CLI: `bag`

El paquete `bnbagent-studio` expone el CLI **`bag`** (no `bnbagent-studio`). Comandos clave
para nuestras fases:

| Comando | Uso en el proyecto |
|---|---|
| `bag init` | Crear el proyecto del agente seller (scaffold). |
| `bag wallet create` | Keystore de la wallet del agente (→ bounty Altana). |
| `bag erc8004 register` | Identidad onchain ERC-8004 → **requisito duro del hackathon**. |
| `bag erc8183 ...` | Comercio/tareas entre agentes. |
| `bag dev` | Correr el agente localmente. |
| `bag deploy` | Readiness + deploy + registro en 8004scan. |
| `bag x402 ...` | Cliente de pagos x402 → **hire flow** del marketplace. |
| `bag doctor` | Diagnóstico de proyecto + entorno. |
| `bag skills install` | Instalar skills de Claude Code en el IDE. |

```bash
bag --help          # lista completa
bag doctor          # diagnóstico
```

## Pendiente (necesita credenciales del usuario)

Para el de-risk onchain de la Fase 0 (roadmap §3):
1. **Faucet BSC testnet** + wallet (`bag wallet create`).
2. **API key 8004scan Pro** (registro + verificación en `bag deploy`).
3. Validar mint v3 con `tickLower/tickUpper` — probar **skill PancakeSwap Liquidity de Altana**
   primero, luego TermiX MCP (roadmap §3.2).

> El paso `bag deploy` sube el agente a la nube (AWS) con identidad ERC-8004. Requiere las
> credenciales de arriba; sin ellas el entorno queda listo pero no se puede completar la tx onchain.
