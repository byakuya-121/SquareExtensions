/**
 * SquareThread 拡張 スレッド状態・メンバー・既読管理
 */

import {
  getErrorMessage,
  getTimestamp,
  requireString,
  SquareApiError,
} from "../shared/mod.ts";
import type {
  GetSquareThreadMidResponse,
  GetSquareThreadResponse,
  GetThreadMidParams,
  GetThreadParams,
  JoinOrLeaveThreadParams,
  JoinSquareThreadResponse,
  LeaveSquareThreadResponse,
  MarkThreadsAsReadResponse,
  SquareServiceLike,
  SquareThread,
  SquareThreadMember,
  ThreadStateRecord,
} from "./types.ts";

const FEATURE = "thread" as const;

export class ThreadManager {
  private readonly service: SquareServiceLike;
  private readonly threads = new Map<string, ThreadStateRecord>();

  constructor(service: SquareServiceLike) {
    this.service = service;
  }

  private ensureRecord(
    threadMid: string,
    chatMid?: string,
    squareMid?: string,
  ): ThreadStateRecord {
    let record = this.threads.get(threadMid);
    if (!record) {
      record = {
        threadMid,
        chatMid,
        squareMid,
        members: new Map<string, SquareThreadMember>(),
        updatedAt: getTimestamp(),
      };
      this.threads.set(threadMid, record);
    } else {
      if (chatMid !== undefined) record.chatMid = chatMid;
      if (squareMid !== undefined) record.squareMid = squareMid;
      record.updatedAt = getTimestamp();
    }
    return record;
  }

  getThreadRecord(threadMid: string): ThreadStateRecord | undefined {
    return this.threads.get(threadMid);
  }

  getAllThreadRecords(): ThreadStateRecord[] {
    return Array.from(this.threads.values());
  }

  upsertMember(member: SquareThreadMember): SquareThreadMember {
    const record = this.ensureRecord(
      member.threadMid,
      member.chatMid,
    );
    record.members.set(member.squareMemberMid, member);
    record.updatedAt = getTimestamp();
    return member;
  }

  getMembers(threadMid: string): SquareThreadMember[] {
    const record = this.threads.get(threadMid);
    return record ? Array.from(record.members.values()) : [];
  }

  async getThread(params: GetThreadParams): Promise<GetSquareThreadResponse> {
    const threadMid = requireString(params.threadMid, "threadMid", FEATURE);
    const includeRootMessage = params.includeRootMessage ?? true;

    let res: GetSquareThreadResponse;
    try {
      res = await this.service.getSquareThread({
        request: { threadMid, includeRootMessage },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `getSquareThread failed: ${getErrorMessage(error)}`,
        error,
      );
    }

    const record = this.ensureRecord(
      threadMid,
      res.squareThread?.chatMid,
      res.squareThread?.squareMid,
    );
    if (res.squareThread) {
      record.thread = res.squareThread;
    }
    if (res.myThreadMember) {
      record.myMember = res.myThreadMember;
      record.members.set(res.myThreadMember.squareMemberMid, res.myThreadMember);
    }
    if (res.rootMessage) {
      record.rootMessage = res.rootMessage;
    }
    record.updatedAt = getTimestamp();
    return res;
  }

  async getThreadMid(
    params: GetThreadMidParams,
  ): Promise<GetSquareThreadMidResponse> {
    const chatMid = requireString(params.chatMid, "chatMid", FEATURE);
    const messageId = requireString(params.messageId, "messageId", FEATURE);

    let res: GetSquareThreadMidResponse;
    try {
      res = await this.service.getSquareThreadMid({
        request: { chatMid, messageId },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `getSquareThreadMid failed: ${getErrorMessage(error)}`,
        error,
      );
    }

    if (res.threadMid) {
      this.ensureRecord(res.threadMid, chatMid);
    }
    return res;
  }

  async joinThread(
    params: JoinOrLeaveThreadParams,
  ): Promise<JoinSquareThreadResponse> {
    const chatMid = requireString(params.chatMid, "chatMid", FEATURE);
    const threadMid = requireString(params.threadMid, "threadMid", FEATURE);

    let res: JoinSquareThreadResponse;
    try {
      res = await this.service.joinSquareThread({
        request: { chatMid, threadMid },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `joinSquareThread failed: ${getErrorMessage(error)}`,
        error,
      );
    }

    const record = this.ensureRecord(threadMid, chatMid);
    if (res.threadMember) {
      record.myMember = res.threadMember;
      record.members.set(res.threadMember.squareMemberMid, res.threadMember);
    }
    record.updatedAt = getTimestamp();
    return res;
  }

  async leaveThread(
    params: JoinOrLeaveThreadParams,
  ): Promise<LeaveSquareThreadResponse> {
    const chatMid = requireString(params.chatMid, "chatMid", FEATURE);
    const threadMid = requireString(params.threadMid, "threadMid", FEATURE);

    let res: LeaveSquareThreadResponse;
    try {
      res = await this.service.leaveSquareThread({
        request: { chatMid, threadMid },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `leaveSquareThread failed: ${getErrorMessage(error)}`,
        error,
      );
    }

    const record = this.ensureRecord(threadMid, chatMid);
    if (res.threadMember) {
      record.myMember = res.threadMember;
      record.members.set(res.threadMember.squareMemberMid, res.threadMember);
    }
    record.updatedAt = getTimestamp();
    return res;
  }

  async markThreadsAsRead(chatMid: string): Promise<MarkThreadsAsReadResponse> {
    const validChatMid = requireString(chatMid, "chatMid", FEATURE);
    try {
      return await this.service.markThreadsAsRead({
        request: { chatMid: validChatMid },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `markThreadsAsRead failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  applyThreadUpdate(thread: SquareThread): ThreadStateRecord {
    const record = this.ensureRecord(
      thread.threadMid,
      thread.chatMid,
      thread.squareMid,
    );
    record.thread = thread;
    record.updatedAt = getTimestamp();
    return record;
  }

  clear(): void {
    this.threads.clear();
  }
}
