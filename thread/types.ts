/**
 * SquareThread 拡張 型定義
 * 対象: @evex/linejs@3.4.2 / jsr:@evex/linejs-types
 */

import type {
  FetchDirection,
  FetchSquareChatEventsResponse,
  GetSquareThreadMidRequest,
  GetSquareThreadMidResponse,
  GetSquareThreadRequest,
  GetSquareThreadResponse,
  JoinSquareThreadRequest,
  JoinSquareThreadResponse,
  LeaveSquareThreadRequest,
  LeaveSquareThreadResponse,
  MarkThreadsAsReadRequest,
  MarkThreadsAsReadResponse,
  SendSquareThreadMessageRequest,
  SendSquareThreadMessageResponse,
  SquareEvent,
  SquareMessage,
  SquareThread,
  SquareThreadMember,
  SquareThreadMembershipState,
  SquareThreadState,
} from "jsr:@evex/linejs-types";
import type { SquareExtensionOptions } from "../shared/mod.ts";

export type Int64 = number | bigint;

export type {
  FetchDirection,
  FetchSquareChatEventsResponse,
  GetSquareThreadMidRequest,
  GetSquareThreadMidResponse,
  GetSquareThreadRequest,
  GetSquareThreadResponse,
  JoinSquareThreadRequest,
  JoinSquareThreadResponse,
  LeaveSquareThreadRequest,
  LeaveSquareThreadResponse,
  MarkThreadsAsReadRequest,
  MarkThreadsAsReadResponse,
  SendSquareThreadMessageRequest,
  SendSquareThreadMessageResponse,
  SquareEvent,
  SquareMessage,
  SquareThread,
  SquareThreadMember,
  SquareThreadMembershipState,
  SquareThreadState,
};

export interface SquareThreadMessageLike {
  readonly raw: {
    threadInfo?: {
      chatThreadMid?: string;
    };
  };
  react(reactionType: unknown): Promise<unknown>;
  unsend(): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface SquareServiceLike {
  fetchSquareChatEvents(options: {
    squareChatMid: string;
    threadMid?: string;
    syncToken?: string;
    limit?: number;
    direction?: FetchDirection;
  }): Promise<FetchSquareChatEventsResponse>;
  getSquareThread(
    param: { request: GetSquareThreadRequest },
  ): Promise<GetSquareThreadResponse>;
  getSquareThreadMid(
    param: { request: GetSquareThreadMidRequest },
  ): Promise<GetSquareThreadMidResponse>;
  joinSquareThread(
    param: { request: JoinSquareThreadRequest },
  ): Promise<JoinSquareThreadResponse>;
  leaveSquareThread(
    param: { request: LeaveSquareThreadRequest },
  ): Promise<LeaveSquareThreadResponse>;
  markThreadsAsRead(
    param: { request: MarkThreadsAsReadRequest },
  ): Promise<MarkThreadsAsReadResponse>;
  sendSquareThreadMessage(
    param: { request: SendSquareThreadMessageRequest },
  ): Promise<SendSquareThreadMessageResponse>;
  unsendMessage?(options: Record<string, unknown>): Promise<unknown>;
  destroyMessage?(options: Record<string, unknown>): Promise<unknown>;
}

export interface SquareThreadClientLike {
  readonly base: {
    readonly square: SquareServiceLike;
    getReqseq?(bucket?: string): Promise<number> | number;
  };
  on?(event: "square:event", listener: (event: SquareEvent) => void): unknown;
  off?(event: "square:event", listener: (event: SquareEvent) => void): unknown;
}

export interface ThreadExtensionOptions extends SquareExtensionOptions {
  defaultFetchLimit?: number;
  pollIntervalMs?: number;
}

export interface ThreadStateRecord {
  threadMid: string;
  chatMid?: string;
  squareMid?: string;
  thread?: SquareThread;
  myMember?: SquareThreadMember;
  rootMessage?: SquareMessage;
  members: Map<string, SquareThreadMember>;
  updatedAt: number;
}

export interface GetThreadParams {
  threadMid: string;
  includeRootMessage?: boolean;
}

export interface GetThreadMidParams {
  chatMid: string;
  messageId: string;
}

export interface JoinOrLeaveThreadParams {
  chatMid: string;
  threadMid: string;
}

export interface FetchThreadEventsParams {
  squareChatMid: string;
  threadMid?: string;
  syncToken?: string;
  limit?: number;
  direction?: FetchDirection;
}

export interface SendThreadMessageParams {
  chatMid: string;
  threadMid: string;
  threadMessage: SquareMessage;
  reqSeq?: number;
}

export interface ThreadMonitorOptions {
  squareChatMid?: string;
  threadMid?: string;
  syncToken?: string;
  limit?: number;
  direction?: FetchDirection;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onError?: (error: unknown) => void;
}
