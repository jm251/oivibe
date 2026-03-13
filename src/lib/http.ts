import { NextResponse } from "next/server";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  [key: string]: unknown;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, payload: ApiErrorPayload) {
  return NextResponse.json(payload, { status });
}

export async function parseJson<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) {
    throw new Error("Request body cannot be empty");
  }
  return JSON.parse(text) as T;
}

export function getSearchParam(req: Request, key: string, fallback?: string) {
  const value = new URL(req.url).searchParams.get(key);
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}
