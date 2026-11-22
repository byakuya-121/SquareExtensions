/**
 * LiveTalk 拡張 型定義
 * 対象: @evex/linejs@3.4.2 / @jsr/evex__linejs-types
 */

import type {
  AcceptSpeakersRequest,
  AcceptSpeakersResponse,
  AcquireLiveTalkResponse,
  BooleanState,
  FetchLiveTalkEventsRequest,
  FetchLiveTalkEventsResponse,
  FindLiveTalkByInvitationTicketRequest,
  FindLiveTalkByInvitationTicketResponse,
  ForceEndLiveTalkRequest,
  ForceEndLiveTalkResponse,
  GetLiveTalkInfoForNonMemberRequest,
  GetLiveTalkInfoForNonMemberResponse,
  GetLiveTalkInvitationUrlRequest,
  GetLiveTalkInvitationUrlResponse,
  GetLiveTalkSpeakersForNonMemberRequest,
  GetLiveTalkSpeakersForNonMemberResponse,
  InviteToLiveTalkRequest,
  InviteToLiveTalkResponse,
  JoinLiveTalkRequest,
  JoinLiveTalkResponse,
  KickOutLiveTalkParticipantsRequest,
  KickOutLiveTalkParticipantsResponse,
  LiveTalk,
  LiveTalkAttribute,
  LiveTalkEvent,
  LiveTalkEventNotifiedUpdateLiveTalkAllowRequestToSpeak,
  LiveTalkEventNotifiedUpdateLiveTalkAnnouncement,
  LiveTalkEventNotifiedUpdateLiveTalkTitle,
  LiveTalkEventPayload,
  LiveTalkEventType,
  LiveTalkKickOutTarget,
  LiveTalkRole,
  LiveTalkSpeaker,
  LiveTalkSpeakerSetting,
  LiveTalkType,
  RejectSpeakersRequest,
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
  SquareMemberRole,
  UpdateLiveTalkAttrsRequest,
  UpdateLiveTalkAttrsResponse,
} from "jsr:@evex/linejs-types";
import type { SquareExtensionOptions } from "../shared/mod.ts";

export type {
  AcceptSpeakersRequest,
  AcceptSpeakersResponse,
  AcquireLiveTalkResponse,
  BooleanState,
  FetchLiveTalkEventsRequest,
  FetchLiveTalkEventsResponse,
  FindLiveTalkByInvitationTicketRequest,
  FindLiveTalkByInvitationTicketResponse,
  ForceEndLiveTalkRequest,
  ForceEndLiveTalkResponse,
  GetLiveTalkInfoForNonMemberRequest,
  GetLiveTalkInfoForNonMemberResponse,
  GetLiveTalkInvitationUrlRequest,
  GetLiveTalkInvitationUrlResponse,
  GetLiveTalkSpeakersForNonMemberRequest,
  GetLiveTalkSpeakersForNonMemberResponse,
  InviteToLiveTalkRequest,
  InviteToLiveTalkResponse,
  JoinLiveTalkRequest,
  JoinLiveTalkResponse,
  KickOutLiveTalkParticipantsRequest,
  KickOutLiveTalkParticipantsResponse,
  LiveTalk,
  LiveTalkAttribute,
  LiveTalkEvent,
  LiveTalkEventNotifiedUpdateLiveTalkAllowRequestToSpeak,
  LiveTalkEventNotifiedUpdateLiveTalkAnnouncement,
  LiveTalkEventNotifiedUpdateLiveTalkTitle,
  LiveTalkEventPayload,
  LiveTalkEventType,
  LiveTalkKickOutTarget,
  LiveTalkRole,
  LiveTalkSpeaker,
  LiveTalkSpeakerSetting,
  LiveTalkType,
  RejectSpeakersRequest,
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
  SquareMemberRole,
  UpdateLiveTalkAttrsRequest,
  UpdateLiveTalkAttrsResponse,
};

