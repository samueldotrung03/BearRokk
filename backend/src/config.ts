const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  xaiApiKey: env.XAI_API_KEY?.trim() || null,
  xaiBaseUrl: env.XAI_BASE_URL ?? 'https://api.x.ai/v1',
  xaiModel: env.XAI_MODEL ?? 'grok-4.7',
  /**
   * One model per tier of the agent system.
   * normal: master agent, search managers, validation agents, presentation manager. low: the worker fleet.
   * high: not assigned to any level at the moment.
   */
  xaiModels: {
    high: env.XAI_MODEL_HIGH ?? env.XAI_MODEL ?? 'grok-4.7',
    normal: env.XAI_MODEL_NORMAL ?? 'grok-4.5',
    low: env.XAI_MODEL_LOW ?? 'grok-4.3',
  },
  /**
   * How the agents reach Grok. "api": the xAI API with XAI_API_KEY, billed per call.
   * "cli": the Grok Build CLI on this machine, signed in with a Grok subscription.
   */
  grokTransport: (env.GROK_TRANSPORT === 'cli' ? 'cli' : env.GROK_TRANSPORT === 'claude' ? 'claude' : 'api') as 'api' | 'cli' | 'claude',
  /**
   * TEMPORARY, for testing before Grok access: GROK_TRANSPORT=claude runs the agents on Claude
   * through the Claude Code CLI on this machine. See SWAP_TO_GROK.md.
   */
  claudeCli: {
    bin: env.CLAUDE_CLI_BIN ?? 'claude',
    models: { high: env.CLAUDE_MODEL_HIGH ?? 'opus', normal: env.CLAUDE_MODEL_NORMAL ?? 'sonnet', low: env.CLAUDE_MODEL_LOW ?? 'haiku' },
    timeoutMs: Number(env.CLAUDE_CLI_TIMEOUT_MS ?? 240_000),
  },
  /** With a CLI each call is a whole program, so a live run is kept small enough to finish in a few minutes. */
  liveCli: { maxJobs: Number(env.LIVE_MAX_JOBS ?? 12) },
  /** The feed should hold at least `target` cards; the agents search again, up to `maxFillRuns` times in a row, until it does. */
  feed: { target: Number(env.FEED_MIN ?? 12), maxFillRuns: Number(env.FEED_FILL_MAX_RUNS ?? 4) },
  grokCli: {
    bin: env.GROK_CLI_BIN ?? 'grok',
    /** Model names for the CLI, if it should not use its default. */
    models: { high: env.GROK_CLI_MODEL_HIGH || undefined, normal: env.GROK_CLI_MODEL_NORMAL || undefined, low: env.GROK_CLI_MODEL_LOW || undefined },
    /** Let the CLI use its tools without asking. Needed for web search if the CLI asks for approval. */
    alwaysApprove: env.GROK_CLI_ALWAYS_APPROVE === '1',
    timeoutMs: Number(env.GROK_CLI_TIMEOUT_MS ?? 240_000),
    /** CLI processes running at once. Each one is a full program, so far fewer than API calls. */
    concurrency: Number(env.GROK_CLI_CONCURRENCY ?? 3),
  },
  /** Also give workers the X search tool. Off unless the account supports it. */
  xSearch: env.XAI_X_SEARCH === '1',
  /**
   * "account": keep each student's memory in Firestore using that student's own sign-in, with no
   * service account. This is how a copy of the app on a student's laptop stores it.
   */
  studentStore: env.STUDENT_STORE === 'account' ? ('account' as const) : null,
  /** Path to a Firebase service account JSON file. Without it, results stay in a local file. */
  firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT?.trim() || null,
  /**
   * Firebase web settings for Google sign-in (Project settings > Your apps > Web app).
   * Sign-in is on when apiKey and projectId are both set.
   */
  firebaseWeb: {
    apiKey: env.FIREBASE_WEB_API_KEY?.trim() || null,
    projectId: env.FIREBASE_PROJECT_ID?.trim() || null,
    authDomain: env.FIREBASE_AUTH_DOMAIN?.trim() || null,
  },
  maxResultsPerType: Number(env.MAX_RESULTS_PER_TYPE ?? 3),
  grokTimeoutMs: Number(env.GROK_TIMEOUT_MS ?? 120_000),
  /** Pause between prepared-mode stages so the dashboard can show progress. */
  preparedStepMs: Number(env.PREPARED_STEP_MS ?? 1200),
  localDataFile: env.LOCAL_DATA_FILE ?? new URL('../.data/store.json', import.meta.url).pathname,
};

/** Live Grok is available with an API key, or when the subscription CLI is chosen. */
export const liveAvailable = () => config.grokTransport !== 'api' || config.xaiApiKey !== null;

/** Which model family the agents are on right now. */
export const provider = (): 'grok' | 'claude' | 'simulated' => (!liveAvailable() ? 'simulated' : config.grokTransport === 'claude' ? 'claude' : 'grok');
