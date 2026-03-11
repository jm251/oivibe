let replayDuckDbPromise: Promise<any> | null = null;

async function instantiateReplayDuckDb() {
  const duckdb = await import("@duckdb/duckdb-wasm/dist/duckdb-browser.mjs");
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: "text/javascript"
    })
  );

  try {
    const worker = new Worker(workerUrl);
    const logger = new duckdb.VoidLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return db;
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
}

export async function getReplayDuckDb() {
  if (typeof window === "undefined") {
    throw new Error("Replay analytics only run in the browser.");
  }

  if (!replayDuckDbPromise) {
    replayDuckDbPromise = instantiateReplayDuckDb().catch((error) => {
      replayDuckDbPromise = null;
      throw error;
    });
  }

  return replayDuckDbPromise;
}
