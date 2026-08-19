"""Registrar — servicio HTTP que registra agentes ERC-8004 en BSC **testnet** por el
usuario, para el flujo "Crea tu propio agente" del marketplace.

BNB Agent Studio no tiene consola web ni API: es CLI+IDE. Este servicio pone la capa
que falta — un `POST /v1/register` que, dada una spec mínima (name/description/category),
acuña una identidad ERC-8004 en testnet usando el seam limpio del SDK
(`bnbagent_studio_core.erc8004.register`). El agente queda **testnet**; la promoción a
mainnet la hace el dueño con su propia wallet (fuera de este servicio).

Modelo (roadmap "Crea tu propio agente"):
  wallet EFÍMERA por agente (ERC-8004 = 1 identidad por address) → treasury la fondea con
  un poco de tBNB → `erc8004_core.register(...)` → {agentId, txHash}. El LISTADO en el
  marketplace lo persiste el proxy (KV); este servicio solo hace lo onchain.

⚠ Es la ÚNICA pieza no-Cloudflare ("la instancia corriendo"). Corre con uvicorn:
    uvicorn app:app --port 8080
Config por entorno (nunca al repo):
    TREASURY_PRIVATE_KEY  clave de una wallet testnet FONDEADA (paga el gas de cada registro).
                          Si falta → modo DRY_RUN (genera todo menos fondear/registrar).
    WALLET_PASSWORD       password para cifrar los keystores efímeros (secret del servicio).
    BSC_TESTNET_RPC       RPC (default: data-seed público).
    ALLOWED_ORIGIN        origen CORS del marketplace (default *).
    FUND_WEI              tBNB a enviar a cada wallet efímera (default 0.0015 BNB).
    AGENT_ENDPOINT_BASE   base para el endpoint/card placeholder del agente.
"""
from __future__ import annotations

import logging
import os
import re
import tempfile
import time
from typing import Any, Literal

from eth_account import Account
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from web3 import Web3

logger = logging.getLogger("registrar")
logging.basicConfig(level=logging.INFO)

BSC_TESTNET_CHAIN_ID = 97
DEFAULT_RPC = os.environ.get("BSC_TESTNET_RPC", "https://data-seed-prebsc-1-s1.bnbchain.org:8545")
FUND_WEI = int(os.environ.get("FUND_WEI", str(15 * 10**14)))  # 0.0015 BNB
ENDPOINT_BASE = os.environ.get("AGENT_ENDPOINT_BASE", "https://agent-street.pages.dev").rstrip("/")
WALLET_PASSWORD = os.environ.get("WALLET_PASSWORD", "registrar-dev-password")
TREASURY_PK = os.environ.get("TREASURY_PRIVATE_KEY")  # ausente ⇒ DRY_RUN

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slug(text: str) -> str:
    return _SLUG_RE.sub("-", text.lower()).strip("-") or "agent"


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1, max_length=600)
    category: str = Field(default="", max_length=40)
    endpoint: str | None = Field(default=None, max_length=300)
    protocol: str = Field(default="A2A", max_length=16)


class RegisterResponse(BaseModel):
    status: Literal["registered", "pending"]
    mode: Literal["onchain", "dry_run"]
    agentId: str | None = None
    ownerAddress: str
    txHash: str | None = None
    network: str = "bsc-testnet"
    chainId: int = BSC_TESTNET_CHAIN_ID
    endpoint: str
    detail: str | None = None


app = FastAPI(title="agent-street registrar", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "*")],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def _w3() -> Web3:
    w3 = Web3(Web3.HTTPProvider(DEFAULT_RPC, request_kwargs={"timeout": 15}))
    if not w3.is_connected():
        raise HTTPException(status_code=502, detail="BSC testnet RPC unreachable")
    return w3


def _fund_wallet(w3: Web3, to_address: str) -> str:
    """El treasury envía FUND_WEI tBNB a ``to_address`` (legacy tx). Devuelve el tx hash."""
    treasury = Account.from_key(TREASURY_PK)
    to_address = Web3.to_checksum_address(to_address)
    tx = {
        "to": to_address,
        "value": FUND_WEI,
        "gas": 21000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(treasury.address),
        "chainId": BSC_TESTNET_CHAIN_ID,
    }
    signed = treasury.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(h, timeout=120)
    return h.hex()


def _register_onchain(req: RegisterRequest, endpoint: str) -> tuple[str, str, str]:
    """Acuña la identidad ERC-8004 en testnet. Devuelve (agentId, ownerAddress, fund_tx).

    Wallet efímera (1 identidad ERC-8004 por address) → treasury la fondea → register.
    """
    from bnbagent.wallets.evm_wallet_provider import EVMWalletProvider
    from bnbagent_studio_core import erc8004 as erc8004_core

    acct = Account.create()
    wallets_dir = tempfile.mkdtemp(prefix="registrar-")
    provider = EVMWalletProvider(
        password=WALLET_PASSWORD, private_key=acct.key.hex(), wallets_dir=wallets_dir, persist=True
    )
    owner = provider.address

    w3 = _w3()
    fund_tx = _fund_wallet(w3, owner)

    agent_id = erc8004_core.register(
        provider,
        endpoint=endpoint,
        network="bsc-testnet",
        name=req.name,
        description=req.description,
        protocol=req.protocol or "A2A",
    )
    return str(agent_id), owner, fund_tx


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "registrar",
        "mode": "onchain" if TREASURY_PK else "dry_run",
        "chainId": BSC_TESTNET_CHAIN_ID,
        "rpc": DEFAULT_RPC,
    }


@app.post("/v1/register", response_model=RegisterResponse)
def register(req: RegisterRequest) -> RegisterResponse:
    """Registra (o simula) una identidad ERC-8004 testnet para un agente nuevo.

    Sin ``TREASURY_PRIVATE_KEY`` responde en **DRY_RUN**: genera la wallet real pero NO
    fondea ni registra (status=pending). Así el journey del marketplace se puede probar
    sin gastar tBNB; el registro real se activa poniendo el secret del treasury.
    """
    endpoint = req.endpoint or f"{ENDPOINT_BASE}/agent/pending/{_slug(req.name)}/.well-known/agent-card.json"

    if not TREASURY_PK:
        # DRY_RUN: wallet real (address estable), sin onchain.
        acct = Account.create()
        logger.info("DRY_RUN register name=%r owner=%s", req.name, acct.address)
        return RegisterResponse(
            status="pending", mode="dry_run", agentId=None, ownerAddress=acct.address,
            endpoint=endpoint, detail="DRY_RUN: set TREASURY_PRIVATE_KEY to register on-chain",
        )

    try:
        agent_id, owner, fund_tx = _register_onchain(req, endpoint)
    except Exception as exc:  # noqa: BLE001 — el frontend puede listar como pending y reintentar
        logger.exception("on-chain register failed")
        raise HTTPException(status_code=502, detail=f"register failed: {exc}") from exc

    logger.info("registered agentId=%s owner=%s", agent_id, owner)
    return RegisterResponse(
        status="registered", mode="onchain", agentId=agent_id, ownerAddress=owner,
        txHash=fund_tx, endpoint=endpoint,
    )
