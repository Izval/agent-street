"""payments.py — x402 client-transfer payer (the buyer's signer).

The marketplace hire rail is client-pays: get_hire_quote returns an x402 challenge,
and the BUYER (this orchestrator) signs + broadcasts the payment from its own wallet,
then hands the txHash to hire_agent for on-chain verification. The marketplace never
holds a key.

Signing lives here as FIXED code — never an LLM-callable tool — mirroring the signing
boundary in agent-ivl (app/agent/signing.py). We do NOT use the SDK X402Payer: the
marketplace settlement is `extra.settlement == "client-transfer"` (a plain ERC-20
transfer verified by the Transfer log), not the EIP-3009 flow X402Payer expects, and
make_x402_payer is unimplemented for evm-local wallets. So we broadcast the transfer
the quote demands, exactly as the seller's LP code does (pancake_v3.send_tx pattern).
"""

from __future__ import annotations

import re
from typing import Any

from bnbagent_studio_core.wallet import get_wallet
from web3 import Web3

# Minimal ERC-20 ABI — just the transfer we need to encode.
ERC20_ABI = [
    {
        "name": "transfer",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    }
]

_NATIVE_RE = re.compile(r"^0x0{40}$")


def payer_address() -> str:
    """The SDK wallet address that will pay (and be recorded as the hirer)."""
    return get_wallet().address


def _is_native(asset: str) -> bool:
    return asset == "native" or bool(_NATIVE_RE.match(asset))


def pay_quote(accept: dict[str, Any], *, rpc_url: str, timeout: float = 180.0) -> str:
    """Broadcast the transfer the x402 `accept` demands; return the 0x tx hash.

    For an ERC-20 asset: transfer(payTo, maxAmountRequired) on the token.
    For a native asset ("native"): send value=maxAmountRequired to payTo.

    Signs with the SDK wallet (sole key-holder) and waits for the receipt — same
    fixed-code broadcast pattern as agent-ivl/app/agent/pancake_v3.send_tx.
    """
    wallet = get_wallet()
    w3 = Web3(Web3.HTTPProvider(rpc_url))

    owner = Web3.to_checksum_address(wallet.address)
    pay_to = Web3.to_checksum_address(accept["payTo"])
    amount = int(accept["maxAmountRequired"])
    asset = str(accept["asset"])

    tx: dict[str, Any] = {
        "from": owner,
        "chainId": w3.eth.chain_id,
        "nonce": w3.eth.get_transaction_count(owner),
        "gasPrice": w3.eth.gas_price,
    }

    if _is_native(asset):
        tx.update({"to": pay_to, "value": amount, "gas": 21_000})
    else:
        token = w3.eth.contract(address=Web3.to_checksum_address(asset), abi=ERC20_ABI)
        data = token.encode_abi("transfer", args=[pay_to, amount])
        tx.update({"to": Web3.to_checksum_address(asset), "value": 0, "data": data})
        try:
            tx["gas"] = int(w3.eth.estimate_gas({"from": owner, "to": tx["to"], "data": data}) * 1.2)
        except Exception:  # noqa: BLE001 — fall back to a generous testnet cap
            tx["gas"] = 120_000

    signed = wallet.sign_transaction(tx)
    raw = signed["rawTransaction"] if isinstance(signed, dict) else signed.raw_transaction
    h = w3.eth.send_raw_transaction(raw)
    w3.eth.wait_for_transaction_receipt(h, timeout=timeout)
    return h.hex() if isinstance(h, bytes) else str(h)
