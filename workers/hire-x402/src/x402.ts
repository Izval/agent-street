// x402.ts — helpers del seam de contratación (agent-street · hire-x402).
//
// Rol: (1) construir el `accept` x402 (respuesta 402 con los requisitos de pago
// del listing) y (2) VERIFICAR onchain que una tx de pago del usuario realmente
// liquidó lo que el quote exigía. Este worker NO firma: el usuario paga desde su
// propia wallet (client-pays, Opción 3) y aquí solo verificamos vía RPC público.
//
// Patrón de RPC/escalado reutilizado de workers/onchain-indexer (raw JSON-RPC,
// sin viem): keyless, cero deps runtime.

// --- Formas x402 (espejo de app/app/lib/contracts.ts) ---
export interface X402Accept {
  scheme: string; // "exact"
  network: string; // "bsc-testnet"
  maxAmountRequired: string; // unidades base (string)
  asset: string; // address del token, o "native" para BNB
  payTo: string;
  resource: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown> | null;
}

export type HireStatus = "settled" | "pending" | "failed";

export interface HireReceipt {
  status: HireStatus;
  txHash: string | null;
  explorerUrl: string | null;
  amount: number | null;
  assetSymbol: string | null;
  settledAt: string | null;
  detail?: string | null;
}

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
export const TXHASH_RE = /^0x[0-9a-fA-F]{64}$/;

/** BigInt escalado a número decimal humano, sin overflow. */
export function scaleDown(raw: bigint, decimals: number): number {
  if (raw === 0n) return 0;
  const s = raw.toString().padStart(decimals + 1, "0");
  const cut = s.length - decimals;
  const intPart = s.slice(0, cut) || "0";
  const fracPart = s.slice(cut).replace(/0+$/, "");
  const n = Number(fracPart ? `${intPart}.${fracPart}` : intPart);
  return Number.isFinite(n) ? n : 0;
}

