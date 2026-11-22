/**
 * LiveTalk 拡張 マネージャー
 */

import {
  getErrorMessage,
  getTimestamp,
  requireString,
  SquareApiError,
  SquareExtensionBase,
  SquareValidationError,
} from "../shared/mod.ts";
import type { SquareExtensionContext } from "../shared/mod.ts";
import { LiveTalkEventBus } from "./LiveTalkEvents.ts";
import type {
  LiveTalkAnyEventListener,
  LiveTalkEventListener,
  LiveTalkNormalizedEventKind,
} from "./LiveTalkEvents.ts";
import { LiveTalkMonitor } from "./LiveTalkMonitor.ts";
import type {
  AcceptSpeakersResponse,
  AcquireLiveTalkResponse,
  FetchLiveTalkEventsParams,
  FetchLiveTalkEventsResponse,
  FindLiveTalkByInvitationTicketRequest,
  FindLiveTalkByInvitationTicketResponse,
  ForceEndLiveTalkRequest,
  ForceEndLiveTalkResponse,
  GetLiveTalkInfoForNonMemberRequest,
  GetLiveTalkInfoForNonMemberResponse,
  GetLiveTalkInvitationUrlResponse,
  GetLiveTalkSpeakersForNonMemberRequest,
  GetLiveTalkSpeakersForNonMemberResponse,
  InviteToLiveTalkRequest,
  InviteToLiveTalkResponse,
  JoinLiveTalkParams,
  JoinLiveTalkResponse,
  KickOutLiveTalkParams,
  KickOutLiveTalkParticipantsResponse,
  LiveTalk,
  LiveTalkClientLike,
  LiveTalkEvent,
  LiveTalkExtensionOptions,
  LiveTalkMonitorStartOptions,
  LiveTalkServiceLike,
  LiveTalkSessionState,
  LiveTalkSpeaker,
  LiveTalkSpeakerEntry,
  RejectSpeakersResponse,
  RejectToSpeakRequest,
  RejectToSpeakResponse,
  ReportLiveTalkRequest,
  ReportLiveTalkResponse,
  ReportLiveTalkSpeakerRequest,
  ReportLiveTalkSpeakerResponse,
  RequestToListenRequest,
  RequestToListenResponse,
  RequestToSpeakRequest,
  RequestToSpeakResponse,
  SpeakerTargetsParams,
  UpdateLiveTalkAttrsParams,
  UpdateLiveTalkAttrsResponse,
} from "./types.ts";

const FEATURE = "live-talk" as const;

