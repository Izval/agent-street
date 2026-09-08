// keepalive — pings each URL in KEEPALIVE_URLS on a cron so free-tier hosts
// (e.g. Render free, which spins down after ~15 min idle) never sleep. Also
// exposes GET / for an on-demand ping + status readout.
//
// Targets are pure config (KEEPALIVE_URLS, comma-separated) — this Worker has no
// hardcoded dependency on any service.

export interface Env {
  KEEPALIVE_URLS: string;
}

interface PingResult {
  url: string;
  ok: boolean;
  status?: number;
  ms?: number;
  error?: string;
}

function targets(env: Env): string[] {
  return (env.KEEPALIVE_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

async function pingOne(url: string): Promise<PingResult> {
  const started = Date.now();
  const ctrl = new AbortController();
  // Generous timeout: a cold Render free instance can take ~50s to wake.
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: { "user-agent": "agent-street-keepalive/1.0" },
    });
    return { url, ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { url, ok: false, error: String((e as Error)?.message || e), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function pingAll(env: Env): Promise<PingResult[]> {
  return Promise.all(targets(env).map(pingOne));
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      pingAll(env).then((results) => {
        if (results.length === 0) {
          console.log("[keepalive] no KEEPALIVE_URLS configured — nothing to ping");
          return;
        }
        for (const r of results) {
          console.log(
            `[keepalive] ${r.ok ? "OK" : "FAIL"} ${r.url}` +
              `${r.status ? ` ${r.status}` : ""}${r.ms != null ? ` ${r.ms}ms` : ""}` +
              `${r.error ? ` ${r.error}` : ""}`,
          );
        }
      }),
    );
  },

  async fetch(_req: Request, env: Env): Promise<Response> {
    const pinged = await pingAll(env);
    const body = { at: new Date().toISOString(), count: pinged.length, pinged };
    return new Response(JSON.stringify(body, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
};
