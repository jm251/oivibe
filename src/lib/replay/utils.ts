import { ReplayFrameRecord } from "@/lib/replay/db";

export interface ReplayTimelinePoint {
  time: number;
  spot: number;
  callOi: number;
  putOi: number;
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
