/**
 * SquareThread 拡張 メッセージ管理
 */

import {
  getErrorMessage,
  getTimestamp,
  requirePositiveInteger,
  requireString,
  SquareApiError,
  SquareValidationError,
} from "../shared/mod.ts";
import type {
  FetchSquareChatEventsResponse,
  FetchThreadEventsParams,
  SendSquareThreadMessageResponse,
  SendThreadMessageParams,
  SquareEvent,
  SquareMessage,
  SquareServiceLike,
  SquareThreadClientLike,
  SquareThreadMessageLike,
  ThreadExtensionOptions,
} from "./types.ts";

const FEATURE = "thread" as const;
const DEFAULT_LIMIT = 100;

export class ThreadMessageManager {
  private readonly service: SquareServiceLike;
  private readonly getReqseqFn?: (bucket?: string) => Promise<number> | number;
  private readonly options: ThreadExtensionOptions;
  private readonly messagesByThread = new Map<string, SquareMessage[]>();
  private readonly eventsByThread = new Map<string, SquareEvent[]>();
  private fallbackSeq = 1;

  constructor(
    client: SquareThreadClientLike,
    options: ThreadExtensionOptions = {},
  ) {
    this.service = client.base.square;
    this.getReqseqFn = client.base.getReqseq
      ? client.base.getReqseq.bind(client.base)
      : undefined;
    this.options = options;
  }

  getCachedMessages(threadMid: string): readonly SquareMessage[] {
    return [...(this.messagesByThread.get(threadMid) ?? [])];
  }

  getCachedEvents(threadMid: string): readonly SquareEvent[] {
    return [...(this.eventsByThread.get(threadMid) ?? [])];
  }

  recordMessage(threadMid: string, message: SquareMessage): void {
    const key = requireString(threadMid, "threadMid", FEATURE);
    const list = this.messagesByThread.get(key) ?? [];
    list.push(message);
    this.messagesByThread.set(key, list);
  }

  recordEvent(threadMid: string, event: SquareEvent): void {
    const key = requireString(threadMid, "threadMid", FEATURE);
    const list = this.eventsByThread.get(key) ?? [];
    list.push(event);
    this.eventsByThread.set(key, list);
  }

  private async resolveReqSeq(explicit?: number): Promise<number> {
    if (explicit !== undefined) {
      return requirePositiveInteger(explicit, "reqSeq", FEATURE);
    }
    if (this.getReqseqFn) {
      const seq = await this.getReqseqFn("sq");
      if (typeof seq === "number" && Number.isInteger(seq) && seq > 0) {
        return seq;
      }
    }
    return this.fallbackSeq++;
  }

  async fetchEvents(
    params: FetchThreadEventsParams,
  ): Promise<FetchSquareChatEventsResponse> {
    const squareChatMid = requireString(
      params.squareChatMid,
      "squareChatMid",
      FEATURE,
    );
    const limit = params.limit ??
      this.options.defaultFetchLimit ??
      DEFAULT_LIMIT;
    requirePositiveInteger(limit, "limit", FEATURE);

    let res: FetchSquareChatEventsResponse;
    try {
      res = await this.service.fetchSquareChatEvents({
        squareChatMid,
        threadMid: params.threadMid,
        syncToken: params.syncToken,
        limit,
        direction: params.direction,
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `fetchSquareChatEvents failed: ${getErrorMessage(error)}`,
        error,
      );
    }

    if (params.threadMid && Array.isArray(res.events)) {
      const list = this.eventsByThread.get(params.threadMid) ?? [];
      list.push(...res.events);
      this.eventsByThread.set(params.threadMid, list);
    }
    return res;
  }

  async sendMessage(
    params: SendThreadMessageParams,
  ): Promise<SendSquareThreadMessageResponse> {
    const chatMid = requireString(params.chatMid, "chatMid", FEATURE);
    const threadMid = requireString(params.threadMid, "threadMid", FEATURE);
    if (!params.threadMessage || typeof params.threadMessage !== "object") {
      throw new SquareValidationError(
        FEATURE,
        "threadMessage must be a valid SquareMessage object.",
        { threadMessage: params.threadMessage },
      );
    }

    const reqSeq = await this.resolveReqSeq(params.reqSeq);

    let res: SendSquareThreadMessageResponse;
    try {
      res = await this.service.sendSquareThreadMessage({
        request: {
          reqSeq,
          chatMid,
          threadMid,
          threadMessage: params.threadMessage,
        },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `sendSquareThreadMessage failed: ${getErrorMessage(error)}`,
        error,
      );
    }

    if (res.createdThreadMessage) {
      this.recordMessage(threadMid, res.createdThreadMessage);
    }
    return res;
  }

  async reactToThreadMessage(
    message: SquareThreadMessageLike,
    reactionType: unknown,
  ): Promise<unknown> {
    if (!message || typeof message.react !== "function") {
      throw new SquareValidationError(
        FEATURE,
        "message must be a SquareThreadMessage instance with react().",
      );
    }
    try {
      return await message.react(reactionType);
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `react failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async unsendThreadMessage(message: SquareThreadMessageLike): Promise<unknown> {
    if (!message || typeof message.unsend !== "function") {
      throw new SquareValidationError(
        FEATURE,
        "message must be a SquareThreadMessage instance with unsend().",
      );
    }
    try {
      return await message.unsend();
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `unsend failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async deleteThreadMessage(message: SquareThreadMessageLike): Promise<unknown> {
    if (!message || typeof message.delete !== "function") {
      throw new SquareValidationError(
        FEATURE,
        "message must be a SquareThreadMessage instance with delete().",
      );
    }
    try {
      return await message.delete();
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `delete failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  clearCache(): void {
    this.messagesByThread.clear();
    this.eventsByThread.clear();
    void getTimestamp();
  }
}
