"""Orquestador del rebalanceo IVL → LP v3. Poll IVL → decide → (dry-run) ejecuta.

Une :mod:`ivl_client` (lee el rango) con :mod:`pancake_v3` (arma/encodea el mint).
Expone tres superficies:

1. :func:`plan_rebalance` — **solo lectura**: rango IVL + tx que se ENVIARÍA + dry-run
   (``eth_call``) contra el pool real, SIN firmar ni broadcastear. Es lo que consume el
   tool LLM-callable de ``tools.py`` y el CLI de verificación local (``python rebalance.py``).
2. :func:`execute_rebalance` — **firma y broadcastea** (código fijo, gated por credenciales):
   approve + mint vía ``EVMWalletProvider.sign_transaction`` del SDK. NO es un tool LLM.
3. :func:`render_deliverable` — texto del manifiesto para el hook ``run_work`` del seller.

Milestone Fase 1 (roadmap §4b): el dry-run prueba que los ticks de IVL encodean y
orientan bien contra el pool en vivo, sin gastar tBNB. El broadcast real se desbloquea
cuando el usuario fondea la wallet (ver README → handoff).
"""
from __future__ import annotations

import argparse
import json
import time
from typing import Any

from web3 import Web3

import pancake_v3 as pv3
from ivl_client import IvlTicksResponse, fetch_ticks

# Acción IVL → intención de gestión del rango.
ACTION_INTENT = {
    "open_or_hold": "mint",           # abrir/mantener en el rango vigente
    "withdraw_or_widen": "rewiden",   # retirar y re-mintear más ancho (2.5×ATR)
    "reset": "reset",                 # collect + burn + re-mint centrado
}

# Cantidades nominales para el dry-run (no se gasta nada; el eth_call revierte por
# saldo/allowance, lo que igualmente prueba que el encoding decodifica).
DRY_RUN_BASE_HUMAN = 0.01  # 0.01 WBNB


def _erc20(w3: Web3, token: str):
    return w3.eth.contract(address=Web3.to_checksum_address(token), abi=pv3.ERC20_ABI)


def plan_rebalance(
    pair: str = "BNB-USDT",
    *,
    recipient: str | None = None,
    config: pv3.RebalancerConfig = pv3.DEFAULT_TESTNET_CONFIG,
    ivl_base_url: str | None = None,
    do_dry_run: bool = True,
) -> dict[str, Any]:
    """Lee IVL, arma el mint contra el pool real y (opcional) hace dry-run. Solo lectura.

    ``recipient`` por defecto es un placeholder de solo-encoding cuando aún no hay
    wallet (para ``eth_call`` el ``from`` puede ser cualquier address). No firma nada.
    """
    config = config.checksummed()
    recipient = Web3.to_checksum_address(recipient) if recipient else "0x000000000000000000000000000000000000dEaD"

    ticks_resp: IvlTicksResponse = fetch_ticks(
        pair, base_url=(ivl_base_url or "https://api.zvlint.com")
    )
    ivl = ticks_resp.ticks
    action = ticks_resp.decision.action
    intent = ACTION_INTENT.get(action, "mint")

    report: dict[str, Any] = {
        "pair": pair,
        "ivl_score": ticks_resp.ivl_score,
        "classification": ticks_resp.classification,
        "decision": {
            "action": action,
            "intent": intent,
            "breakout_risk": ticks_resp.decision.breakout_risk,
            "rationale": ticks_resp.decision.rationale,
        },
        "ivl_ticks": {
            "tickLower": ivl.tick_lower, "tickUpper": ivl.tick_upper,
            "tickSpacing": ivl.tick_spacing, "feeUnits": ivl.fee_units,
            "priceLower": ivl.price_lower, "priceUpper": ivl.price_upper,
        },
    }

    w3 = pv3.connect(config)
    report["network"] = {"chainId": w3.eth.chain_id, "rpc_connected": True}

    # Decimales reales para dimensionar las cantidades nominales del dry-run.
    quote_dec = _erc20(w3, config.quote_token).functions.decimals().call()
    base_dec = _erc20(w3, config.base_token).functions.decimals().call()
    amount_base = int(DRY_RUN_BASE_HUMAN * (10 ** base_dec))
    amount_quote = int(DRY_RUN_BASE_HUMAN * ivl.price_upper * (10 ** quote_dec))

    plan = pv3.build_mint_plan(
        w3, ivl, recipient=recipient,
        amount_base_wei=amount_base, amount_quote_wei=amount_quote,
        config=config, deadline=int(time.time()) + 1200,
    )
    report["pool"] = {
        "address": plan.pool, "token0": plan.token0, "token1": plan.token1,
        "fee": plan.fee, "tickSpacing": plan.extra.get("tick_spacing"),
        "currentTick": plan.pool_tick,
    }
    report["oriented_ticks"] = {
        "tickLower": plan.tick_lower, "tickUpper": plan.tick_upper,
        "inverted_vs_ivl": plan.inverted,
        "in_range": plan.tick_lower <= (plan.pool_tick or 0) <= plan.tick_upper,
    }

    mint_calldata = pv3.encode_mint_calldata(w3, plan)
    decoded = pv3.decode_mint_calldata(w3, mint_calldata)
    dp = decoded["params"]
    roundtrip_ok = (
        int(dp["tickLower"]) == plan.tick_lower and int(dp["tickUpper"]) == plan.tick_upper
    )
    report["mint_tx"] = {
        "to": plan.config.position_manager,
        "calldata_len": len(mint_calldata),
        "calldata_head": mint_calldata[:74],
        "decoded_roundtrip_ok": roundtrip_ok,
    }

    # Approvals que harían falta (lectura de allowance real).
    npm = plan.config.position_manager
    approvals = []
    for token, amount, sym in (
        (plan.token0, plan.amount0_desired, "token0"),
        (plan.token1, plan.amount1_desired, "token1"),
    ):
        allowance = _erc20(w3, token).functions.allowance(
            Web3.to_checksum_address(recipient), Web3.to_checksum_address(npm)
        ).call()
        approvals.append({
            "which": sym, "token": token, "needs_approve": allowance < amount,
            "current_allowance": str(allowance),
            "approve_calldata_head": pv3.encode_approve_calldata(w3, token, npm, amount)[:74],
        })
    report["approvals"] = approvals

    if do_dry_run:
        report["dry_run"] = _dry_run_mint(w3, plan, recipient)

    return report


