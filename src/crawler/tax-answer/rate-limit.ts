type FixedRateLimiterOptions = {
  intervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class FixedRateLimiter {
  private readonly intervalMs: number;

  private readonly now: () => number;

  private readonly sleep: (ms: number) => Promise<void>;

  private lastRunAt: number | null = null;

  constructor({
    intervalMs,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }: FixedRateLimiterOptions) {
    this.intervalMs = intervalMs;
    this.now = now;
    this.sleep = sleep;
  }

  async wait() {
    if (this.lastRunAt === null) {
      this.lastRunAt = this.now();
      return;
    }

    const elapsed = this.now() - this.lastRunAt;
    const remaining = this.intervalMs - elapsed;

    if (remaining > 0) {
      await this.sleep(remaining);
    }

    this.lastRunAt = this.now();
  }
}
