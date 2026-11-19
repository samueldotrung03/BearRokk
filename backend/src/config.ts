const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  xaiApiKey: env.XAI_API_KEY?.trim() || null,
  xaiBaseUrl: env.XAI_BASE_URL ?? 'https://api.x.ai/v1',
  xaiModel: env.XAI_MODEL ?? 'grok-4.7',
  /** Also give workers the X search tool. Off unless the account supports it. */
  xSearch: env.XAI_X_SEARCH === '1',
  /** Path to a Firebase service account JSON file. Without it, results stay in a local file. */
  firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT?.trim() || null,
  maxResultsPerType: Number(env.MAX_RESULTS_PER_TYPE ?? 3),
  grokTimeoutMs: Number(env.GROK_TIMEOUT_MS ?? 120_000),
  /** Pause between prepared-mode stages so the dashboard can show progress. */
  preparedStepMs: Number(env.PREPARED_STEP_MS ?? 1200),
  localDataFile: env.LOCAL_DATA_FILE ?? new URL('../.data/store.json', import.meta.url).pathname,
};

export const liveAvailable = () => config.xaiApiKey !== null;
