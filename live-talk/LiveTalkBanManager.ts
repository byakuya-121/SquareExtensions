/**
 * LiveTalk 出禁（BAN）リスト管理および自動キック補助
 */

import { requireString } from "../shared/mod.ts";
import type { LiveTalkClientLike, LiveTalkKickOutTarget } from "./types.ts";
import type { LiveTalkManager } from "./LiveTalkManager.ts";

const FEATURE = "live-talk";

export interface LiveTalkBanEntry {
  memberMid: string;
  reason?: string;
  bannedAt: number;
  /** 有効期限（UNIX タイムスタンプ ms）。未指定または null 的な扱いなら無期限 */
  expiresAt?: number;
  squareChatMid?: string;
}

export interface LiveTalkBanOptions {
  reason?: string;
  squareChatMid?: string;
  /** 登録時点からの有効期間（ミリ秒）。expiresAt が直接指定された場合はそちらを優先 */
  ttlMs?: number;
  /** 有効期限の UNIX タイムスタンプ（ミリ秒） */
  expiresAt?: number;
}

export interface LiveTalkBanKickParams extends LiveTalkBanOptions {
  squareChatMid: string;
  sessionId: string;
  memberMid: string;
  buildTarget?: (memberMid: string) => LiveTalkKickOutTarget;
}

export interface LiveTalkBanManagerOptions {
  buildTarget?: (memberMid: string) => LiveTalkKickOutTarget;
  /** BAN 状態が変化した際に自動保存する JSON ファイルパス */
  autoSaveFilePath?: string;
  /** 自動保存時のエラーハンドラ */
  onPersistError?: (error: unknown) => void;
}

export interface LiveTalkAutoEnforceOptions {
  squareChatMid: string;
  sessionId: string;
  buildTarget?: (memberMid: string) => LiveTalkKickOutTarget;
  extractMemberMids?: (payload: unknown) => string[];
  onEnforced?: (info: { memberMid: string; squareChatMid: string; sessionId: string }) => void;
  onError?: (error: unknown) => void;
}

function defaultExtractMemberMids(payload: unknown): string[] {
  const found = new Set<string>();
  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 5) return;
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      for (const key of ["memberMid", "targetMemberMid", "speakerMid", "userMid"]) {
        const val = record[key];
        if (typeof val === "string" && val.trim().length > 0) {
          found.add(val.trim());
        }
      }
      for (const val of Object.values(record)) {
        visit(val, depth + 1);
      }
    }
  };
  visit(payload, 0);
  return Array.from(found);
}

function resolveExpiresAt(now: number, options?: LiveTalkBanOptions): number | undefined {
  if (typeof options?.expiresAt === "number" && Number.isFinite(options.expiresAt)) {
    return options.expiresAt;
  }
  if (typeof options?.ttlMs === "number" && Number.isFinite(options.ttlMs) && options.ttlMs > 0) {
    return now + options.ttlMs;
  }
  return undefined;
}

export class LiveTalkBanManager<TClient extends LiveTalkClientLike = LiveTalkClientLike> {
  private readonly bans = new Map<string, LiveTalkBanEntry>();
  private readonly manager: LiveTalkManager<TClient>;
  private readonly defaultBuildTarget: (memberMid: string) => LiveTalkKickOutTarget;
  private readonly onPersistError?: (error: unknown) => void;
  private autoSaveFilePath?: string;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(
    manager: LiveTalkManager<TClient>,
    options?: LiveTalkBanManagerOptions,
  ) {
    this.manager = manager;
    this.defaultBuildTarget = options?.buildTarget ??
      ((memberMid: string) => ({ memberMid } as unknown as LiveTalkKickOutTarget));
    this.autoSaveFilePath = options?.autoSaveFilePath;
    this.onPersistError = options?.onPersistError;
  }

  setAutoSaveFile(filePath?: string): void {
    this.autoSaveFilePath = filePath?.trim() ? filePath.trim() : undefined;
  }

  getAutoSaveFile(): string | undefined {
    return this.autoSaveFilePath;
  }

  private isExpired(entry: LiveTalkBanEntry, now = Date.now()): boolean {
    return typeof entry.expiresAt === "number" && entry.expiresAt <= now;
  }

  /**
   * 期限切れの BAN エントリを削除し、削除した件数を返します。
   */
  pruneExpired(now = Date.now()): number {
    let removed = 0;
    for (const [mid, entry] of this.bans.entries()) {
      if (this.isExpired(entry, now)) {
        this.bans.delete(mid);
        removed++;
      }
    }
    if (removed > 0) {
      this.scheduleAutoSave();
    }
    return removed;
  }

  private scheduleAutoSave(): void {
    if (!this.autoSaveFilePath) return;
    const targetPath = this.autoSaveFilePath;
    const snapshot = JSON.stringify(this.listBans(), null, 2);
    this.persistChain = this.persistChain
      .then(async () => {
        await Deno.writeTextFile(targetPath, snapshot);
      })
      .catch((err) => {
        this.onPersistError?.(err);
      });
  }

  /**
   * 自動保存キューの完了を待機します（テストや終了処理向け）。
   */
  async flushAutoSave(): Promise<void> {
    await this.persistChain;
  }

