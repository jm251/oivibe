import { ReplayFrameRecord } from "@/lib/replay/db";

export interface ReplayTimelinePoint {
  time: number;
  spot: number;
  callOi: number;
  putOi: number;
}

export interface ReplaySessionSummary {
  sessionDate: string;
  frameCount: number;
  firstUpdatedAt: string | null;
  lastUpdatedAt: string | null;
  latestSpot: number;
  degradedCount: number;
}

export function deriveReplaySessionDate(updatedAt: string) {
  return updatedAt.slice(0, 10);
}

export function buildReplayTimeline(frames: ReplayFrameRecord[]): ReplayTimelinePoint[] {
  return frames.map((frame) => ({
    time: Math.floor(new Date(frame.updatedAt).getTime() / 1000),
    spot: frame.spot,
    callOi: frame.aggregates.totalCallOi,
    putOi: frame.aggregates.totalPutOi
  }));
}

export function summarizeReplayFrames(frames: ReplayFrameRecord[]) {
  const count = frames.length;
  const first = frames[0];
  const last = frames[count - 1];

  return {
    count,
    firstUpdatedAt: first?.updatedAt ?? null,
    lastUpdatedAt: last?.updatedAt ?? null,
    latestSpot: last?.spot ?? 0
  };
}

export function summarizeReplaySessions(
  frames: ReplayFrameRecord[]
): ReplaySessionSummary[] {
  const grouped = new Map<string, ReplayFrameRecord[]>();

  for (const frame of frames) {
    const sessionDate = frame.sessionDate || deriveReplaySessionDate(frame.updatedAt);
    const existing = grouped.get(sessionDate) ?? [];
    existing.push(frame);
    grouped.set(sessionDate, existing);
  }

  return Array.from(grouped.entries())
    .map(([sessionDate, sessionFrames]) => {
      const sorted = [...sessionFrames].sort((a, b) =>
        a.updatedAt.localeCompare(b.updatedAt)
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      return {
        sessionDate,
        frameCount: sorted.length,
        firstUpdatedAt: first?.updatedAt ?? null,
        lastUpdatedAt: last?.updatedAt ?? null,
        latestSpot: last?.spot ?? 0,
        degradedCount: sorted.filter((frame) => frame.degraded).length
      };
    })
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
}
