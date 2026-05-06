type SiarRateLimitState = {
  queue: Promise<unknown>;
  nextAllowedAt: number;
  dailyBlockedUntil: number;
};

const GLOBAL_KEY = "__agronode_siar_rate_limit__";

const MIN_INTERVAL_MS = Number(process.env.SIAR_MIN_INTERVAL_MS ?? 2500);

function getState(): SiarRateLimitState {
  const globalObj = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: SiarRateLimitState;
  };

  if (!globalObj[GLOBAL_KEY]) {
    globalObj[GLOBAL_KEY] = {
      queue: Promise.resolve(),
      nextAllowedAt: 0,
      dailyBlockedUntil: 0,
    };
  }

  return globalObj[GLOBAL_KEY];
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class SiarQuotaError extends Error {
  readonly scope: "minute" | "day";

  constructor(scope: "minute" | "day", message: string) {
    super(message);
    this.name = "SiarQuotaError";
    this.scope = scope;
  }
}

export function isSiarDailyBlocked(): boolean {
  return Date.now() < getState().dailyBlockedUntil;
}

export function blockSiarForOneDay(): void {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  getState().dailyBlockedUntil = nextMidnight.getTime();
}

export async function queueSiarRequest<T>(request: () => Promise<T>): Promise<T> {
  const state = getState();

  const run = async () => {
    const waitMs = Math.max(0, state.nextAllowedAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    try {
      return await request();
    } finally {
      state.nextAllowedAt = Date.now() + MIN_INTERVAL_MS;
    }
  };

  const task = state.queue.then(run, run);
  state.queue = task.then(() => undefined, () => undefined);
  return task;
}
