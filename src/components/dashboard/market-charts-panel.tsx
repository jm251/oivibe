"use client";

import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineData,
  LineSeries,
  Time
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelinePoint {
  time: number;
  spot: number;
  callOi: number;
  putOi: number;
}

export function MarketChartsPanel({ timeline }: { timeline: TimelinePoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const spotSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const callOiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const putOiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const spotData = useMemo<LineData<Time>[]>(
    () => timeline.map((point) => ({ time: point.time as Time, value: point.spot })),
    [timeline]
  );
  const callData = useMemo<LineData<Time>[]>(
    () => timeline.map((point) => ({ time: point.time as Time, value: point.callOi })),
    [timeline]
  );
  const putData = useMemo<LineData<Time>[]>(
    () => timeline.map((point) => ({ time: point.time as Time, value: point.putOi })),
    [timeline]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0a0f17" },
        textColor: "#c9d3e6"
      },
      width: containerRef.current.clientWidth,
      height: 280,
      grid: {
        vertLines: { color: "rgba(86,97,120,0.23)" },
        horzLines: { color: "rgba(86,97,120,0.23)" }
      },
      rightPriceScale: {
        borderColor: "rgba(86,97,120,0.4)"
      },
      timeScale: {
        borderColor: "rgba(86,97,120,0.4)",
        timeVisible: true,
        secondsVisible: true
      }
    });

    const spotSeries = chart.addSeries(LineSeries, {
      color: "#00ff7e",
      lineWidth: 2,
      title: "Spot"
    });

    const callSeries = chart.addSeries(LineSeries, {
      color: "#ff5252",
      lineWidth: 1,
      title: "Call OI"
    });

    const putSeries = chart.addSeries(LineSeries, {
      color: "#10d876",
      lineWidth: 1,
      title: "Put OI"
    });

    chartRef.current = chart;
    spotSeriesRef.current = spotSeries;
    callOiSeriesRef.current = callSeries;
    putOiSeriesRef.current = putSeries;

    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!spotSeriesRef.current || !callOiSeriesRef.current || !putOiSeriesRef.current) {
      return;
    }

    spotSeriesRef.current.setData(spotData);
    callOiSeriesRef.current.setData(callData);
    putOiSeriesRef.current.setData(putData);
  }, [spotData, callData, putData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spot & OI Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="h-[280px] w-full" />
      </CardContent>
    </Card>
  );
}