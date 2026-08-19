"""Ejecución LP en PancakeSwap v3 con los ticks de IVL — el núcleo del rebalanceo.

Roadmap §3.2 (camino elegido): encodear y enviar
``NonfungiblePositionManager.mint(MintParams{…})`` DIRECTO con los ticks de
``/v1/ivl/ticks``, firmando con el ``EVMWalletProvider`` del SDK
(``bnbagent_studio_core.wallet.get_wallet``) — el agente es el ÚNICO firmante.
Python-nativo (web3.py), NO el tool Node de bsc-mcp: el stack de este agente es Python.

Este módulo es CÓDIGO FIJO de firma, del mismo lado que ``signing.py`` — **nunca** un
tool invocable por el LLM (CLAUDE.md/scaffold: dinero y mutaciones jamás en el LLM).
El único helper LLM-callable es el *plan de solo-lectura* (ver ``rebalance.py`` →
``tools.py``), que hace dry-run y no firma nada.

Direcciones BSC testnet (chainId 97) verificadas en vivo 18-ago-2026:
- V3Factory  0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865  (deploy determinista multichain)
- NPM        0x427bF5b37357632377eCbEC9de3626C71A5396c1  (Pancake V3 Positions NFT-V1)
- WBNB       0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd
- USDT       0x337610d27c682E347C9cD60BD4b3b107C9d34dDd  (pools WBNB/USDT vivos en 100/500/2500/10000)

⚠ Orientación de ticks: IVL cotiza base-quote (BNB-USDT ⇒ ticks +). Como
``USDT < WBNB`` por address, el pool tiene ``token0=USDT`` y sus ticks van NEGADOS e
invertidos. :func:`orient_ticks` lo reconcilia leyendo ``pool.token0()``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from web3 import Web3

from ivl_client import IvlTicks

# --- Constantes de tick de Uniswap/Pancake v3 --------------------------------
MIN_TICK = -887272
MAX_TICK = 887272

# --- Config de red (BSC testnet por defecto; el par flagship es BNB-USDT) -----
DEFAULT_RPCS = (
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    "https://bsc-testnet.publicnode.com",
    "https://bsc-testnet-rpc.publicnode.com",
)


@dataclass(frozen=True)
class RebalancerConfig:
    """Direcciones + red para ejecutar el LP. Defaults = BSC testnet BNB-USDT."""

    factory: str = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"
    position_manager: str = "0x427bF5b37357632377eCbEC9de3626C71A5396c1"
    base_token: str = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"  # WBNB
    quote_token: str = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"  # USDT
    base_symbol: str = "WBNB"
    quote_symbol: str = "USDT"
    chain_id: int = 97
    rpcs: tuple[str, ...] = DEFAULT_RPCS

    def checksummed(self) -> "RebalancerConfig":
        c = Web3.to_checksum_address
        return RebalancerConfig(
            factory=c(self.factory),
            position_manager=c(self.position_manager),
            base_token=c(self.base_token),
            quote_token=c(self.quote_token),
            base_symbol=self.base_symbol,
            quote_symbol=self.quote_symbol,
            chain_id=self.chain_id,
            rpcs=self.rpcs,
        )


DEFAULT_TESTNET_CONFIG = RebalancerConfig()

# --- ABIs mínimas ------------------------------------------------------------
FACTORY_ABI = [
    {"inputs": [{"type": "address"}, {"type": "address"}, {"type": "uint24"}],
     "name": "getPool", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
]
POOL_ABI = [
    {"inputs": [], "name": "token0", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "token1", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "fee", "outputs": [{"type": "uint24"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "tickSpacing", "outputs": [{"type": "int24"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "slot0",
     "outputs": [{"type": "uint160", "name": "sqrtPriceX96"}, {"type": "int24", "name": "tick"},
                 {"type": "uint16"}, {"type": "uint16"}, {"type": "uint16"}, {"type": "uint32"}, {"type": "bool"}],
     "stateMutability": "view", "type": "function"},
]
ERC20_ABI = [
    {"inputs": [{"type": "address"}], "name": "balanceOf", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "decimals", "outputs": [{"type": "uint8"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "symbol", "outputs": [{"type": "string"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"type": "address"}, {"type": "address"}], "name": "allowance", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"type": "address"}, {"type": "uint256"}], "name": "approve", "outputs": [{"type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
]
# NonfungiblePositionManager.mint(MintParams) — idéntico a Uniswap v3.
NPM_ABI = [
    {"inputs": [{"components": [
        {"type": "address", "name": "token0"},
        {"type": "address", "name": "token1"},
        {"type": "uint24", "name": "fee"},
        {"type": "int24", "name": "tickLower"},
        {"type": "int24", "name": "tickUpper"},
        {"type": "uint256", "name": "amount0Desired"},
        {"type": "uint256", "name": "amount1Desired"},
        {"type": "uint256", "name": "amount0Min"},
        {"type": "uint256", "name": "amount1Min"},
        {"type": "address", "name": "recipient"},
        {"type": "uint256", "name": "deadline"},
    ], "internalType": "struct INonfungiblePositionManager.MintParams", "name": "params", "type": "tuple"}],
     "name": "mint",
     "outputs": [{"type": "uint256", "name": "tokenId"}, {"type": "uint128", "name": "liquidity"},
                 {"type": "uint256", "name": "amount0"}, {"type": "uint256", "name": "amount1"}],
     "stateMutability": "payable", "type": "function"},
]


# --- Web3 --------------------------------------------------------------------
def connect(config: RebalancerConfig = DEFAULT_TESTNET_CONFIG, *, timeout: float = 10.0) -> Web3:
    """Devuelve un Web3 conectado al primer RPC vivo de ``config.rpcs``."""
    last: Exception | None = None
    for rpc in config.rpcs:
        try:
            w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={"timeout": timeout}))
            if w3.is_connected():
                return w3
        except Exception as exc:  # noqa: BLE001 — probamos el siguiente RPC
            last = exc
    raise ConnectionError(f"no live BSC-testnet RPC in {config.rpcs} ({last})")


# --- Reconciliación de orientación de ticks ----------------------------------
def _snap(tick: int, spacing: int, *, up: bool) -> int:
    """Redondea ``tick`` al múltiplo de ``spacing`` (hacia abajo/arriba) y lo acota."""
    q = tick / spacing
    snapped = (int(q) + (1 if up and q > int(q) else 0)) * spacing if up else (
        (int(q) - (1 if q < 0 and q != int(q) else 0)) * spacing
    )
    return max(MIN_TICK, min(MAX_TICK, snapped))


@dataclass(frozen=True)
class OrientedTicks:
    """Ticks ya orientados al pool on-chain y snappeados al ``tickSpacing`` real."""

    tick_lower: int
    tick_upper: int
    inverted: bool  # True si se negó/invirtió respecto a la convención de IVL


def orient_ticks(ivl: IvlTicks, pool_token0: str, config: RebalancerConfig, spacing: int) -> OrientedTicks:
    """Reorienta los ticks de IVL (base-quote) a la convención token0/token1 del pool.

    IVL cotiza precio = quote por base (USDT por BNB) ⇒ ticks respecto a token0=BASE.
    Si el pool tiene ``token0 == quote`` (caso BSC testnet: USDT<WBNB), el signo del
    tick se invierte: ``[lo, hi] → [-hi, -lo]``. Luego se snapea al spacing real.
    """
    inverted = Web3.to_checksum_address(pool_token0) == Web3.to_checksum_address(config.quote_token)
    lo, hi = (-ivl.tick_upper, -ivl.tick_lower) if inverted else (ivl.tick_lower, ivl.tick_upper)
    lo_s = _snap(lo, spacing, up=False)
    hi_s = _snap(hi, spacing, up=True)
    if lo_s >= hi_s:  # degenerado tras snap → asegura al menos un spacing de ancho
        hi_s = lo_s + spacing
    return OrientedTicks(tick_lower=lo_s, tick_upper=hi_s, inverted=inverted)


# --- Construcción de la tx de mint -------------------------------------------
@dataclass
class MintPlan:
    """Todo lo necesario para (dry-run o) enviar el mint. Amounts en wei."""

    config: RebalancerConfig
    pool: str
    token0: str
    token1: str
    fee: int
    tick_lower: int
    tick_upper: int
    amount0_desired: int
    amount1_desired: int
    amount0_min: int = 0
    amount1_min: int = 0
    recipient: str = ""
    deadline: int = 0
    pool_tick: int | None = None
    inverted: bool = False
    extra: dict[str, Any] = field(default_factory=dict)

    def mint_params(self) -> tuple:
        return (
            self.token0, self.token1, self.fee,
            self.tick_lower, self.tick_upper,
            self.amount0_desired, self.amount1_desired,
            self.amount0_min, self.amount1_min,
            self.recipient, self.deadline,
        )


def build_mint_plan(
    w3: Web3,
    ivl: IvlTicks,
    *,
    recipient: str,
    amount_base_wei: int,
    amount_quote_wei: int,
    config: RebalancerConfig = DEFAULT_TESTNET_CONFIG,
    deadline: int | None = None,
    slippage_min: bool = False,
) -> MintPlan:
    """Lee el pool real, reorienta los ticks de IVL y arma el :class:`MintPlan`.

    ``amount_base_wei``/``amount_quote_wei`` son las cantidades de BASE (WBNB) y
    QUOTE (USDT); se mapean a amount0/amount1 según el orden del pool. ``deadline``
    por defecto lo pone el llamador (no usamos ``time`` aquí para tests deterministas).
    """
    config = config.checksummed()
    recipient = Web3.to_checksum_address(recipient)
    factory = w3.eth.contract(address=config.factory, abi=FACTORY_ABI)
    pool_addr = factory.functions.getPool(config.base_token, config.quote_token, ivl.fee_units).call()
    if int(pool_addr, 16) == 0:
        raise ValueError(
            f"no existe pool {config.base_symbol}/{config.quote_symbol} fee={ivl.fee_units} en la factory"
        )
    pool_addr = Web3.to_checksum_address(pool_addr)
    pool = w3.eth.contract(address=pool_addr, abi=POOL_ABI)
    token0 = Web3.to_checksum_address(pool.functions.token0().call())
    token1 = Web3.to_checksum_address(pool.functions.token1().call())
    spacing = pool.functions.tickSpacing().call()
    slot0 = pool.functions.slot0().call()
    pool_tick = int(slot0[1])

    oriented = orient_ticks(ivl, token0, config, spacing)

    # Mapear base/quote → amount0/amount1 según el orden real del pool.
    if token0 == config.base_token:
        amount0, amount1 = amount_base_wei, amount_quote_wei
    else:
        amount0, amount1 = amount_quote_wei, amount_base_wei

    return MintPlan(
        config=config, pool=pool_addr, token0=token0, token1=token1,
        fee=ivl.fee_units, tick_lower=oriented.tick_lower, tick_upper=oriented.tick_upper,
        amount0_desired=amount0, amount1_desired=amount1,
        amount0_min=amount0 if slippage_min else 0,
        amount1_min=amount1 if slippage_min else 0,
        recipient=recipient, deadline=deadline or 0,
        pool_tick=pool_tick, inverted=oriented.inverted,
        extra={"tick_spacing": spacing},
    )


def encode_mint_calldata(w3: Web3, plan: MintPlan) -> str:
    """ABI-encode ``NPM.mint(params)`` → calldata hex (sin firmar)."""
    npm = w3.eth.contract(address=plan.config.position_manager, abi=NPM_ABI)
    return npm.encode_abi("mint", args=[plan.mint_params()])


def encode_approve_calldata(w3: Web3, token: str, spender: str, amount: int) -> str:
    """ABI-encode ``ERC20.approve(spender, amount)`` → calldata hex."""
    erc20 = w3.eth.contract(address=Web3.to_checksum_address(token), abi=ERC20_ABI)
    return erc20.encode_abi("approve", args=[Web3.to_checksum_address(spender), amount])


def decode_mint_calldata(w3: Web3, calldata: str) -> dict[str, Any]:
    """Round-trip inverso: decodifica el calldata y devuelve los MintParams.

    Prueba de que el encoding preserva ``tickLower/tickUpper`` (verificación offline
    determinista, sin red).
    """
    npm = w3.eth.contract(address=DEFAULT_TESTNET_CONFIG.checksummed().position_manager, abi=NPM_ABI)
    fn, params = npm.decode_function_input(calldata)
    p = params["params"]
    # web3 puede devolver tuple o dict según versión; normalizamos por nombre.
    if isinstance(p, (list, tuple)):
        keys = ["token0", "token1", "fee", "tickLower", "tickUpper", "amount0Desired",
                "amount1Desired", "amount0Min", "amount1Min", "recipient", "deadline"]
        p = dict(zip(keys, p))
    return {"function": fn.fn_name, "params": p}
