"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Download,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Trash2,
  Upload
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clearReplayFrames,
  exportReplaySession,
  importReplaySession,
  listReplayFrames,
  listReplaySessions
} from "@/lib/replay/db";
import {
  buildReplaySessionFilename,
  parseReplaySessionTransfer
} from "@/lib/replay/transfer";
import { buildReplayTimeline, summarizeReplayFrames } from "@/lib/replay/utils";
import { SupportedSymbol } from "@/lib/types";
import { useMarketStore } from "@/store/market-store";

interface ReplayCachePanelProps {
  symbol: SupportedSymbol;
  expiry: string;
}

const PLAYBACK_INTERVALS: Record<string, number> = {
  "1x": 900,
  "2x": 450,
  "4x": 225
};

function formatSessionLabel(sessionDate: string) {
  return format(new Date(`${sessionDate}T00:00:00`), "dd MMM");
}

export function ReplayCachePanel({ symbol, expiry }: ReplayCachePanelProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyReplayFrame = useMarketStore((state) => state.applyReplayFrame);
  const stopReplay = useMarketStore((state) => state.stopReplay);
  const replayActive = useMarketStore((state) => state.replayActive);
  const replayFrameLabel = useMarketStore((state) => state.replayFrameLabel);

  const [selectedSessionDate, setSelectedSessionDate] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof PLAYBACK_INTERVALS>("1x");
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);

  const sessions = useLiveQuery(
    () => (expiry ? listReplaySessions(symbol, expiry) : Promise.resolve([])),
    [symbol, expiry]
  );

  const frames = useLiveQuery(
    () =>
      expiry && selectedSessionDate
        ? listReplayFrames(symbol, expiry, 360, selectedSessionDate)
        : Promise.resolve([]),
    [symbol, expiry, selectedSessionDate]
  );

  useEffect(() => {
    if (!sessions?.length) {
      setSelectedSessionDate("");
      setSelectedIndex(0);
      setPlaying(false);
      return;
    }

    const selectedStillExists = sessions.some(
      (session) => session.sessionDate === selectedSessionDate
    );

    if (!selectedSessionDate || !selectedStillExists) {
      setSelectedSessionDate(sessions[0]?.sessionDate ?? "");
    }
  }, [selectedSessionDate, sessions]);

  useEffect(() => {
    if (!frames?.length) {
      setSelectedIndex(0);
      setPlaying(false);
      return;
    }

    setSelectedIndex(frames.length - 1);
    setPlaying(false);
  }, [frames?.length, symbol, expiry, selectedSessionDate]);

  useEffect(() => {
    if (!playing || !frames?.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        const next = Math.min(current + 1, frames.length - 1);
        if (next === frames.length - 1) {
          setPlaying(false);
        }
        return next;
      });
    }, PLAYBACK_INTERVALS[speed]);

    return () => {
      window.clearInterval(timer);
    };
  }, [frames, playing, speed]);

  useEffect(() => {
    if (!replayActive || !frames?.length) {
      return;
    }

    const frame = frames[selectedIndex];
    if (!frame) {
      return;
    }

    applyReplayFrame({
      mode: frame.sourceMode,
      expiry: frame.expiry,
      rows: frame.rows,
      aggregates: frame.aggregates,
      spot: frame.spot,
      updatedAt: frame.updatedAt,
      timeline: buildReplayTimeline(frames.slice(0, selectedIndex + 1)),
      label: `${selectedIndex + 1}/${frames.length} @ ${format(
        new Date(frame.updatedAt),
        "HH:mm:ss"
      )}`
    });
  }, [applyReplayFrame, frames, replayActive, selectedIndex]);

  const summary = useMemo(() => summarizeReplayFrames(frames ?? []), [frames]);
  const selectedFrame = frames?.[selectedIndex];
  const selectedSession = sessions?.find(
    (session) => session.sessionDate === selectedSessionDate
  );
  const frameCount = frames?.length ?? 0;
  const hasFrames = Boolean(frames?.length);

  const startReplay = () => {
    if (!frames?.length || !selectedFrame) {
      return;
    }

    applyReplayFrame({
      mode: selectedFrame.sourceMode,
      expiry: selectedFrame.expiry,
      rows: selectedFrame.rows,
      aggregates: selectedFrame.aggregates,
      spot: selectedFrame.spot,
      updatedAt: selectedFrame.updatedAt,
      timeline: buildReplayTimeline(frames.slice(0, selectedIndex + 1)),
      label: `${selectedIndex + 1}/${frames.length} @ ${format(
        new Date(selectedFrame.updatedAt),
        "HH:mm:ss"
      )}`
    });
  };

  const resumeLive = async () => {
    setPlaying(false);
    stopReplay();
    await queryClient.invalidateQueries();
  };

  const handleClear = async () => {
    if (!selectedSessionDate) {
      return;
    }

    setTransferBusy(true);
    setTransferError(null);
    setTransferMessage(null);
    setPlaying(false);

    try {
      if (replayActive) {
        stopReplay();
      }

      await clearReplayFrames(symbol, expiry, selectedSessionDate);
      await queryClient.invalidateQueries();
      setTransferMessage(`Cleared local replay session ${selectedSessionDate}.`);
    } catch (error) {
      setTransferError(
        error instanceof Error ? error.message : "Replay session clear failed."
      );
    } finally {
      setTransferBusy(false);
    }
  };

  const handleExport = async () => {
    if (!selectedSessionDate) {
      return;
    }

    setTransferBusy(true);
    setTransferError(null);
    setTransferMessage(null);

    try {
      const payload = await exportReplaySession(symbol, expiry, selectedSessionDate);
      if (!payload) {
        setTransferError("No cached replay session is available to export.");
        return;
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildReplaySessionFilename(payload);
      anchor.click();
      window.URL.revokeObjectURL(url);

      setTransferMessage(`Exported ${payload.frames.length} frames for ${payload.sessionDate}.`);
    } catch (error) {
      setTransferError(
        error instanceof Error ? error.message : "Replay export failed."
      );
    } finally {
      setTransferBusy(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setTransferBusy(true);
    setTransferError(null);
    setTransferMessage(null);
    setPlaying(false);

    if (replayActive) {
      stopReplay();
    }

    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const payload = parseReplaySessionTransfer(raw);
      const result = await importReplaySession(payload);
      setSelectedSessionDate(result.sessionDate);
      await queryClient.invalidateQueries();
      setTransferMessage(
        `Imported ${result.importedCount} frames for ${payload.symbol} ${payload.sessionDate}.`
      );
    } catch (error) {
      setTransferError(
        error instanceof Error ? error.message : "Replay import failed."
      );
    } finally {
      event.target.value = "";
      setTransferBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Local Replay Cache</span>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Dexie
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImport}
        />

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Cached Frames
            </p>
            <p className="mt-2 text-xl font-semibold">{summary.count}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Coverage Start
            </p>
            <p className="mt-2 text-sm font-medium">
              {summary.firstUpdatedAt
                ? format(new Date(summary.firstUpdatedAt), "dd MMM, HH:mm:ss")
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Coverage End
            </p>
            <p className="mt-2 text-sm font-medium">
              {summary.lastUpdatedAt
                ? format(new Date(summary.lastUpdatedAt), "dd MMM, HH:mm:ss")
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border border-border/80 bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Latest Spot
            </p>
            <p className="mt-2 text-xl font-semibold">
              {summary.latestSpot
                ? summary.latestSpot.toLocaleString("en-IN", {
                    maximumFractionDigits: 2
                  })
                : "-"}
            </p>
          </div>
        </div>

        {sessions?.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {sessions.map((session) => {
              const active = session.sessionDate === selectedSessionDate;

              return (
                <button
                  key={session.sessionDate}
                  type="button"
                  onClick={() => setSelectedSessionDate(session.sessionDate)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-[#00ff7e] bg-[#00ff7e]/10 text-[#00ff7e]"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {formatSessionLabel(session.sessionDate)} - {session.frameCount}f
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="space-y-3 rounded-lg border border-border/80 bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {symbol} {expiry || "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedFrame && selectedSession
                  ? `Selected ${selectedIndex + 1} of ${frameCount} - ${formatDistanceToNowStrict(
                      new Date(selectedFrame.updatedAt),
                      { addSuffix: true }
                    )} - Session ${selectedSession.sessionDate}`
                  : "Import a replay JSON file or keep the dashboard open to build local sessions."}
              </p>
              {replayActive && replayFrameLabel ? (
                <p className="mt-1 text-xs text-bullish">Replaying {replayFrameLabel}</p>
              ) : null}
              {transferMessage ? (
                <p className="mt-1 text-xs text-bullish">{transferMessage}</p>
              ) : null}
              {transferError ? (
                <p className="mt-1 text-xs text-destructive">{transferError}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={speed}
                onChange={(event) =>
                  setSpeed(event.target.value as keyof typeof PLAYBACK_INTERVALS)
                }
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                disabled={!hasFrames || transferBusy}
              >
                {Object.keys(PLAYBACK_INTERVALS).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                disabled={transferBusy}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!selectedSessionDate || !hasFrames || transferBusy}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Session
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={startReplay}
                disabled={!selectedFrame || transferBusy}
              >
                <Radio className="mr-2 h-4 w-4" />
                Load Frame
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  startReplay();
                  setPlaying((value) => !value);
                }}
                disabled={!selectedFrame || transferBusy}
              >
                {playing ? (
                  <Pause className="mr-2 h-4 w-4" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button variant="outline" size="sm" onClick={resumeLive}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Resume Live
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleClear}
                disabled={!selectedSessionDate || transferBusy}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Session
              </Button>
            </div>
          </div>

          {hasFrames ? (
            <>
              <input
                type="range"
                min={0}
                max={Math.max(frameCount - 1, 0)}
                value={selectedIndex}
                onChange={(event) => setSelectedIndex(Number(event.target.value))}
                className="w-full accent-[#00ff7e]"
              />

              {selectedFrame ? (
                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                  <p>
                    Spot:{" "}
                    {selectedFrame.spot.toLocaleString("en-IN", {
                      maximumFractionDigits: 2
                    })}
                  </p>
                  <p>
                    Call OI:{" "}
                    {selectedFrame.aggregates.totalCallOi.toLocaleString("en-IN")}
                  </p>
                  <p>
                    Put OI:{" "}
                    {selectedFrame.aggregates.totalPutOi.toLocaleString("en-IN")}
                  </p>
                  <p>Source: {selectedFrame.sourceMode.toUpperCase()}</p>
                </div>
              ) : null}

              {selectedSession ? (
                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                  <p>Session frames: {selectedSession.frameCount}</p>
                  <p>
                    First:{" "}
                    {selectedSession.firstUpdatedAt
                      ? format(new Date(selectedSession.firstUpdatedAt), "HH:mm:ss")
                      : "-"}
                  </p>
                  <p>
                    Last:{" "}
                    {selectedSession.lastUpdatedAt
                      ? format(new Date(selectedSession.lastUpdatedAt), "HH:mm:ss")
                      : "-"}
                  </p>
                  <p>Degraded frames: {selectedSession.degradedCount}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-background/30 p-6 text-sm text-muted-foreground">
              No local frames cached for this selection yet. Keep the dashboard open for a few updates or import a replay JSON file.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
