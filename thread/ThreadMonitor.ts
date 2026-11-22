/**
 * SquareThread 拡張 イベント監視モジュール
 * Client の "square:event" 購読および fetchSquareChatEvents ポーリング補助
 */

import {
  getErrorMessage,
  getTimestamp,
  log,
  requirePositiveInteger,
  requireString,
  SquareApiError,
} from "../shared/mod.ts";
import type {
  SquareEvent,
  SquareThreadClientLike,
  ThreadExtensionOptions,
  ThreadMonitorOptions,
} from "./types.ts";

const FEATURE = "thread" as const;

export type ThreadEventListener = (
  event: SquareEvent,
  meta: { threadMid?: string; timestamp: number },
) => void | Promise<void>;

export function extractThreadMidFromSquareEvent(
  event: SquareEvent,
): string | undefined {
  const payload = (event as unknown as { payload?: Record<string, unknown> }).payload;
  if (!payload || typeof payload !== "object") return undefined;

  const notifThreadMsg = payload["notificationThreadMessage"] as
    | { squareMessage?: { threadInfo?: { chatThreadMid?: string } } }
    | undefined;
  const fromNotifThread = notifThreadMsg?.squareMessage?.threadInfo
    ?.chatThreadMid;
  if (typeof fromNotifThread === "string" && fromNotifThread.length > 0) {
    return fromNotifThread;
  }

  const notifMsg = payload["notificationMessage"] as
    | { squareMessage?: { threadInfo?: { chatThreadMid?: string } } }
    | undefined;
  const fromNotifMsg = notifMsg?.squareMessage?.threadInfo?.chatThreadMid;
  if (typeof fromNotifMsg === "string" && fromNotifMsg.length > 0) {
    return fromNotifMsg;
  }

  return undefined;
}

export class ThreadMonitor {
  private readonly client: SquareThreadClientLike;
  private readonly options: ThreadExtensionOptions;
  private readonly listeners = new Set<ThreadEventListener>();

  private clientHandler?: (event: SquareEvent) => void;
  private filterThreadMid?: string;
  private filterSquareChatMid?: string;
  private monitoring = false;
  private stopRequested = false;
  private abortController: AbortController | null = null;
  private pollPromise: Promise<void> | null = null;
  private syncToken = "";

  constructor(
    client: SquareThreadClientLike,
    options: ThreadExtensionOptions = {},
  ) {
    this.client = client;
    this.options = options;
  }

  get isMonitoring(): boolean {
    return this.monitoring;
  }

  getSyncToken(): string {
    return this.syncToken;
  }

  onThreadEvent(listener: ThreadEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  private async dispatchEvent(event: SquareEvent): Promise<void> {
    const threadMid = extractThreadMidFromSquareEvent(event);
    if (this.filterThreadMid && threadMid !== this.filterThreadMid) {
      return;
    }
    const meta = { threadMid, timestamp: getTimestamp() };
    for (const listener of Array.from(this.listeners)) {
      await listener(event, meta);
    }
  }

  async start(monitorOptions: ThreadMonitorOptions = {}): Promise<void> {
    await this.stop();

    this.filterSquareChatMid = monitorOptions.squareChatMid;
    this.filterThreadMid = monitorOptions.threadMid;
    if (monitorOptions.syncToken !== undefined) {
      this.syncToken = monitorOptions.syncToken;
    }

    this.stopRequested = false;
    this.monitoring = true;
    this.abortController = new AbortController();

    const externalSignal = monitorOptions.signal;
    const internalSignal = this.abortController.signal;

    const onExternalAbort = () => {
      void this.stop();
    };
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    if (typeof this.client.on === "function") {
      this.clientHandler = (event: SquareEvent) => {
        void this.dispatchEvent(event);
      };
      this.client.on("square:event", this.clientHandler);
    }

    if (monitorOptions.pollIntervalMs !== undefined) {
      const intervalMs = requirePositiveInteger(
        monitorOptions.pollIntervalMs,
        "pollIntervalMs",
        FEATURE,
      );
      const squareChatMid = requireString(
        this.filterSquareChatMid,
        "squareChatMid",
        FEATURE,
      );
      const limit = monitorOptions.limit ??
        this.options.defaultFetchLimit ??
        100;
      requirePositiveInteger(limit, "limit", FEATURE);

      this.pollPromise = (async () => {
        try {
          while (!this.stopRequested && !internalSignal.aborted) {
            try {
              const res = await this.client.base.square.fetchSquareChatEvents({
                squareChatMid,
                threadMid: this.filterThreadMid,
                syncToken: this.syncToken || undefined,
                limit,
                direction: monitorOptions.direction,
              });
              if (typeof res.syncToken === "string") {
                this.syncToken = res.syncToken;
              }
              for (const ev of res.events ?? []) {
                await this.dispatchEvent(ev);
              }
            } catch (error) {
              const apiErr = error instanceof SquareApiError
                ? error
                : new SquareApiError(
                  FEATURE,
                  `Thread monitor poll failed: ${getErrorMessage(error)}`,
                  error,
                );
              log(
                this.options,
                "error",
                apiErr.message,
                apiErr,
              );
              monitorOptions.onError?.(apiErr);
            }

            if (this.stopRequested || internalSignal.aborted) {
              break;
            }
            await this.sleep(intervalMs, internalSignal);
          }
        } finally {
          externalSignal?.removeEventListener("abort", onExternalAbort);
        }
      })();
    } else {
      externalSignal?.addEventListener("abort", () => {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }, { once: true });
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.abortController?.abort();

    if (this.clientHandler && typeof this.client.off === "function") {
      this.client.off("square:event", this.clientHandler);
    }
    this.clientHandler = undefined;

    if (this.pollPromise) {
      const current = this.pollPromise;
      this.pollPromise = null;
      await current;
    }

    this.monitoring = false;
    this.abortController = null;
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