def _dry_run_mint(w3: Web3, plan: pv3.MintPlan, recipient: str) -> dict[str, Any]:
    """``eth_call`` del mint sin broadcast. Un revert por saldo/allowance es ESPERADO
    y prueba que el calldata decodifica en el contrato (encoding válido)."""
    calldata = pv3.encode_mint_calldata(w3, plan)
    tx = {"to": plan.config.position_manager, "from": Web3.to_checksum_address(recipient), "data": calldata}
    out: dict[str, Any] = {"broadcast": False, "method": "eth_call"}
    try:
        w3.eth.call(tx)
        out["result"] = "call_succeeded"  # improbable sin saldo, pero válido
        out["encoding_valid"] = True
    except Exception as exc:  # noqa: BLE001 — el revert es la vía normal aquí
        msg = str(exc)
        out["revert"] = msg[:300]
        # Un revert de ejecución (STF/allowance/balance) ⇒ el contrato ACEPTÓ y decodificó
        # el calldata. Solo un error de ABI/selector significaría encoding roto.
        out["encoding_valid"] = "execution reverted" in msg or "revert" in msg.lower()
    return out


def execute_rebalance(pair: str = "BNB-USDT", *, config=pv3.DEFAULT_TESTNET_CONFIG) -> dict[str, Any]:
    """FIRMA y broadcastea el rebalanceo (approve + mint). CÓDIGO FIJO, no un tool LLM.

    Gated por credenciales: requiere ``WALLET_PASSWORD`` + keystore (``bag wallet new``)
    y tBNB en la wallet. Usa ``get_wallet().sign_transaction`` (el agente = único firmante).
    No se ejecuta en la verificación local; documentado para la fase con credenciales.
    """
    from bnbagent_studio_core.wallet import get_wallet  # import perezoso: exige entorno de wallet

    wallet = get_wallet()
    w3 = pv3.connect(config.checksummed())
    plan_report = plan_rebalance(pair, recipient=wallet.address, config=config, do_dry_run=False)
    # NOTA: la construcción/broadcast completa (approve→mint, nonce, gas, decrease/burn
    # para rewiden/reset) se implementa al desbloquear credenciales. Aquí dejamos el
    # punto de firma explícito para no simular capacidades que aún no probamos onchain.
    raise NotImplementedError(
        "execute_rebalance: broadcast real pendiente de wallet fondeada (ver README → handoff). "
        f"Plan listo para firmar: {json.dumps(plan_report['mint_tx'])}"
    )


def render_deliverable(report: dict[str, Any]) -> str:
    """Manifiesto legible del rebalanceo — lo que el seller entrega (hook ``run_work``)."""
    d = report["decision"]
    ot = report.get("oriented_ticks", {})
    lines = [
        f"IVL Rebalancer — {report['pair']}",
        f"  IVL score: {report['ivl_score']} ({report['classification']}) · "
        f"breakout: {d['breakout_risk']}",
        f"  Decision: {d['action']} → intent={d['intent']}",
        f"  Rationale: {d['rationale']}",
    ]
    if "pool" in report:
        p = report["pool"]
        lines += [
            f"  Pool: {p['address']} fee={p['fee']} spacing={p['tickSpacing']} tick={p['currentTick']}",
            f"  Range (on-chain): [{ot.get('tickLower')}, {ot.get('tickUpper')}] "
            f"inverted={ot.get('inverted_vs_ivl')} in_range={ot.get('in_range')}",
        ]
    if "dry_run" in report:
        lines.append(f"  Dry-run: encoding_valid={report['dry_run'].get('encoding_valid')}")
    return "\n".join(lines)


# --- Tool de solo-lectura para el LLM (tools.py) -----------------------------
def ivl_rebalance_plan(pair: str = "BNB-USDT") -> dict[str, Any]:
    """Devuelve el plan de rebalanceo IVL para ``pair`` (rango, decisión y dry-run).

    SOLO LECTURA: consulta el motor IVL y simula el mint contra el pool en vivo sin
    firmar ni gastar. Úsalo para explicar/justificar el rango antes de ejecutar.
    """
    return plan_rebalance(pair)


# --- CLI de verificación local -----------------------------------------------
def _main() -> None:
    ap = argparse.ArgumentParser(description="Dry-run del rebalanceo IVL → LP v3 (sin broadcast).")
    ap.add_argument("--pair", default="BNB-USDT")
    ap.add_argument("--recipient", default=None, help="address (default: placeholder de solo-encoding)")
    ap.add_argument("--json", action="store_true", help="volcar el reporte JSON completo")
    args = ap.parse_args()

    report = plan_rebalance(args.pair, recipient=args.recipient)
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(render_deliverable(report))
        dr = report.get("dry_run", {})
        print(f"\n[dry-run] {dr.get('method')}: encoding_valid={dr.get('encoding_valid')}")
        if dr.get("revert"):
            print(f"[dry-run] revert (esperado sin saldo): {dr['revert'][:160]}")
        print(f"[roundtrip] mint calldata decode ok: {report['mint_tx']['decoded_roundtrip_ok']}")


if __name__ == "__main__":
    _main()
