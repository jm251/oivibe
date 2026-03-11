"use client";

import { useQuery } from "@tanstack/react-query";

import {
  computeReplaySessionAnalytics,
  type ReplaySessionAnalytics
} from "@/lib/replay/analytics";
import { ReplayFrameRecord } from "@/lib/replay/db";

export function useReplayAnalytics(
  frames: ReplayFrameRecord[] | undefined,
  sessionDate: string
) {
  const frameCount = frames?.length ?? 0;
  const firstUpdatedAt = frames?.[0]?.updatedAt ?? "";
  const lastUpdatedAt = frames?.[frameCount - 1]?.updatedAt ?? "";

  return useQuery<ReplaySessionAnalytics | null>({
    queryKey: [
      "replay-analytics",
      sessionDate,
      frameCount,
      firstUpdatedAt,
      lastUpdatedAt
    ],
    enabled: Boolean(sessionDate) && frameCount > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => computeReplaySessionAnalytics(frames ?? [])
  });
}