export class LiveTalkManager<TClient extends LiveTalkClientLike>
  extends SquareExtensionBase<TClient> {
  readonly name = "live-talk" as const;
  readonly version = "0.1.0";

  private readonly ltOptions: LiveTalkExtensionOptions;
  private readonly eventBus: LiveTalkEventBus;
  private readonly monitor: LiveTalkMonitor;
  private readonly sessions = new Map<string, LiveTalkSessionState>();
  private unsubscribeEventHistory?: () => void;

  constructor(
    context: SquareExtensionContext<TClient>,
    options: LiveTalkExtensionOptions = {},
  ) {
    super({
      client: context.client,
      options: { ...context.options, ...options },
    });
    this.ltOptions = { ...context.options, ...options };
    this.eventBus = new LiveTalkEventBus();
    this.monitor = new LiveTalkMonitor(this.getService(), this.eventBus, this.ltOptions);
  }

  private getService(): LiveTalkServiceLike {
    return this.client.base.livetalk;
  }

  private sessionKey(squareChatMid: string, sessionId: string): string {
    return `${squareChatMid}:${sessionId}`;
  }

  private ensureSessionState(squareChatMid: string, sessionId: string): LiveTalkSessionState {
    const key = this.sessionKey(squareChatMid, sessionId);
    let state = this.sessions.get(key);
    if (!state) {
      state = {
        squareChatMid,
        sessionId,
        joined: false,
        syncToken: "",
        speakers: new Map<string, LiveTalkSpeakerEntry>(),
        updatedAt: getTimestamp(),
      };
      this.sessions.set(key, state);
    }
    return state;
  }

  protected async onInitialize(): Promise<void> {
    this.unsubscribeEventHistory = this.eventBus.onAny((unified) => {
      this.applyUnifiedEventToSessions(unified.rawEvent);
    });
  }

  protected async onDispose(): Promise<void> {
    await this.monitor.stop();
    this.unsubscribeEventHistory?.();
    this.unsubscribeEventHistory = undefined;
    this.eventBus.removeAllListeners();
  }

  private applyUnifiedEventToSessions(rawEvent: LiveTalkEvent): void {
    const now = getTimestamp();
    for (const state of this.sessions.values()) {
      state.revision = rawEvent.revision;
      state.updatedAt = now;

      if (state.liveTalk) {
        if (
          (rawEvent.type === 1 || rawEvent.type === "NOTIFIED_UPDATE_LIVE_TALK_TITLE") &&
          rawEvent.payload.notifiedUpdateLiveTalkTitle
        ) {
          const title = (rawEvent.payload.notifiedUpdateLiveTalkTitle as { title?: string }).title;
          if (typeof title === "string") {
            state.liveTalk = { ...state.liveTalk, title };
          }
        } else if (
          (rawEvent.type === 2 || rawEvent.type === "NOTIFIED_UPDATE_LIVE_TALK_ANNOUNCEMENT") &&
          rawEvent.payload.notifiedUpdateLiveTalkAnnouncement
        ) {
          const announcement = (
            rawEvent.payload.notifiedUpdateLiveTalkAnnouncement as { announcement?: string }
          ).announcement;
          if (typeof announcement === "string") {
            state.liveTalk = { ...state.liveTalk, announcement };
          }
        } else if (
          (rawEvent.type === 4 || rawEvent.type === "NOTIFIED_UPDATE_LIVE_TALK_ALLOW_REQUEST_TO_SPEAK") &&
          rawEvent.payload.notifiedUpdateLiveTalkAllowRequestToSpeak
        ) {
          const allowRequestToSpeak = (
            rawEvent.payload.notifiedUpdateLiveTalkAllowRequestToSpeak as {
              allowRequestToSpeak?: boolean;
            }
          ).allowRequestToSpeak;
          if (typeof allowRequestToSpeak === "boolean") {
            state.liveTalk = { ...state.liveTalk, allowRequestToSpeak };
          }
        }
      }
    }
  }

  getSessionState(squareChatMid: string, sessionId: string): LiveTalkSessionState | undefined {
    this.assertInitialized();
    return this.sessions.get(this.sessionKey(squareChatMid, sessionId));
  }

  getLiveTalk(squareChatMid: string, sessionId: string): LiveTalk | undefined {
    this.assertInitialized();
    return this.sessions.get(this.sessionKey(squareChatMid, sessionId))?.liveTalk;
  }

  getSpeakers(squareChatMid: string, sessionId: string): LiveTalkSpeakerEntry[] {
    this.assertInitialized();
    const state = this.sessions.get(this.sessionKey(squareChatMid, sessionId));
    return state ? Array.from(state.speakers.values()) : [];
  }

  upsertSpeaker(
    squareChatMid: string,
    sessionId: string,
    key: string,
    speaker: LiveTalkSpeaker,
  ): LiveTalkSpeakerEntry {
    this.assertInitialized();
    const midKey = requireString(key, "speakerKey", FEATURE);
    const state = this.ensureSessionState(squareChatMid, sessionId);
    const entry: LiveTalkSpeakerEntry = {
      key: midKey,
      speaker,
      role: speaker.role,
      updatedAt: getTimestamp(),
    };
    state.speakers.set(midKey, entry);
    state.updatedAt = getTimestamp();
    return entry;
  }

  async acquire(request: Record<string, unknown>): Promise<AcquireLiveTalkResponse> {
    this.assertInitialized();
    let res: AcquireLiveTalkResponse;
    try {
      res = await this.getService().acquireLiveTalk({ request });
    } catch (error) {
      throw new SquareApiError(FEATURE, `acquireLiveTalk failed: ${getErrorMessage(error)}`, error);
    }

    if (res.liveTalk) {
      const state = this.ensureSessionState(res.liveTalk.squareChatMid, res.liveTalk.sessionId);
      state.liveTalk = res.liveTalk;
      state.revision = res.liveTalk.revision;
      state.updatedAt = getTimestamp();
    }
    return res;
  }

  async join(params: JoinLiveTalkParams): Promise<JoinLiveTalkResponse> {
    this.assertInitialized();
    const squareChatMid = requireString(params.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(params.sessionId, "sessionId", FEATURE);

    let res: JoinLiveTalkResponse;
    try {
      res = await this.getService().joinLiveTalk({
        request: {
          squareChatMid,
          sessionId,
          wantToSpeak: params.wantToSpeak ?? false,
          claimAdult: params.claimAdult ?? (0 as JoinLiveTalkParams["claimAdult"] & {}), 
        },
      });
    } catch (error) {
      throw new SquareApiError(FEATURE, `joinLiveTalk failed: ${getErrorMessage(error)}`, error);
    }

    const state = this.ensureSessionState(squareChatMid, sessionId);
    state.joined = true;
    state.joinResponse = res;
    state.updatedAt = getTimestamp();
    return res;
  }

  leaveLocal(squareChatMid: string, sessionId: string): void {
    this.assertInitialized();
    const mid = requireString(squareChatMid, "squareChatMid", FEATURE);
    const sid = requireString(sessionId, "sessionId", FEATURE);
    const state = this.sessions.get(this.sessionKey(mid, sid));
    if (state) {
      state.joined = false;
      state.joinResponse = undefined;
      state.updatedAt = getTimestamp();
    }
  }

  async updateAttrs(params: UpdateLiveTalkAttrsParams): Promise<UpdateLiveTalkAttrsResponse> {
    this.assertInitialized();
    const squareChatMid = requireString(params.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(params.sessionId, "sessionId", FEATURE);
    if (!Array.isArray(params.updatedAttrs) || params.updatedAttrs.length === 0) {
      throw new SquareValidationError(FEATURE, "updatedAttrs must be a non-empty array.", {
        updatedAttrs: params.updatedAttrs,
      });
    }

    const state = this.ensureSessionState(squareChatMid, sessionId);
    const currentLiveTalk: LiveTalk = {
      squareChatMid,
      sessionId,
      title: "",
      type: "PUBLIC",
      speakerSetting: "APPROVAL",
      allowRequestToSpeak: false,
      hostMemberMid: "",
      announcement: "",
      participantCount: 0,
      revision: state.revision ?? 0,
      startedAt: 0,
      ...state.liveTalk,
      ...params.patch,
    };

    let res: UpdateLiveTalkAttrsResponse;
    try {
      res = await this.getService().updateLiveTalkAttrs({
        request: {
          updatedAttrs: params.updatedAttrs,
          liveTalk: currentLiveTalk,
        },
      });
    } catch (error) {
      throw new SquareApiError(FEATURE, `updateLiveTalkAttrs failed: ${getErrorMessage(error)}`, error);
    }

    state.liveTalk = currentLiveTalk;
    state.updatedAt = getTimestamp();
    return res;
  }

  async acceptSpeakers(params: SpeakerTargetsParams): Promise<AcceptSpeakersResponse> {
    this.assertInitialized();
    const squareChatMid = requireString(params.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(params.sessionId, "sessionId", FEATURE);
    this.validateTargetMids(params.targetMids);

    try {
      return await this.getService().acceptSpeakers({
        request: { squareChatMid, sessionId, targetMids: params.targetMids },
      });
    } catch (error) {
      throw new SquareApiError(FEATURE, `acceptSpeakers failed: ${getErrorMessage(error)}`, error);
    }
  }

  async rejectSpeakers(params: SpeakerTargetsParams): Promise<RejectSpeakersResponse> {
    this.assertInitialized();
    const squareChatMid = requireString(params.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(params.sessionId, "sessionId", FEATURE);
    this.validateTargetMids(params.targetMids);

    try {
      return await this.getService().rejectSpeakers({
        request: { squareChatMid, sessionId, targetMids: params.targetMids },
      });
    } catch (error) {
      throw new SquareApiError(FEATURE, `rejectSpeakers failed: ${getErrorMessage(error)}`, error);
    }
  }

  async requestToSpeak(request: RequestToSpeakRequest): Promise<RequestToSpeakResponse> {
    this.assertInitialized();
    try {
      return await this.getService().requestToSpeak({ request });
    } catch (error) {
      throw new SquareApiError(FEATURE, `requestToSpeak failed: ${getErrorMessage(error)}`, error);
    }
  }

  async requestToListen(request: RequestToListenRequest): Promise<RequestToListenResponse> {
    this.assertInitialized();
    try {
      return await this.getService().requestToListen({ request });
    } catch (error) {
      throw new SquareApiError(FEATURE, `requestToListen failed: ${getErrorMessage(error)}`, error);
    }
  }

  async rejectToSpeak(request: RejectToSpeakRequest): Promise<RejectToSpeakResponse> {
    this.assertInitialized();
    try {
      return await this.getService().rejectToSpeak({ request });
    } catch (error) {
      throw new SquareApiError(FEATURE, `rejectToSpeak failed: ${getErrorMessage(error)}`, error);
    }
  }

  async kickOutParticipants(params: KickOutLiveTalkParams): Promise<KickOutLiveTalkParticipantsResponse> {
    this.assertInitialized();
    const squareChatMid = requireString(params.squareChatMid, "squareChatMid", FEATURE);
    const sessionId = requireString(params.sessionId, "sessionId", FEATURE);
    try {
      return await this.getService().kickOutLiveTalkParticipants({
        request: { squareChatMid, sessionId, target: params.target },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `kickOutLiveTalkParticipants failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async forceEnd(request: ForceEndLiveTalkRequest): Promise<ForceEndLiveTalkResponse> {
    this.assertInitialized();
    try {
      return await this.getService().forceEndLiveTalk({ request });
    } catch (error) {
      throw new SquareApiError(FEATURE, `forceEndLiveTalk failed: ${getErrorMessage(error)}`, error);
    }
  }

  async invite(request: InviteToLiveTalkRequest): Promise<InviteToLiveTalkResponse> {
    this.assertInitialized();
    try {
      return await this.getService().inviteToLiveTalk({ request });
    } catch (error) {
      throw new SquareApiError(FEATURE, `inviteToLiveTalk failed: ${getErrorMessage(error)}`, error);
    }
  }

  async getInvitationUrl(
    squareChatMid: string,
    sessionId: string,
  ): Promise<GetLiveTalkInvitationUrlResponse> {
    this.assertInitialized();
    const mid = requireString(squareChatMid, "squareChatMid", FEATURE);
    const sid = requireString(sessionId, "sessionId", FEATURE);
    try {
      return await this.getService().getLiveTalkInvitationUrl({
        request: { squareChatMid: mid, sessionId: sid },
      });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `getLiveTalkInvitationUrl failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async getInfoForNonMember(
    request: GetLiveTalkInfoForNonMemberRequest,
  ): Promise<GetLiveTalkInfoForNonMemberResponse> {
    this.assertInitialized();
    try {
      return await this.getService().getLiveTalkInfoForNonMember({ request });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `getLiveTalkInfoForNonMember failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async getSpeakersForNonMember(
    request: GetLiveTalkSpeakersForNonMemberRequest,
  ): Promise<GetLiveTalkSpeakersForNonMemberResponse> {
    this.assertInitialized();
    try {
      return await this.getService().getLiveTalkSpeakersForNonMember({ request });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `getLiveTalkSpeakersForNonMember failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async findByInvitationTicket(
    request: FindLiveTalkByInvitationTicketRequest,
  ): Promise<FindLiveTalkByInvitationTicketResponse> {
    this.assertInitialized();
    try {
      return await this.getService().findLiveTalkByInvitationTicket({ request });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `findLiveTalkByInvitationTicket failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async reportLiveTalk(request: ReportLiveTalkRequest): Promise<ReportLiveTalkResponse> {
    this.assertInitialized();
    try {
      return await this.getService().reportLiveTalk({ request });
    } catch (error) {
      throw new SquareApiError(FEATURE, `reportLiveTalk failed: ${getErrorMessage(error)}`, error);
    }
  }

  async reportSpeaker(
    request: ReportLiveTalkSpeakerRequest,
  ): Promise<ReportLiveTalkSpeakerResponse> {
    this.assertInitialized();
    try {
      return await this.getService().reportLiveTalkSpeaker({ request });
    } catch (error) {
      throw new SquareApiError(
        FEATURE,
        `reportLiveTalkSpeaker failed: ${getErrorMessage(error)}`,
        error,
      );
    }
  }

  async fetchEvents(
    params: FetchLiveTalkEventsParams,
  ): Promise<{ response: FetchLiveTalkEventsResponse; events: LiveTalkEvent[] }> {
    this.assertInitialized();
    const result = await this.monitor.pollOnce(params);
    const state = this.ensureSessionState(params.squareChatMid, params.sessionId);
    state.syncToken = this.monitor.getSyncToken(params.squareChatMid, params.sessionId);
    state.updatedAt = getTimestamp();
    return result;
  }

  async startMonitoring(monitorOptions: LiveTalkMonitorStartOptions): Promise<void> {
    this.assertInitialized();
    await this.monitor.start(monitorOptions);
  }

  async stopMonitoring(): Promise<void> {
    this.assertInitialized();
    await this.monitor.stop();
  }

  get isMonitoring(): boolean {
    return this.monitor.isMonitoring;
  }

  onEvent(kind: LiveTalkNormalizedEventKind, listener: LiveTalkEventListener): () => void {
    return this.eventBus.on(kind, listener);
  }

  onAnyEvent(listener: LiveTalkAnyEventListener): () => void {
    return this.eventBus.onAny(listener);
  }

  getEventHistory(limit?: number) {
    return this.eventBus.getHistory(limit);
  }

  private validateTargetMids(targetMids: unknown): asserts targetMids is string[] {
    if (!Array.isArray(targetMids) || targetMids.length === 0) {
      throw new SquareValidationError(FEATURE, "targetMids must be a non-empty string array.", {
        targetMids,
      });
    }
    for (let i = 0; i < targetMids.length; i++) {
      requireString(targetMids[i], `targetMids[${i}]`, FEATURE);
    }
  }
}


