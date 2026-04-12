export class FixedRateLimiter {
  private nextAllowedAt = 0;

  constructor(private readonly options: { intervalMs: number }) {}

  async wait() {
    const now = Date.now();
    const delay = Math.max(0, this.nextAllowedAt - now);

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.nextAllowedAt = Math.max(this.nextAllowedAt, now) + this.options.intervalMs;
  }
}
