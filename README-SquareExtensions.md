$proj = "C:\Users\admin\OneDrive\デスクトップ\SquareExtensions\SquareExtensions"; $readme = "$proj\README.md"; @'
# SquareExtensions

`@evex/linejs` 向けの LiveTalk 管理・出禁（BAN）制御および Square Thread 拡張モジュール群です。

## 主なモジュール

- **`LiveTalkManager`**: LiveTalk セッションの取得（`acquire`）、参加（`join`）、イベント取得・購読（`fetchEvents` / `onEvent` / `onAnyEvent`）、参加者キック（`kickOutParticipants`）などのライフサイクル管理。
- **`LiveTalkBanManager`**: BAN リスト管理、期限付き BAN（`ttlMs` / `expiresAt`）、JSON 永続化・自動保存（`saveToFile` / `loadFromFile` / `autoSaveFilePath`）、およびイベント検知時の自動キック（`attachAutoEnforce`）。
- **`SquareThreadExtension`**: Square スレッド情報の取得、参加・退出、スレッド単位のイベントフィルタリングと監視。

## LiveTalk 出禁管理・自動キック（`LiveTalkBanManager`）

### 基本的な使い方（BAN登録・解除・キック＆BAN・自動キック）

```ts
import {
  createSquareExtensionContext,
  LiveTalkBanManager,
  LiveTalkManager,
} from "./mod.ts";

const ctx = createSquareExtensionContext(client, { debug: false });
const liveTalk = new LiveTalkManager(ctx);
await liveTalk.initialize();

const banManager = new LiveTalkBanManager(liveTalk, {
  autoSaveFilePath: "./livetalk-bans.json",
  onPersistError: (err) => console.error("BANリスト自動保存エラー:", err),
});

// 既存JSONからBANリストを読み込み（期限切れは自動除外）
await banManager.loadFromFile("./livetalk-bans.json").catch(() => 0);

// 1. 事前BAN登録（1時間有効の例。ttlMs / expiresAt を省略すると無期限）
banManager.ban("uTargetMid1", {
  reason: "迷惑行為",
  squareChatMid: "cSquareChatMid",
  ttlMs: 60 * 60 * 1000,
});

// 2. 即時キック＋BAN登録
await banManager.kickAndBan({
  squareChatMid: "cSquareChatMid",
  sessionId: "sLiveTalkSessionId",
  memberMid: "uTargetMid2",
  reason: "荒らし行為",
});

// 3. イベント検知時の自動キックを開始（解除は戻り値の関数を呼び出し）
const detachAutoEnforce = banManager.attachAutoEnforce({
  squareChatMid: "cSquareChatMid",
  sessionId: "sLiveTalkSessionId",
  onEnforced: ({ memberMid }) => {
    console.log(`BAN対象ユーザーを自動キックしました: ${memberMid}`);
  },
  onError: (err) => {
    console.error("自動キック失敗:", err);
  },
});

// BAN解除・一覧・期限切れ整理・手動保存
banManager.unban("uTargetMid1");
banManager.pruneExpired();
console.log("現在のBAN一覧:", banManager.listBans());
await banManager.saveToFile("./livetalk-bans.json");

// 終了時クリーンアップ
detachAutoEnforce();
await banManager.flushAutoSave();
await liveTalk.dispose();