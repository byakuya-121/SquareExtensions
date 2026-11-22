import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "jsr:@std/assert";
import type {
  FetchSquareChatEventsResponse,
  FindLiveTalkByInvitationTicketResponse,
  GetLiveTalkInfoForNonMemberResponse,
  GetSquareThreadResponse,
  JoinLiveTalkResponse,
  KickOutLiveTalkParticipantsRequest,
  KickOutLiveTalkParticipantsResponse,
  LiveTalkEvent,
  SendSquareThreadMessageResponse,
  SquareEvent,
} from "jsr:@evex/linejs-types@3.5.0";
import {
  createSquareExtensionContext,
  LiveTalkBanManager,
  LiveTalkManager,
  SquareNotInitializedError,
  SquareThreadExtension,
  SquareValidationError,
} from "../mod.ts";

const sampleLiveTalk = {
  squareChatMid: "c123",
  sessionId: "s123",
  title: "Initial Title",
  type: "PUBLIC" as const,
  speakerSetting: "APPROVAL" as const,
  allowRequestToSpeak: false,
  hostMemberMid: "uHost",
  announcement: "",
  participantCount: 1,
  revision: 1,
  startedAt: 1700000000,
};

function createMockClient(options?: {
  onKickOut?: (
    req: KickOutLiveTalkParticipantsRequest,
  ) => Promise<KickOutLiveTalkParticipantsResponse> | KickOutLiveTalkParticipantsResponse;
  fetchEventsQueue?: Array<{
    events: LiveTalkEvent[];
    syncToken?: string;
    hasMore?: boolean;
  }>;
}) {
  const listeners = new Map<string, Set<(ev: SquareEvent) => void>>();
  let fetchIndex = 0;

  const client = {
    on(event: "square:event", fn: (ev: SquareEvent) => void) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(fn);
    },
    off(event: "square:event", fn: (ev: SquareEvent) => void) {
      listeners.get(event)?.delete(fn);
    },
    emit(event: "square:event", payload: SquareEvent) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of Array.from(set)) {
        fn(payload);
      }
    },
    base: {
      async getReqseq() {
        return 42;
      },
      livetalk: {
        async acceptSpeakers() {
          return {};
        },
        async rejectSpeakers() {
          return {};
        },
        async rejectToSpeak() {
          return {};
        },
        async requestToListen() {
          return {};
        },
        async requestToSpeak() {
          return {};
        },
        async updateLiveTalkAttrs() {
          return {};
        },
        async acquireLiveTalk() {
          return {
            liveTalk: { ...sampleLiveTalk },
          };
        },
        async joinLiveTalk(): Promise<JoinLiveTalkResponse> {
          return {
            hostMemberMid: "uHost",
            memberSessionId: "mSess1",
            speaker: false,
            token: "tok1",
            proto: "udp",
            voipAddress: "127.0.0.1",
            voipAddress6: "::1",
            voipUdpPort: 9000,
            voipTcpPort: 9001,
            fromZone: "jp",
            commParam: "",
            orionAddress: "127.0.0.1",
            polarisAddress: "127.0.0.1",
            polarisZone: "jp",
            polarisUdpPort: 9002,
          };
        },
        async fetchLiveTalkEvents() {
          const queue = options?.fetchEventsQueue;
          if (queue && fetchIndex < queue.length) {
            const current = queue[fetchIndex++];
            return {
              events: current.events,
              syncToken: current.syncToken ?? `token-${fetchIndex}`,
              hasMore: current.hasMore ?? false,
            };
          }
          return {
            events: [
              {
                type: "NOTIFIED_UPDATE_LIVE_TALK_TITLE" as const,
                revision: 2,
                payload: {
                  notifiedUpdateLiveTalkTitle: {
                    title: "Updated Title",
                  },
                },
              } as unknown as LiveTalkEvent,
            ],
            syncToken: "next-token",
            hasMore: false,
          };
        },
        async inviteToLiveTalk() {
          return {};
        },
        async kickOutLiveTalkParticipants(
          param: { request: KickOutLiveTalkParticipantsRequest },
        ): Promise<KickOutLiveTalkParticipantsResponse> {
          if (options?.onKickOut) {
            return await options.onKickOut(param.request);
          }
          return {};
        },
        async forceEndLiveTalk() {
          return {};
        },
        async getLiveTalkInfoForNonMember(): Promise<GetLiveTalkInfoForNonMemberResponse> {
          return {
            chatName: "Test Chat",
            chatImageObsHash: "",
            liveTalk: { ...sampleLiveTalk },
            speakers: [],
            chatInvitationTicket: "",
          };
        },
        async getLiveTalkInvitationUrl() {
          return { invitationUrl: "https://example.com/invite" };
        },
        async getLiveTalkSpeakersForNonMember() {
          return { speakers: [] };
        },
        async findLiveTalkByInvitationTicket(): Promise<FindLiveTalkByInvitationTicketResponse> {
          return {
            chatInvitationTicket: "ticket-1",
            liveTalk: { ...sampleLiveTalk },
            chat: {},
            squareMember: {},
          } as unknown as FindLiveTalkByInvitationTicketResponse;
        },
        async reportLiveTalk() {
          return {};
        },
        async reportLiveTalkSpeaker() {
          return {};
        },
      },
      square: {
        async fetchSquareChatEvents(): Promise<FetchSquareChatEventsResponse> {
          return {
            subscription: {
              subscriptionId: 1,
              ttlMillis: 60000,
            },
            events: [],
            syncToken: "sq-sync-1",
            continuationToken: "",
          };
        },
        async getSquareThread(): Promise<GetSquareThreadResponse> {
          return {
            squareThread: {
              threadMid: "t123",
              chatMid: "c123",
              squareMid: "m123",
              messageId: "msg1",
              state: "ALIVE" as const,
              expiresAt: 0,
              readOnlyAt: 0,
              revision: 1,
            },
            myThreadMember: {
              squareMemberMid: "mem1",
              threadMid: "t123",
              chatMid: "c123",
              revision: 1,
              membershipState: "JOINED" as const,
            },
            rootMessage: {
              message: "root",
              fromType: "USER" as const,
              squareMessageRevision: 1,
              state: "NORMAL" as const,
              threadInfo: { chatThreadMid: "t123" },
            },
          } as unknown as GetSquareThreadResponse;
        },
        async getSquareThreadMid() {
          return { threadMid: "t123" };
        },
        async joinSquareThread() {
          return {
            threadMember: {
              squareMemberMid: "mem1",
              threadMid: "t123",
              chatMid: "c123",
              revision: 2,
              membershipState: "JOINED" as const,
            },
          };
        },
        async leaveSquareThread() {
          return {
            threadMember: {
              squareMemberMid: "mem1",
              threadMid: "t123",
              chatMid: "c123",
              revision: 3,
              membershipState: "LEFT" as const,
            },
          };
        },
        async markThreadsAsRead() {
          return {};
        },
        async sendSquareThreadMessage(): Promise<SendSquareThreadMessageResponse> {
          return {
            createdThreadMessage: {
              message: "hello",
              fromType: "USER" as const,
              squareMessageRevision: 1,
              state: "NORMAL" as const,
              threadInfo: { chatThreadMid: "t123" },
            },
          } as unknown as SendSquareThreadMessageResponse;
        },
      },
    },
  };

  return client;
}

