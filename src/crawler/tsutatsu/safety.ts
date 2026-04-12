import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type TsutatsuCrawlerState = {
  consecutiveFailureDays: number;
  lastFailureDate: string | null;
  lastSuccessfulCount: number | null;
  lastSuccessfulAt: string | null;
};

export class TsutatsuSafety {
  constructor(private readonly statePath: string) {}

  async loadState(): Promise<TsutatsuCrawlerState> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      return JSON.parse(raw) as TsutatsuCrawlerState;
    } catch {
      return {
        consecutiveFailureDays: 0,
        lastFailureDate: null,
        lastSuccessfulCount: null,
        lastSuccessfulAt: null,
      };
    }
  }

  async assertRunAllowed() {
    const state = await this.loadState();

    if (state.consecutiveFailureDays >= 3) {
      throw new Error("Crawler is paused after 3 consecutive failure days");
    }

    return state;
  }

  assertNoLargeCountDrop(previousCount: number | null, nextCount: number) {
    if (previousCount === null || previousCount === 0) {
      return;
    }

    if (nextCount < previousCount * 0.7) {
      throw new Error(
        `Crawler aborted because document count dropped by more than 30% (${previousCount} -> ${nextCount})`,
      );
    }
  }

  assertDeletionThreshold(deletedCount: number) {
    if (deletedCount > 100) {
      throw new Error(`Crawler aborted because deleted_count=${deletedCount} exceeds 100`);
    }
  }

  async recordSuccess({ count, now }: { count: number; now: string }) {
    await this.writeState({
      consecutiveFailureDays: 0,
      lastFailureDate: null,
      lastSuccessfulCount: count,
      lastSuccessfulAt: now,
    });
  }

  async recordFailure(now: string) {
    const state = await this.loadState();
    const currentDate = now.slice(0, 10);
    const previousDate = state.lastFailureDate;
    const consecutiveFailureDays =
      previousDate === currentDate ? state.consecutiveFailureDays : state.consecutiveFailureDays + 1;

    await this.writeState({
      ...state,
      consecutiveFailureDays,
      lastFailureDate: currentDate,
    });
  }

  private async writeState(state: TsutatsuCrawlerState) {
    await mkdir(dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}