export interface LiveTalkServiceLike {
  acceptSpeakers(param: { request: AcceptSpeakersRequest }): Promise<AcceptSpeakersResponse>;
  rejectSpeakers(param: { request: RejectSpeakersRequest }): Promise<RejectSpeakersResponse>;
  rejectToSpeak(param: { request: RejectToSpeakRequest }): Promise<RejectToSpeakResponse>;
  requestToListen(param: { request: RequestToListenRequest }): Promise<RequestToListenResponse>;
  requestToSpeak(param: { request: RequestToSpeakRequest }): Promise<RequestToSpeakResponse>;
  updateLiveTalkAttrs(param: { request: UpdateLiveTalkAttrsRequest }): Promise<UpdateLiveTalkAttrsResponse>;
  acquireLiveTalk(param: { request: Record<string, unknown> }): Promise<AcquireLiveTalkResponse>;
  joinLiveTalk(param: { request: JoinLiveTalkRequest }): Promise<JoinLiveTalkResponse>;
  fetchLiveTalkEvents(param: { request: FetchLiveTalkEventsRequest }): Promise<FetchLiveTalkEventsResponse>;
  inviteToLiveTalk(param: { request: InviteToLiveTalkRequest }): Promise<InviteToLiveTalkResponse>;
  kickOutLiveTalkParticipants(param: { request: KickOutLiveTalkParticipantsRequest }): Promise<KickOutLiveTalkParticipantsResponse>;
  forceEndLiveTalk(param: { request: ForceEndLiveTalkRequest }): Promise<ForceEndLiveTalkResponse>;
  getLiveTalkInfoForNonMember(param: { request: GetLiveTalkInfoForNonMemberRequest }): Promise<GetLiveTalkInfoForNonMemberResponse>;
  getLiveTalkInvitationUrl(param: { request: GetLiveTalkInvitationUrlRequest }): Promise<GetLiveTalkInvitationUrlResponse>;
  getLiveTalkSpeakersForNonMember(param: { request: GetLiveTalkSpeakersForNonMemberRequest }): Promise<GetLiveTalkSpeakersForNonMemberResponse>;
  findLiveTalkByInvitationTicket(param: { request: FindLiveTalkByInvitationTicketRequest }): Promise<FindLiveTalkByInvitationTicketResponse>;
  reportLiveTalk(param: { request: ReportLiveTalkRequest }): Promise<ReportLiveTalkResponse>;
  reportLiveTalkSpeaker(param: { request: ReportLiveTalkSpeakerRequest }): Promise<ReportLiveTalkSpeakerResponse>;
}

export interface LiveTalkClientLike {
  readonly base: {
    readonly livetalk: LiveTalkServiceLike;
  };
}

export interface LiveTalkExtensionOptions extends SquareExtensionOptions {
  defaultEventLimit?: number;
  pollIntervalMs?: number;
  drainHasMore?: boolean;
}

export type Int64 = number | bigint;

export interface LiveTalkSpeakerEntry {
  key: string;
  speaker: LiveTalkSpeaker;
  role?: SquareMemberRole;
  updatedAt: number;
}

export interface LiveTalkSessionState {
  squareChatMid: string;
  sessionId: string;
  liveTalk?: LiveTalk;
  joined: boolean;
  joinResponse?: JoinLiveTalkResponse;
  syncToken: string;
  revision?: Int64;
  speakers: Map<string, LiveTalkSpeakerEntry>;
  updatedAt: number;
}

export interface JoinLiveTalkParams {
  squareChatMid: string;
  sessionId: string;
  wantToSpeak?: boolean;
  claimAdult?: BooleanState;
}

export interface FetchLiveTalkEventsParams {
  squareChatMid: string;
  sessionId: string;
  syncToken?: string;
  limit?: number;
  drainAll?: boolean;
}

export interface UpdateLiveTalkAttrsParams {
  squareChatMid: string;
  sessionId: string;
  updatedAttrs: LiveTalkAttribute[];
  patch?: Partial<LiveTalk>;
}

export interface SpeakerTargetsParams {
  squareChatMid: string;
  sessionId: string;
  targetMids: string[];
}

export interface KickOutLiveTalkParams {
  squareChatMid: string;
  sessionId: string;
  target: LiveTalkKickOutTarget;
}

export interface LiveTalkMonitorStartOptions {
  squareChatMid: string;
  sessionId: string;
  syncToken?: string;
  limit?: number;
  intervalMs?: number;
  drainAll?: boolean;
  signal?: AbortSignal;
  onError?: (error: unknown) => void;
}


