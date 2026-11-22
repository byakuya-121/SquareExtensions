/**
 * SquareThread 拡張 マネージャー
 */

import { SquareExtensionBase } from "../shared/mod.ts";
import type { SquareExtensionContext } from "../shared/mod.ts";
import { ThreadManager } from "./ThreadManager.ts";
import { ThreadMessageManager } from "./ThreadMessageManager.ts";
import {
  extractThreadMidFromSquareEvent,
  ThreadMonitor,
} from "./ThreadMonitor.ts";
import type { ThreadEventListener } from "./ThreadMonitor.ts";
import type {
  FetchThreadEventsParams,
  GetThreadMidParams,
  GetThreadParams,
  JoinOrLeaveThreadParams,
  SendThreadMessageParams,
  SquareThreadClientLike,
  SquareThreadMessageLike,
  ThreadExtensionOptions,
  ThreadMonitorOptions,
} from "./types.ts";

export class SquareThreadExtension<TClient extends SquareThreadClientLike>
  extends SquareExtensionBase<TClient> {
  readonly name = "thread" as const;
  readonly version = "0.1.0";

  private readonly threadOptions: ThreadExtensionOptions;
  readonly threads: ThreadManager;
  readonly messages: ThreadMessageManager;
  readonly monitor: ThreadMonitor;

  constructor(
    context: SquareExtensionContext<TClient>,
    options: ThreadExtensionOptions = {},
  ) {
    super({
      client: context.client,
      options: { ...context.options, ...options },
    });
    this.threadOptions = { ...context.options, ...options };
    this.threads = new ThreadManager(this.client.base.square);
    this.messages = new ThreadMessageManager(this.client, this.threadOptions);
    this.monitor = new ThreadMonitor(this.client, this.threadOptions);
  }

  protected async onInitialize(): Promise<void> {
    // 必要に応じた初期化フック
  }

  protected async onDispose(): Promise<void> {
    await this.monitor.stop();
    this.monitor.removeAllListeners();
    this.threads.clear();
    this.messages.clearCache();
  }

  getThread(params: GetThreadParams) {
    this.assertInitialized();
    return this.threads.getThread(params);
  }

  getThreadMid(params: GetThreadMidParams) {
    this.assertInitialized();
    return this.threads.getThreadMid(params);
  }

  joinThread(params: JoinOrLeaveThreadParams) {
    this.assertInitialized();
    return this.threads.joinThread(params);
  }

  leaveThread(params: JoinOrLeaveThreadParams) {
    this.assertInitialized();
    return this.threads.leaveThread(params);
  }

  markThreadsAsRead(chatMid: string) {
    this.assertInitialized();
    return this.threads.markThreadsAsRead(chatMid);
  }

  fetchEvents(params: FetchThreadEventsParams) {
    this.assertInitialized();
    return this.messages.fetchEvents(params);
  }

  sendMessage(params: SendThreadMessageParams) {
    this.assertInitialized();
    return this.messages.sendMessage(params);
  }

  reactToMessage(message: SquareThreadMessageLike, reactionType: unknown) {
    this.assertInitialized();
    return this.messages.reactToThreadMessage(message, reactionType);
  }

  unsendMessage(message: SquareThreadMessageLike) {
    this.assertInitialized();
    return this.messages.unsendThreadMessage(message);
  }

  deleteMessage(message: SquareThreadMessageLike) {
    this.assertInitialized();
    return this.messages.deleteThreadMessage(message);
  }

  startMonitoring(options: ThreadMonitorOptions = {}) {
    this.assertInitialized();
    return this.monitor.start(options);
  }

  stopMonitoring() {
    this.assertInitialized();
    return this.monitor.stop();
  }

  onThreadEvent(listener: ThreadEventListener): () => void {
    return this.monitor.onThreadEvent(listener);
  }

  static extractThreadMid = extractThreadMidFromSquareEvent;
}
