"""mcp_client.py — a tiny MCP client over Streamable HTTP (buyer side).

The Agent-Street marketplace exposes a stateless MCP server (workers/mcp). This
client speaks the same spec-compliant JSON-RPC-over-POST the server implements:
`initialize`, then `tools/call` with `application/json` responses (no SSE, no
session id). It is deliberately dependency-light (httpx only) — the same discipline
as the worker it talks to.

Nothing here signs or holds a key: the client only reads the marketplace and relays
a payment txHash that payments.py produced from the SDK wallet.
"""

from __future__ import annotations

import json
from typing import Any

import httpx


class MCPError(RuntimeError):
    """A JSON-RPC protocol error (bad method, invalid params, internal error)."""


class MCPToolError(RuntimeError):
    """A tool-execution error (isError result) — e.g. agent not found, no pay-to."""


class MarketplaceMCP:
    """Minimal synchronous MCP client for the Agent-Street marketplace."""

    def __init__(self, base_url: str, *, timeout: float = 30.0) -> None:
        url = base_url.rstrip("/")
        self.endpoint = url if url.endswith("/mcp") else f"{url}/mcp"
        self.protocol = "2025-06-18"
        self._id = 0
        self._http = httpx.Client(timeout=timeout)

    # --- lifecycle ---------------------------------------------------------- #

    def __enter__(self) -> "MarketplaceMCP":
        self.initialize()
        return self

    def __exit__(self, *_exc: Any) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    # --- transport ---------------------------------------------------------- #

    def _rpc(self, method: str, params: dict[str, Any] | None = None) -> Any:
        self._id += 1
        payload: dict[str, Any] = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            payload["params"] = params
        res = self._http.post(
            self.endpoint,
            json=payload,
            headers={
                "content-type": "application/json",
                "accept": "application/json",
                "MCP-Protocol-Version": self.protocol,
            },
        )
        res.raise_for_status()
        data = res.json()
        if isinstance(data, dict) and data.get("error"):
            raise MCPError(str(data["error"]))
        return data.get("result") if isinstance(data, dict) else None

    def initialize(self) -> dict[str, Any]:
        res = self._rpc(
            "initialize",
            {
                "protocolVersion": self.protocol,
                "capabilities": {},
                "clientInfo": {"name": "agent-street-orchestrator", "version": "0.1.0"},
            },
        )
        if isinstance(res, dict) and res.get("protocolVersion"):
            self.protocol = res["protocolVersion"]
        return res or {}

    def call(self, name: str, arguments: dict[str, Any]) -> Any:
        """Invoke a tool and return its parsed JSON payload (raises on tool error)."""
        res = self._rpc("tools/call", {"name": name, "arguments": arguments})
        if not isinstance(res, dict):
            raise MCPToolError(f"tool '{name}' returned no result")
        text = ""
        content = res.get("content")
        if isinstance(content, list) and content and isinstance(content[0], dict):
            text = str(content[0].get("text", ""))
        if res.get("isError"):
            raise MCPToolError(text or f"tool '{name}' failed")
        # Structured payload is echoed as a text block; parse it back.
        if res.get("structuredContent") is not None:
            return res["structuredContent"]
        return json.loads(text) if text else None

    # --- typed convenience wrappers ---------------------------------------- #

    def search_agents(
        self, *, category: str | None = None, search: str | None = None, limit: int = 24
    ) -> dict[str, Any]:
        args: dict[str, Any] = {"limit": limit}
        if category:
            args["category"] = category
        if search:
            args["search"] = search
        return self.call("search_agents", args)

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        return self.call("get_agent", {"id": agent_id})

    def compare_agents(self, ids: list[str], *, sort_by: str = "score") -> dict[str, Any]:
        return self.call("compare_agents", {"ids": ids, "sortBy": sort_by})

    def get_hire_quote(self, agent_id: str) -> dict[str, Any]:
        return self.call("get_hire_quote", {"agent": agent_id})

    def hire_agent(
        self,
        *,
        agent_id: str,
        accept: dict[str, Any],
        tx_hash: str,
        from_addr: str,
        task: str | None = None,
        agent_name: str | None = None,
    ) -> dict[str, Any]:
        args: dict[str, Any] = {
            "agentId": agent_id,
            "accept": accept,
            "txHash": tx_hash,
            "from": from_addr,
        }
        if task:
            args["task"] = task
        if agent_name:
            args["agentName"] = agent_name
        return self.call("hire_agent", args)

    def list_my_hires(self, address: str) -> dict[str, Any]:
        return self.call("list_my_hires", {"address": address})

    def get_agent_card(self, agent_id: str) -> dict[str, Any]:
        return self.call("get_agent_card", {"id": agent_id})
