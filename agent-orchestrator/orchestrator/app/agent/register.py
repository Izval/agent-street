"""register.py — optional: list this orchestrator as an ERC-8004 agent.

Off the critical path (the journey works without it). It makes the marketplace
self-demonstrating: the marketplace hosts orchestrators too. Uses the marketplace's
existing, IVL-agnostic submit endpoint (workers/8004-proxy POST /v1/submitted) in the
`infra-automation` category.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_PROXY_URL = "https://agent-street-8004-proxy.zevlat.workers.dev"


def register_orchestrator(
    *,
    mcp_url: str,
    proxy_url: str | None = None,
    name: str = "Agent-Street Orchestrator",
    category: str = "infra-automation",
) -> dict[str, Any]:
    """POST /v1/submitted to list this orchestrator. Returns the created listing."""
    proxy = (proxy_url or os.environ.get("PROXY_8004_URL") or DEFAULT_PROXY_URL).rstrip("/")

    owner = None
    try:  # best-effort: use the SDK wallet address as the owner if available
        from payments import payer_address

        owner = payer_address()
    except Exception:  # noqa: BLE001 — registration is optional; owner may be unset
        owner = None

    body: dict[str, Any] = {
        "name": name,
        "description": (
            "Reference orchestrator that discovers, compares, hires and manages agents "
            "through the Agent-Street MCP server. Buyer-side ERC-8004 agent."
        ),
        "category": category,
        "endpoint": mcp_url,
        "chainId": 97,
        "status": "pending",
        "x402Supported": True,
    }
    if owner:
        body["ownerAddress"] = owner

    headers = {"content-type": "application/json"}
    token = os.environ.get("SUBMIT_TOKEN")
    if token:
        headers["x-submit-token"] = token

    res = httpx.post(f"{proxy}/v1/submitted", json=body, headers=headers, timeout=30.0)
    res.raise_for_status()
    return res.json()
