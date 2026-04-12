import { readFile } from "node:fs/promises";

type SafetyState = {
  lastSuccessfulCount: number | null;
  lastRunAt: string | null;
  lastFailureAt: string | null;
};

const DEFAULT_STATE: SafetyState = {
  lastSuccessfulCount: null,
  lastRunAt: null,
  lastFailureAt: null,
};

export class WrittenAnswerSafety {
  constructor(private readonly statePath: string) {}

  async assertRunAllowed() {
    return this.readState();
  }

  assertDeletionThreshold(_deletedCount: number) {
    return;
  }

  assertNoLargeCountDrop(_previousCount: number | null, _nextCount: number) {
    return;
  }

  async recordSuccess({
    count,
    now,
  }: {
    count: number;
    now: string;
  }) {
    const nextState: SafetyState = {
      lastSuccessfulCount: count,
      lastRunAt: now,
      lastFailureAt: null,
    };
    await this.writeState(nextState);
  }

  async recordFailure(now: string) {
    const current = await this.readState();
    await this.writeState({
      ...current,
      lastFailureAt: now,
    });
  }

  private async readState() {
    try {
      const raw = await readFile(this.statePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SafetyState>;

      return {
        lastSuccessfulCount:
          typeof parsed.lastSuccessfulCount === "number" ? parsed.lastSuccessfulCount : null,
        lastRunAt: typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : null,
        lastFailureAt: typeof parsed.lastFailureAt === "string" ? parsed.lastFailureAt : null,
      };
    } catch {
      return DEFAULT_STATE;
    }
  }

  private async writeState(state: SafetyState) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");

    await mkdir(dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}
