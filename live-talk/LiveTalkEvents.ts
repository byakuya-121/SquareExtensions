/**
 * LiveTalk 拡張 イベント定義および統一管理
 */

import { getTimestamp } from "../shared/mod.ts";
import type {
  LiveTalkEvent,
  LiveTalkEventPayload,
  LiveTalkEventType,
} from "./types.ts";

export type LiveTalkNormalizedEventKind =
  | "title_updated"
  | "announcement_updated"
  | "member_role_updated"
  | "allow_request_to_speak_updated"
  | "member_updated"
  | "unknown";

export interface LiveTalkUnifiedEvent {
  readonly feature: "live-talk";
  readonly kind: LiveTalkNormalizedEventKind;
  readonly rawType: LiveTalkEventType;
  readonly revision: LiveTalkEvent["revision"];
  readonly payload: LiveTalkEventPayload;
  readonly rawEvent: LiveTalkEvent;
  readonly timestamp: number;
}

export type LiveTalkEventListener = (event: LiveTalkUnifiedEvent) => void | Promise<void>;
export type LiveTalkAnyEventListener = (event: LiveTalkUnifiedEvent) => void | Promise<void>;

export function normalizeLiveTalkEventType(eventType: LiveTalkEventType): LiveTalkNormalizedEventKind {
  switch (eventType) {
    case 1:
    case "NOTIFIED_UPDATE_LIVE_TALK_TITLE":
      return "title_updated";
    case 2:
    case "NOTIFIED_UPDATE_LIVE_TALK_ANNOUNCEMENT":
      return "announcement_updated";
    case 3:
    case "NOTIFIED_UPDATE_SQUARE_MEMBER_ROLE":
      return "member_role_updated";
    case 4:
    case "NOTIFIED_UPDATE_LIVE_TALK_ALLOW_REQUEST_TO_SPEAK":
      return "allow_request_to_speak_updated";
    case 5:
    case "NOTIFIED_UPDATE_SQUARE_MEMBER":
      return "member_updated";
    default:
      return "unknown";
  }
}

export function createLiveTalkUnifiedEvent(rawEvent: LiveTalkEvent): LiveTalkUnifiedEvent {
  return {
    feature: "live-talk",
    kind: normalizeLiveTalkEventType(rawEvent.type),
    rawType: rawEvent.type,
    revision: rawEvent.revision,
    payload: rawEvent.payload,
    rawEvent,
    timestamp: getTimestamp(),
  };
}

export class LiveTalkEventBus {
  private readonly listenersByKind = new Map<LiveTalkNormalizedEventKind, Set<LiveTalkEventListener>>();
  private readonly anyListeners = new Set<LiveTalkAnyEventListener>();
  private readonly recentEvents: LiveTalkUnifiedEvent[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 200) {
    this.maxHistory = maxHistory > 0 ? maxHistory : 200;
  }

  on(kind: LiveTalkNormalizedEventKind, listener: LiveTalkEventListener): () => void {
    let set = this.listenersByKind.get(kind);
    if (!set) {
      set = new Set();
      this.listenersByKind.set(kind, set);
    }
    set.add(listener);
    return () => this.off(kind, listener);
  }

  once(kind: LiveTalkNormalizedEventKind, listener: LiveTalkEventListener): () => void {
    const wrapped: LiveTalkEventListener = async (event) => {
      this.off(kind, wrapped);
      await listener(event);
    };
    return this.on(kind, wrapped);
  }

  off(kind: LiveTalkNormalizedEventKind, listener: LiveTalkEventListener): void {
    this.listenersByKind.get(kind)?.delete(listener);
  }

  onAny(listener: LiveTalkAnyEventListener): () => void {
    this.anyListeners.add(listener);
    return () => this.offAny(listener);
  }

  offAny(listener: LiveTalkAnyEventListener): void {
    this.anyListeners.delete(listener);
  }

  async emitRaw(rawEvent: LiveTalkEvent): Promise<LiveTalkUnifiedEvent> {
    const unified = createLiveTalkUnifiedEvent(rawEvent);
    await this.emitUnified(unified);
    return unified;
  }

  async emitUnified(event: LiveTalkUnifiedEvent): Promise<void> {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxHistory) {
      this.recentEvents.shift();
    }
    const kindListeners = this.listenersByKind.get(event.kind);
    if (kindListeners) {
      for (const listener of Array.from(kindListeners)) {
        await listener(event);
      }
    }
    for (const listener of Array.from(this.anyListeners)) {
      await listener(event);
    }
  }

  getHistory(limit?: number): readonly LiveTalkUnifiedEvent[] {
    if (limit === undefined || limit >= this.recentEvents.length) {
      return [...this.recentEvents];
    }
    if (limit <= 0) return [];
    return this.recentEvents.slice(this.recentEvents.length - limit);
  }

  clearHistory(): void {
    this.recentEvents.length = 0;
  }

  removeAllListeners(): void {
    this.listenersByKind.clear();
    this.anyListeners.clear();
  }
}
