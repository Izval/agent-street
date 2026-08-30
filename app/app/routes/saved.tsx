import { Link } from "react-router";

import type { Route } from "./+types/saved";
import { useSavedAgents, type SavedAgent } from "../lib/saved";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/Card";
import { SaveButton } from "../components/SaveButton";
import { SourceBadge } from "../components/Badge";
import { ScoreMeter } from "../components/ScoreMeter";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Saved agents — Agent-Street" }];
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function SavedCard({ a }: { a: SavedAgent }) {
  return (
    <Card className="relative flex items-center gap-3 p-4 transition-colors hover:border-brand">
      <Link
        to={`/agent/${encodeURIComponent(a.id)}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-sm font-bold text-text-2">
          {a.imageUrl ? (
            <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(a.name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-text">{a.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {a.categoryLabel && (
              <span className="rounded-[999px] bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-text-2">
                {a.categoryLabel}
              </span>
            )}
            <SourceBadge source={a.source} />
          </div>
        </div>
      </Link>
      <div className="shrink-0">
        <ScoreMeter score={a.score} size="sm" />
      </div>
      <SaveButton
        agent={a}
        variant="icon"
        className="shrink-0"
      />
    </Card>
  );
}

export default function Saved() {
  const saved = useSavedAgents();

  return (
    <AppShell>
      <div className="mx-auto max-w-[820px]">
        <div className="flex items-end justify-between py-2">
          <div>
            <h1 className="text-3xl font-bold">Saved agents</h1>
            <p className="tnum mt-1 text-sm text-text-3">
              {saved.length} saved · stored on this device
            </p>
          </div>
          <Link
            to="/"
            className="text-sm text-text-3 transition-colors hover:text-text"
          >
            ← Marketplace
          </Link>
        </div>

        {saved.length === 0 ? (
          <Card className="mt-6 flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-sm text-text-2">
              You haven't saved any agents yet. Tap{" "}
              <span className="text-brand">♥ Save</span> on an agent to keep it
              here for later.
            </p>
            <Link
              to="/"
              className="rounded-[8px] bg-brand px-5 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-brand-bright"
            >
              Explore the marketplace
            </Link>
          </Card>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            {saved.map((a) => (
              <SavedCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
