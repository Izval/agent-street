"""orchestrate.py — the reference orchestrator journey (buyer side).

Demonstrates that Agent-Street is agent-native: an orchestrator drives the whole
lifecycle through the marketplace MCP server, with no human in the loop:

    discover -> compare -> decide -> quote -> pay -> hire -> manage

Two hire modes:
  * mediated (default): the marketplace x402 rail — get_hire_quote, sign+broadcast
    the payment from our own wallet, hire_agent verifies it on-chain. Works for ANY
    listed agent that exposes an on-chain pay-to wallet (marketplace-general).
  * direct: read the agent card and negotiate an ERC-8183 job straight with the
    seller. Richer, but needs a live ERC-8183 seller. Stubbed here (prints the plan).

Default is --dry-run (no spend): the full path is exercised and the payment PLAN is
printed, but nothing is broadcast — mirroring agent-ivl's dry-run discipline. Pass
--execute to actually pay on BSC testnet.

Run:
    python orchestrate.py --category rebalancing            # dry-run
    python orchestrate.py --category rebalancing --execute  # real hire (testnet)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from mcp_client import MarketplaceMCP, MCPToolError

DEFAULT_MCP_URL = "https://agent-street-mcp.zevlat.workers.dev/mcp"
DEFAULT_RPC_URL = "https://data-seed-prebsc-1-s1.bnbchain.org:8545"


def _log(step: str, **fields: Any) -> None:
    """Emit one structured journey event (clean trace for the demo)."""
    print(json.dumps({"step": step, **fields}, default=str), flush=True)


def run_journey(
    category: str,
    *,
    mcp_url: str,
    rpc_url: str,
    top: int = 3,
    execute: bool = False,
    mode: str = "mediated",
) -> dict[str, Any]:
    with MarketplaceMCP(mcp_url) as mp:
        _log("connect", endpoint=mp.endpoint, protocol=mp.protocol)

        # 1) DISCOVER
        page = mp.search_agents(category=category, limit=max(top, 3))
        agents = page.get("agents", [])
        _log("discover", category=category, count=page.get("count"), got=len(agents))
        if len(agents) < 1:
            _log("halt", reason="no agents in category")
            return {"halted": "no_agents"}

        ids = [a["id"] for a in agents[:top]]

        # 2) COMPARE / 3) DECIDE
        if len(ids) >= 2:
            cmp_ = mp.compare_agents(ids, sort_by="score")
            winner_ref = cmp_["winner"]
            _log("compare", ids=ids, winner=winner_ref["id"], reason=winner_ref["reason"])
        else:
            winner_ref = {"id": ids[0], "name": agents[0].get("name"), "reason": "only candidate"}
            _log("compare", ids=ids, winner=winner_ref["id"], reason=winner_ref["reason"])

        detail = mp.get_agent(winner_ref["id"])
        winner_name = detail.get("name", winner_ref.get("name"))
        _log(
            "evaluate",
            id=detail.get("id"),
            name=winner_name,
            score=detail.get("score"),
            x402=(detail.get("services") or {}).get("x402"),
            erc8183=(detail.get("services") or {}).get("erc8183"),
        )

        # Direct ERC-8183 path (power path) — stubbed: print the plan.
        if mode == "direct":
            card = mp.get_agent_card(detail["id"])
            _log("direct_card", a2aEndpoint=card.get("a2aEndpoint"), erc8183=card.get("erc8183"))
            plan = [
                "negotiate: POST A2A DataPart {skill:'negotiate', terms:{...}} -> signed quote",
                "createJob + fund (ERC-8183) anchoring the signed quote on-chain",
                "notify_funded: {skill:'notify_funded', job_id:N} -> seller delivers",
                "read deliverable back from chain (get_deliverable_url)",
            ]
            _log("direct_plan", steps=plan, note="stub — needs a live ERC-8183 seller")
            return {"winner": winner_ref, "mode": "direct", "plan": plan}

        # 4) QUOTE
        try:
            quote = mp.get_hire_quote(detail["id"])
        except MCPToolError as e:
            _log("quote_unavailable", detail=str(e))
            return {"winner": winner_ref, "quote": None, "reason": str(e)}
        accepts = quote.get("accepts", [])
        if not accepts:
            _log("quote_unavailable", detail="no accepts in quote")
            return {"winner": winner_ref, "quote": None}
        accept = accepts[0]
        _log(
            "quote",
            payTo=accept.get("payTo"),
            asset=accept.get("asset"),
            amount=accept.get("maxAmountRequired"),
            network=accept.get("network"),
        )

        # 5) PAY (client-pays) + 6) HIRE
        if not execute:
            _log(
                "dry_run",
                note="no payment broadcast",
                would_pay={"to": accept.get("payTo"), "amount": accept.get("maxAmountRequired")},
            )
            return {"winner": winner_ref, "accept": accept, "receipt": {"status": "dry-run"}}

        # Lazy import so dry-run needs no wallet/web3.
        from payments import pay_quote, payer_address

        payer = payer_address()
        _log("pay", payer=payer, rpc=rpc_url)
        tx_hash = pay_quote(accept, rpc_url=rpc_url)
        _log("paid", txHash=tx_hash)

        receipt = mp.hire_agent(
            agent_id=detail["id"],
            accept=accept,
            tx_hash=tx_hash,
            from_addr=payer,
            task=f"orchestrator demo hire ({category})",
            agent_name=winner_name,
        )
        _log("hire", status=receipt.get("status"), explorer=receipt.get("explorerUrl"))

        # 7) MANAGE
        hires = mp.list_my_hires(payer)
        _log("manage", address=payer, hires=len(hires.get("hires", [])))
        return {"winner": winner_ref, "txHash": tx_hash, "receipt": receipt, "hires": hires}


def main() -> int:
    p = argparse.ArgumentParser(description="Agent-Street reference orchestrator.")
    p.add_argument("--category", default="rebalancing", help="Marketplace category to shop.")
    p.add_argument("--mcp-url", default=os.environ.get("MCP_URL", DEFAULT_MCP_URL))
    p.add_argument("--rpc-url", default=os.environ.get("BSC_TESTNET_RPC", DEFAULT_RPC_URL))
    p.add_argument("--top", type=int, default=3, help="How many candidates to compare.")
    p.add_argument("--mode", choices=["mediated", "direct"], default="mediated")
    p.add_argument("--execute", action="store_true", help="Actually pay on-chain (default: dry-run).")
    p.add_argument("--register", action="store_true", help="Self-register as an Orchestrator listing, then exit.")
    args = p.parse_args()

    if args.register:
        from register import register_orchestrator

        res = register_orchestrator(mcp_url=args.mcp_url)
        print(json.dumps(res, indent=2, default=str))
        return 0

    out = run_journey(
        args.category,
        mcp_url=args.mcp_url,
        rpc_url=args.rpc_url,
        top=args.top,
        execute=args.execute,
        mode=args.mode,
    )
    print("\n=== summary ===")
    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
