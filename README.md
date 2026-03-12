# OI VIBE

Production-ready Next.js 15 dashboard for live NSE F&O intelligence.

## Stack

- Next.js 15 App Router + TypeScript + Tailwind CSS
- shadcn/ui style primitives + Radix + Lucide
- Zustand state + TanStack Query
- lightweight-charts for spot/OI timeline
- Three.js + @react-three/fiber for 3D volatility surface
- Upstox (REST + WS relay) with deterministic mock fallback

## Features

- OI wall heatmap driven by real-time delta OI
- CE vs PE flow and PCR metrics
- Strategy Lab with templates/custom legs, payoff and Greeks
- Streaming SSE pipeline (`snapshot`, `tick`, `heartbeat`, `error`)
- Secure Upstox OAuth/access-token session storage via encrypted HttpOnly cookie
- Live mode stays live on transient Upstox failures and falls back to cached snapshots instead of silently switching to mock
- Expired Upstox tokens trigger automatic OAuth re-auth instead of requiring manual env edits
- Browser-side Dexie replay cache for local snapshot recording, session playback, JSON export/import, and DuckDB-Wasm session analytics

## Environment

Copy `.env.example` to `.env` and set values:

```bash
SESSION_SECRET=replace-with-32-char-secret
UPSTOX_API_KEY=
UPSTOX_API_SECRET=
UPSTOX_REDIRECT_URI=https://your-domain/api/upstox/callback
UPSTOX_ACCESS_TOKEN=
UPSTOX_NOTIFIER_SECRET=replace-with-long-random-secret
UPSTOX_RUNTIME_EDGE_CONFIG_ID=
UPSTOX_RUNTIME_VERCEL_API_TOKEN=
UPSTOX_RUNTIME_VERCEL_TEAM_ID=
```

If `UPSTOX_ACCESS_TOKEN` is invalid/missing, OI VIBE runs in realistic live simulator mode.
If you want browser login instead of pasting a token, `UPSTOX_REDIRECT_URI` must exactly match the callback URL registered in your Upstox app.
If you want daily runtime renewal without editing env vars, configure the Upstox notifier webhook to:

```txt
https://your-domain/api/upstox/notifier/<UPSTOX_NOTIFIER_SECRET>
```

Then use the runtime token request flow, which stores the latest approved token in Vercel Edge Config instead of a deployment env var.

## Upstox Notes

- OI VIBE v1 uses only the free Upstox market-data APIs for authentication, option chain snapshots, and market-data WebSocket streaming.
- No paid market-data or order APIs are required for the dashboard runtime.
- Upstox access tokens are daily tokens. OI VIBE stores session tokens with the next `3:30 AM IST` expiry window, keeps the last successful live snapshot, and auto-starts OAuth re-auth when Upstox returns an expired-token response.
- OI VIBE also supports a Vercel runtime-token flow for Upstox: request approval, receive the token on a notifier webhook, and store it in Edge Config so production does not need daily env edits or redeploys.
- Local replay recording uses `Dexie` + IndexedDB in the browser. No extra backend, paid API, or storage key is required.
- Replay cache keeps bounded daily sessions locally, supports JSON session export/import across browsers, and runs SQL analytics directly in the browser with `DuckDB-Wasm`.

Official Upstox docs:

- Authentication: `https://upstox.com/developer/api-documentation/authentication/`
- Token exchange: `https://upstox.com/developer/api-documentation/get-token/`
- Put/Call option chain: `https://upstox.com/developer/api-documentation/get-pc-option-chain/`
- Market Data Feed V3: `https://upstox.com/developer/api-documentation/get-market-data-feed/`

## Run

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## API contracts

- `POST /api/session/connect` body `{ accessToken }`
- `POST /api/session/disconnect`
- `GET /api/reference/underlyings`
- `GET /api/expiries?symbol=NIFTY`
- `GET /api/option-chain?symbol=NIFTY&expiry=YYYY-MM-DD`
- `GET /api/stream?symbol=NIFTY&expiry=YYYY-MM-DD` (SSE)

## Tests

```bash
npm run test
npm run test:e2e
```

## Docker

```bash
docker build -t oi-vibe .
docker run --rm -p 3000:3000 --env-file .env oi-vibe
```
# oivibe
