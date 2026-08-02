"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { fetchStreamStatus, openLiveStreamSocket, startLiveStream, stopLiveStream } from "@/lib/api";
import type { LiveStreamEvent, ModelUpdate } from "@/lib/types";
import { Panel, Badge } from "./ui";

export function LiveStreamPanel({
  analysisId,
  primaryMetric,
}: {
  analysisId: string;
  primaryMetric: string | null;
}) {
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [lastRow, setLastRow] = useState<Record<string, unknown> | null>(null);
  const [lastUpdate, setLastUpdate] = useState<ModelUpdate | null>(null);
  const [feed, setFeed] = useState<Record<string, unknown>[]>([]);
  const closeSocketRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // The producer keeps running server-side across a refresh (it only
    // stops on an explicit "Stop" click) — but a refresh always tears down
    // this component's state and its WebSocket, so without this the panel
    // would wrongly show "Go live" as if nothing were happening even while
    // Kafka rows keep flowing in the background. Every other panel that
    // "survives" a refresh does so by re-fetching a value from a REST
    // endpoint on mount; this is that same fix applied to a live socket
    // instead of a one-shot value.
    let cancelled = false;
    fetchStreamStatus(analysisId)
      .then((status) => {
        if (cancelled || !status.running) return;
        setRowCount(status.row_count);
        closeSocketRef.current = openLiveStreamSocket(analysisId, handleEvent);
        setLive(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      // Leaving the tab/dataset shouldn't silently keep polling the
      // backend forever with nothing listening — the WebSocket itself
      // closes here; the server-side producer only stops via "Stop".
      closeSocketRef.current?.();
    };
  }, [analysisId]);

  function handleEvent(event: LiveStreamEvent) {
    if (event.type === "stopped") {
      setLive(false);
      closeSocketRef.current?.();
      closeSocketRef.current = null;
      return;
    }
    if (event.type === "new_row" && event.row) {
      setRowCount(event.row_count ?? null);
      setLastRow(event.row);
      setLastUpdate(event.model_update ?? null);
      setFeed((prev) => [event.row!, ...prev].slice(0, 5));
    }
  }

  async function goLive() {
    setStarting(true);
    try {
      await startLiveStream(analysisId);
      closeSocketRef.current = openLiveStreamSocket(analysisId, handleEvent);
      setLive(true);
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    await stopLiveStream(analysisId);
    closeSocketRef.current?.();
    closeSocketRef.current = null;
    setLive(false);
  }

  // Stopping shouldn't wipe what already happened — rowCount/lastUpdate/feed
  // stay in state and keep being shown (as a "last known" summary) even
  // after `live` flips false; only a brand-new "Go live" resets them.
  const hasHistory = rowCount !== null || feed.length > 0;

  return (
    <Panel
      title="Live data feed"
      subtitle="Simulates new rows arriving for this dataset in real time over Kafka — no re-upload needed to see the dashboard update."
      actions={
        live ? (
          <Badge tone="bad">
            <Radio className="h-3 w-3 animate-pulse" /> LIVE
          </Badge>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {!live && !hasHistory && (
          <button onClick={goLive} disabled={starting} className="btn-primary">
            {starting ? "Starting…" : "Go live"}
          </button>
        )}

        {(live || hasHistory) && (
          <>
            {!live && (
              <p className="text-xs text-muted">Stopped — showing what was ingested before you stopped it.</p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Rows ingested</p>
                <p className="font-display text-2xl font-bold text-foreground">{rowCount ?? "—"}</p>
              </div>
              {primaryMetric && lastUpdate && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Live model error</p>
                  <p className="font-display text-2xl font-bold text-accent">
                    {lastUpdate.abs_pct_error !== null ? `${lastUpdate.abs_pct_error}%` : "warming up…"}
                  </p>
                </div>
              )}
              <button onClick={live ? stop : goLive} disabled={starting} className="btn-secondary ml-auto">
                {live ? "Stop" : starting ? "Starting…" : "Go live again"}
              </button>
            </div>

            {lastRow && (
              <div className="rounded-xl border border-border bg-white/[0.02] p-3">
                <p className="text-xs text-muted mb-1">{live ? "Just arrived:" : "Last row received:"}</p>
                <p className="font-mono text-xs text-foreground/80 truncate">
                  {Object.entries(lastRow)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(", ")}
                </p>
              </div>
            )}

            {feed.length > 1 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-muted hover:text-foreground">
                  Show last {feed.length} rows
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {feed.map((row, i) => (
                    <li key={i} className="font-mono text-muted rounded-lg border border-border/60 p-2">
                      {Object.entries(row)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