function toBigInt(v: unknown): bigint {
  if (typeof v !== "string") return 0n;
  if (/^0x[0-9a-fA-F]*$/.test(v)) {
    if (v === "0x") return 0n;
    try {
      return BigInt(v);
    } catch {
      return 0n;
    }
  }
  if (/^\d+$/.test(v)) {
    try {
      return BigInt(v);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

/** topic (32 bytes, address left-padded) → address 0x… (lowercase). */
function topicToAddress(topic: string): string {
  return "0x" + topic.slice(-40).toLowerCase();
}

// --- RPC ---
interface RpcLog {
  address?: string;
  topics?: string[];
  data?: string;
}
interface RpcReceipt {
  status?: string; // "0x1" | "0x0"
  from?: string;
  to?: string;
  logs?: RpcLog[];
}
interface RpcTx {
  from?: string;
  to?: string;
  value?: string;
}

async function rpc(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: unknown };
  if (body.error) throw new Error(`rpc_error ${JSON.stringify(body.error)}`);
  return body.result;
}

export interface VerifyInput {
  rpcUrl: string;
  txHash: string;
  accept: X402Accept;
  /** address que el front declara como pagador (se valida contra la tx). */
  from?: string | null;
  assetSymbol: string;
  assetDecimals: number;
  explorerBase: string;
}

export type VerifyResult =
  | { ok: true; receipt: HireReceipt }
  | { ok: false; status: HireStatus; detail: string };

/**
 * Verifica onchain que `txHash` liquidó el pago exigido por `accept`:
 *  - tx confirmada y status success,
 *  - para ERC-20: existe un log Transfer del `asset` con `to === payTo` y
 *    `value >= maxAmountRequired` (y `from` coincide si se declaró),
 *  - para nativo ("native"): la tx va `to === payTo` con `value >= requerido`.
 * Nunca inventa datos: si no puede verificar, devuelve pending/failed honesto.
 */
export async function verifyPayment(input: VerifyInput): Promise<VerifyResult> {
  const { rpcUrl, txHash, accept, explorerBase } = input;
  const want = toBigInt(accept.maxAmountRequired);
  const payTo = accept.payTo.toLowerCase();
  const explorerUrl = `${explorerBase.replace(/\/$/, "")}/tx/${txHash}`;

  let receipt: RpcReceipt | null;
  try {
    receipt = (await rpc(rpcUrl, "eth_getTransactionReceipt", [
      txHash,
    ])) as RpcReceipt | null;
  } catch (err) {
    return { ok: false, status: "pending", detail: `rpc: ${String(err)}` };
  }
  // Receipt aún null → la tx no está minada (el front debería esperar; pending honesto).
  if (!receipt) {
    return {
      ok: false,
      status: "pending",
      detail: "La transacción aún no está confirmada onchain.",
    };
  }
  if (receipt.status !== "0x1") {
    return { ok: false, status: "failed", detail: "La transacción revirtió onchain." };
  }
  if (input.from && receipt.from && receipt.from.toLowerCase() !== input.from.toLowerCase()) {
    return { ok: false, status: "failed", detail: "El pagador de la tx no coincide." };
  }

  const settled = (paid: bigint): HireReceipt => ({
    status: "settled",
    txHash,
    explorerUrl,
    amount: scaleDown(paid, input.assetDecimals),
    assetSymbol: input.assetSymbol,
    settledAt: new Date().toISOString(),
    detail: null,
  });

  // Pago nativo (BNB).
  if (accept.asset === "native" || /^0x0{40}$/.test(accept.asset)) {
    let tx: RpcTx | null;
    try {
      tx = (await rpc(rpcUrl, "eth_getTransactionByHash", [txHash])) as RpcTx | null;
    } catch (err) {
      return { ok: false, status: "pending", detail: `rpc: ${String(err)}` };
    }
    if (!tx || !tx.to) {
      return { ok: false, status: "failed", detail: "No se pudo leer la tx nativa." };
    }
    if (tx.to.toLowerCase() !== payTo) {
      return { ok: false, status: "failed", detail: "El destinatario nativo no es el payTo." };
    }
    const paid = toBigInt(tx.value);
    if (paid < want) {
      return { ok: false, status: "failed", detail: "El monto nativo es menor al exigido." };
    }
    return { ok: true, receipt: settled(paid) };
  }

  // Pago ERC-20: buscar el log Transfer del asset hacia payTo.
  const asset = accept.asset.toLowerCase();
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  let paid = 0n;
  let matched = false;
  for (const log of logs) {
    if (!log.topics || log.topics.length < 3) continue;
    if ((log.address ?? "").toLowerCase() !== asset) continue;
    if (log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
    if (topicToAddress(log.topics[2]) !== payTo) continue;
    const value = toBigInt(log.data);
    paid += value;
    matched = true;
  }
  if (!matched) {
    return {
      ok: false,
      status: "failed",
      detail: "No se encontró una transferencia del token al payTo en esta tx.",
    };
  }
  if (paid < want) {
    return { ok: false, status: "failed", detail: "El monto transferido es menor al exigido." };
  }
  return { ok: true, receipt: settled(paid) };
}

/** Construye el `accept` x402 del listing (fuente de quote controlada por el marketplace). */
export function buildAccept(params: {
  network: string;
  asset: string;
  assetSymbol: string;
  assetDecimals: number;
  payTo: string;
  amountBase: string;
  resource: string;
  description: string;
  maxTimeoutSeconds: number;
}): X402Accept {
  return {
    scheme: "exact",
    network: params.network,
    maxAmountRequired: params.amountBase,
    asset: params.asset,
    payTo: params.payTo,
    resource: params.resource,
    description: params.description,
    mimeType: "application/json",
    maxTimeoutSeconds: params.maxTimeoutSeconds,
    extra: {
      symbol: params.assetSymbol,
      decimals: params.assetDecimals,
      // Etiqueta honesta: el pago lo firma y envía el usuario (client-pays).
      settlement: "client-transfer",
    },
  };
}