  ban(memberMid: string, options?: LiveTalkBanOptions): LiveTalkBanEntry {
    const normalizedMid = requireString(memberMid, "memberMid", FEATURE);
    const now = Date.now();
    const entry: LiveTalkBanEntry = {
      memberMid: normalizedMid,
      reason: options?.reason,
      bannedAt: now,
      expiresAt: resolveExpiresAt(now, options),
      squareChatMid: options?.squareChatMid,
    };
    this.bans.set(normalizedMid, entry);
    this.scheduleAutoSave();
    return entry;
  }

  unban(memberMid: string): boolean {
    const normalizedMid = requireString(memberMid, "memberMid", FEATURE);
    const deleted = this.bans.delete(normalizedMid);
    if (deleted) {
      this.scheduleAutoSave();
    }
    return deleted;
  }

  isBanned(memberMid: string): boolean {
    const mid = memberMid.trim();
    const entry = this.bans.get(mid);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.bans.delete(mid);
      this.scheduleAutoSave();
      return false;
    }
    return true;
  }

  getBan(memberMid: string): LiveTalkBanEntry | undefined {
    const mid = memberMid.trim();
    const entry = this.bans.get(mid);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.bans.delete(mid);
      this.scheduleAutoSave();
      return undefined;
    }
    return entry;
  }

  listBans(): LiveTalkBanEntry[] {
    const now = Date.now();
    let expiredChanged = false;
    const active: LiveTalkBanEntry[] = [];
    for (const [mid, entry] of this.bans.entries()) {
      if (this.isExpired(entry, now)) {
        this.bans.delete(mid);
        expiredChanged = true;
      } else {
        active.push(entry);
      }
    }
    if (expiredChanged) {
      this.scheduleAutoSave();
    }
    return active;
  }

  clearBans(): void {
    const hadEntries = this.bans.size > 0;
    this.bans.clear();
    if (hadEntries) {
      this.scheduleAutoSave();
    }
  }

  async kickAndBan(params: LiveTalkBanKickParams): Promise<void> {
    const squareChatMid = requireString(params.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(params.sessionId, "sessionId", FEATURE);
    const memberMid = requireString(params.memberMid, "memberMid", FEATURE);

    this.ban(memberMid, {
      reason: params.reason,
      squareChatMid,
      ttlMs: params.ttlMs,
      expiresAt: params.expiresAt,
    });

    const target = (params.buildTarget ?? this.defaultBuildTarget)(memberMid);
    await this.manager.kickOutParticipants({
      squareChatMid,
      sessionId,
      target,
    });
  }

  async enforceMember(params: {
    squareChatMid: string;
    sessionId: string;
    memberMid: string;
    buildTarget?: (memberMid: string) => LiveTalkKickOutTarget;
  }): Promise<boolean> {
    if (!this.isBanned(params.memberMid)) {
      return false;
    }
    const mid = params.memberMid.trim();
    const target = (params.buildTarget ?? this.defaultBuildTarget)(mid);
    await this.manager.kickOutParticipants({
      squareChatMid: params.squareChatMid,
      sessionId: params.sessionId,
      target,
    });
    return true;
  }

  attachAutoEnforce(options: LiveTalkAutoEnforceOptions): () => void {
    const squareChatMid = requireString(options.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(options.sessionId, "sessionId", FEATURE);
    const extractMids = options.extractMemberMids ?? defaultExtractMemberMids;
    const inFlight = new Set<string>();

    return this.manager.onAnyEvent(async (event) => {
      const mids = extractMids(event.payload);
      for (const mid of mids) {
        if (!this.isBanned(mid) || inFlight.has(mid)) continue;
        inFlight.add(mid);
        try {
          const kicked = await this.enforceMember({
            squareChatMid,
            sessionId,
            memberMid: mid,
            buildTarget: options.buildTarget,
          });
          if (kicked) {
            options.onEnforced?.({ memberMid: mid, squareChatMid, sessionId });
          }
        } catch (error) {
          options.onError?.(error);
        } finally {
          inFlight.delete(mid);
        }
      }
    });
  }

  async saveToFile(filePath: string): Promise<void> {
    const path = requireString(filePath, "filePath", FEATURE);
    const payload = JSON.stringify(this.listBans(), null, 2);
    await Deno.writeTextFile(path, payload);
  }

  async loadFromFile(filePath: string, options?: { merge?: boolean }): Promise<number> {
    const path = requireString(filePath, "filePath", FEATURE);
    const raw = await Deno.readTextFile(path);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("BAN list JSON must be an array");
    }
    if (!options?.merge) {
      this.bans.clear();
    }
    const now = Date.now();
    let count = 0;
    for (const item of parsed) {
      if (item && typeof item.memberMid === "string" && item.memberMid.trim().length > 0) {
        const mid = item.memberMid.trim();
        const expiresAt = typeof item.expiresAt === "number" && Number.isFinite(item.expiresAt)
          ? item.expiresAt
          : undefined;
        if (typeof expiresAt === "number" && expiresAt <= now) {
          continue;
        }
        this.bans.set(mid, {
          memberMid: mid,
          reason: typeof item.reason === "string" ? item.reason : undefined,
          bannedAt: typeof item.bannedAt === "number" ? item.bannedAt : now,
          expiresAt,
          squareChatMid: typeof item.squareChatMid === "string" ? item.squareChatMid : undefined,
        });
        count++;
      }
    }
    return count;
  }
}