Deno.test("LiveTalkManager lifecycle, acquire, join, and fetchEvents", async () => {
  const client = createMockClient();
  const ctx = createSquareExtensionContext(client, { debug: false });
  const lt = new LiveTalkManager(ctx);

  assertThrows(
    () => lt.getLiveTalk("c123", "s123"),
    SquareNotInitializedError,
  );

  await lt.initialize();
  assertEquals(lt.isInitialized, true);

  await lt.acquire({ squareChatMid: "c123", sessionId: "s123" });
  assertEquals(lt.getLiveTalk("c123", "s123")?.title, "Initial Title");

  const joinRes = await lt.join({ squareChatMid: "c123", sessionId: "s123" });
  assertEquals(joinRes.memberSessionId, "mSess1");

  await assertRejects(
    () => lt.acceptSpeakers({ squareChatMid: "c123", sessionId: "s123", targetMids: [] }),
    SquareValidationError,
  );

  let receivedKind = "";
  lt.onEvent("title_updated", (ev) => {
    receivedKind = ev.kind;
  });

  const fetched = await lt.fetchEvents({ squareChatMid: "c123", sessionId: "s123" });
  assertEquals(fetched.events.length, 1);
  assertEquals(receivedKind, "title_updated");
  assertEquals(lt.getLiveTalk("c123", "s123")?.title, "Updated Title");

  await lt.dispose();
  assertEquals(lt.isInitialized, false);
});

Deno.test("SquareThreadExtension lifecycle, thread info, join/leave, and event filter", async () => {
  const client = createMockClient();
  const ctx = createSquareExtensionContext(client, { debug: false });
  const threadExt = new SquareThreadExtension(ctx);

  assertThrows(() => threadExt.getThread({ threadMid: "t123" }), SquareNotInitializedError);

  await threadExt.initialize();

  const info = await threadExt.getThread({ threadMid: "t123" });
  assertEquals(info.squareThread?.threadMid, "t123");

  const joined = await threadExt.joinThread({ chatMid: "c123", threadMid: "t123" });
  assertEquals(joined.threadMember?.membershipState, "JOINED");

  const left = await threadExt.leaveThread({ chatMid: "c123", threadMid: "t123" });
  assertEquals(left.threadMember?.membershipState, "LEFT");

  let matchedThreadMid: string | undefined;
  threadExt.onThreadEvent((_ev, meta) => {
    matchedThreadMid = meta.threadMid;
  });

  await threadExt.startMonitoring({ threadMid: "t123" });
  client.emit("square:event", {
    type: "NOTIFICATION_THREAD_MESSAGE",
    payload: {
      notificationThreadMessage: {
        squareMessage: {
          threadInfo: { chatThreadMid: "t123" },
        },
      },
    },
  } as unknown as SquareEvent);
  assertEquals(matchedThreadMid, "t123");

  await threadExt.dispose();
});

