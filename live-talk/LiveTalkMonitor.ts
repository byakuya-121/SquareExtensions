/**
 * LiveTalk イベント監視モジュール
 */

import {
  getErrorMessage,
  log,
  requirePositiveInteger,
  requireString,
  SquareApiError,
  SquareValidationError,
} from "../shared/mod.ts";
import type { SquareExtensionOptions } from "../shared/mod.ts";
import type { LiveTalkEventBus } from "./LiveTalkEvents.ts";
import type {
  FetchLiveTalkEventsParams,
  FetchLiveTalkEventsResponse,
  LiveTalkEvent,
  LiveTalkExtensionOptions,
  LiveTalkMonitorStartOptions,
  LiveTalkServiceLike,
} from "./types.ts";

const FEATURE = "live-talk" as const;
const DEFAULT_LIMIT = 50;
const DEFAULT_POLL_INTERVAL_MS = 3000;

export class LiveTalkMonitor {
  private readonly service: LiveTalkServiceLike;
  private readonly eventBus: LiveTalkEventBus;
  private readonly options: LiveTalkExtensionOptions;

  private readonly syncTokens = new Map<string, string>();
  private running = false;
  private stopRequested = false;
  private abortController: AbortController | null = null;
  private loopPromise: Promise<void> | null = null;

  constructor(
    service: LiveTalkServiceLike,
    eventBus: LiveTalkEventBus,
    options: LiveTalkExtensionOptions = {},
  ) {
    this.service = service;
    this.eventBus = eventBus;
    this.options = options;
  }

  get isMonitoring(): boolean {
    return this.running;
  }

  private sessionKey(squareChatMid: string, sessionId: string): string {
    return `${squareChatMid}:${sessionId}`;
  }

  getSyncToken(squareChatMid: string, sessionId: string): string {
    return this.syncTokens.get(this.sessionKey(squareChatMid, sessionId)) ?? "";
  }

  setSyncToken(squareChatMid: string, sessionId: string, syncToken: string): void {
    this.syncTokens.set(this.sessionKey(squareChatMid, sessionId), syncToken);
  }

  async pollOnce(
    params: FetchLiveTalkEventsParams,
  ): Promise<{ response: FetchLiveTalkEventsResponse; events: LiveTalkEvent[] }> {
    const squareChatMid = requireString(params.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(params.sessionId, "sessionId", FEATURE);
    const limit = params.limit ?? this.options.defaultEventLimit ?? DEFAULT_LIMIT;
    requirePositiveInteger(limit, "limit", FEATURE);

    const drainAll = params.drainAll ?? this.options.drainHasMore ?? true;
    const key = this.sessionKey(squareChatMid, sessionId);
    let currentToken = params.syncToken ?? this.syncTokens.get(key) ?? "";

    const collectedEvents: LiveTalkEvent[] = [];
    let latestResponse: FetchLiveTalkEventsResponse | null = null;

    while (true) {
      let res: FetchLiveTalkEventsResponse;
      try {
        res = await this.service.fetchLiveTalkEvents({
          request: {
            squareChatMid,
            sessionId,
            syncToken: currentToken,
            limit,
          },
        });
      } catch (error) {
        throw new SquareApiError(
          FEATURE,
          `Failed to fetch LiveTalk events: ${getErrorMessage(error)}`,
          error,
        );
      }

      latestResponse = res;
      if (typeof res.syncToken === "string") {
        currentToken = res.syncToken;
        this.syncTokens.set(key, currentToken);
      }

      const batch = Array.isArray(res.events) ? res.events : [];
      for (const ev of batch) {
        collectedEvents.push(ev);
        await this.eventBus.emitRaw(ev);
      }

      if (!drainAll || !res.hasMore) {
        break;
      }
    }

    return {
      response: latestResponse as FetchLiveTalkEventsResponse,
      events: collectedEvents,
    };
  }

  async start(monitorOptions: LiveTalkMonitorStartOptions): Promise<void> {
    const squareChatMid = requireString(monitorOptions.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(monitorOptions.sessionId, "sessionId", FEATURE);
    const intervalMs = monitorOptions.intervalMs ?? this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    requirePositiveInteger(intervalMs, "intervalMs", FEATURE);
    const limit = monitorOptions.limit ?? this.options.defaultEventLimit ?? DEFAULT_LIMIT;
    requirePositiveInteger(limit, "limit", FEATURE);

    if (monitorOptions.syncToken !== undefined) {
      if (typeof monitorOptions.syncToken !== "string") {
        throw new SquareValidationError(FEATURE, "syncToken must be a string.", {
          syncToken: monitorOptions.syncToken,
        });
      }
      this.setSyncToken(squareChatMid, sessionId, monitorOptions.syncToken);
    }

    await this.stop();

    this.stopRequested = false;
    this.running = true;
    this.abortController = new AbortController();

    const externalSignal = monitorOptions.signal;
    const internalSignal = this.abortController.signal;

    const onExternalAbort = () => {
      void this.stop();
    };
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    this.loopPromise = (async () => {
      try {
        while (!this.stopRequested && !internalSignal.aborted) {
          try {
            await this.pollOnce({
              squareChatMid,
              sessionId,
              limit,
              drainAll: monitorOptions.drainAll,
            });
          } catch (error) {
            log(
              this.options as SquareExtensionOptions,
              "error",
              `LiveTalk monitor poll error: ${getErrorMessage(error)}`,
              error,
            );
            monitorOptions.onError?.(error);
          }

          if (this.stopRequested || internalSignal.aborted) {
            break;
          }

          await this.sleep(intervalMs, internalSignal);
        }
      } finally {
        externalSignal?.removeEventListener("abort", onExternalAbort);
        this.running = false;
        this.abortController = null;
      }
    })();
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.abortController?.abort();
    if (this.loopPromise) {
      const current = this.loopPromise;
      this.loopPromise = null;
      await current;
    }
    this.running = false;
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted || this.stopRequested) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