Deno.test("LiveTalkBanManager ban/unban, kickAndBan, auto enforce, and JSON persistence", async () => {
  const kickedTargets: KickOutLiveTalkParticipantsRequest[] = [];
  const client = createMockClient({
    onKickOut: (req) => {
      kickedTargets.push(req);
      return {};
    },
    fetchEventsQueue: [
      {
        events: [
          {
            type: "NOTIFIED_UPDATE_LIVE_TALK_TITLE",
            revision: 3,
            payload: {
              notifiedUpdateLiveTalkTitle: {
                title: "Room",
              },
              extra: {
                memberMid: "uBad2",
              },
            },
          } as unknown as LiveTalkEvent,
        ],
      },
    ],
  });

  const ctx = createSquareExtensionContext(client, { debug: false });
  const lt = new LiveTalkManager(ctx);
  await lt.initialize();

  const banManager = new LiveTalkBanManager(lt);

  const entry = banManager.ban("uBad1", { reason: "spam", squareChatMid: "c123" });
  assertEquals(entry.memberMid, "uBad1");
  assertEquals(banManager.isBanned("uBad1"), true);
  assertEquals(banManager.listBans().length, 1);

  assertEquals(banManager.unban("uBad1"), true);
  assertEquals(banManager.isBanned("uBad1"), false);

  await banManager.kickAndBan({
    squareChatMid: "c123",
    sessionId: "s123",
    memberMid: "uBad2",
    reason: "harassment",
  });
  assertEquals(banManager.isBanned("uBad2"), true);
  assertEquals(kickedTargets.length, 1);
  assertEquals(kickedTargets[0].squareChatMid, "c123");
  assertEquals(kickedTargets[0].sessionId, "s123");

  const enforcedMids: string[] = [];
  const detach = banManager.attachAutoEnforce({
    squareChatMid: "c123",
    sessionId: "s123",
    onEnforced: (info: { memberMid: string }) => enforcedMids.push(info.memberMid),
  });

  await lt.fetchEvents({ squareChatMid: "c123", sessionId: "s123" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assertEquals(enforcedMids, ["uBad2"]);
  assertEquals(kickedTargets.length, 2);

  detach();

  const tempJson = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await banManager.saveToFile(tempJson);

    const restored = new LiveTalkBanManager(lt);
    const loadedCount = await restored.loadFromFile(tempJson);
    assertEquals(loadedCount, 1);
    assertEquals(restored.isBanned("uBad2"), true);
    assertEquals(restored.getBan("uBad2")?.reason, "harassment");
  } finally {
    await Deno.remove(tempJson).catch(() => {});
    await lt.dispose();
  }
});


Deno.test("LiveTalkBanManager TTL expiration and autoSaveFilePath", async () => {
  const client = createMockClient();
  const ctx = createSquareExtensionContext(client, { debug: false });
  const lt = new LiveTalkManager(ctx);
  await lt.initialize();

  const tempJson = await Deno.makeTempFile({ suffix: ".json" });
  try {
    const banManager = new LiveTalkBanManager(lt, {
      autoSaveFilePath: tempJson,
    });

    // 期限切れ（過去の expiresAt）の BAN は即座に有効期限切れ扱いになる
    banManager.ban("uExpired", { reason: "temp", expiresAt: Date.now() - 1000 });
    assertEquals(banManager.isBanned("uExpired"), false);

    // 有効な TTL 付き BAN は登録直後は有効
    banManager.ban("uTemp", { reason: "mute-test", ttlMs: 60_000 });
    assertEquals(banManager.isBanned("uTemp"), true);
    await banManager.flushAutoSave();

    const savedText = await Deno.readTextFile(tempJson);
    const savedList = JSON.parse(savedText) as Array<{ memberMid: string }>;
    assertEquals(savedList.map((x) => x.memberMid), ["uTemp"]);

    // unban 時も自動保存される
    assertEquals(banManager.unban("uTemp"), true);
    await banManager.flushAutoSave();
    const afterUnban = JSON.parse(await Deno.readTextFile(tempJson)) as Array<{ memberMid: string }>;
    assertEquals(afterUnban.length, 0);
  } finally {
    await Deno.remove(tempJson).catch(() => {});
    await lt.dispose();
  }
});
