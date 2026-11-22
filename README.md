$proj = "C:\Users\admin\OneDrive\デスクトップ\SquareExtensions\SquareExtensions"; $json = @'
{
  "name": "@square-extensions/livetalk-ban",
  "version": "0.1.0",
  "license": "MIT",
  "exports": "./mod.ts",
  "tasks": {
    "check": "deno check mod.ts live-talk/LiveTalkBanManager.ts tests/square_extensions.test.ts",
    "test": "deno test --allow-read --allow-write --allow-env tests/square_extensions.test.ts"
  }
}
'@; [System.IO.File]::WriteAllText("$proj\deno.json", $json, [System.Text.UTF8Encoding]::new($false)); $md = @'
# SquareExtensions

`@evex/linejs` 向けの LiveTalk 管理・出禁（BAN）制御および Square Thread 拡張モジュール群です。

## 主なモジュール

- **`LiveTalkManager`**: LiveTalk セッションの取得（`acquire`）、参加（`join`）、イベント取得・購読（`fetchEvents` / `onEvent` / `onAnyEvent`）、参加者キック（`kickOutParticipants`）などのライフサイクル管理。
- **`LiveTalkBanManager`**: BAN リスト管理、期限付き BAN（`ttlMs` / `expiresAt`）、JSON 永続化・自動保存（`saveToFile` / `loadFromFile` / `autoSaveFilePath`）、およびイベント検知時の自動キック（`attachAutoEnforce`）。
- **`SquareThreadExtension`**: Square スレッド情報の取得、参加・退出、スレッド単位のイベントフィルタリングと監視。

## 使い方（`LiveTalkBanManager`）

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

await banManager.loadFromFile("./livetalk-bans.json").catch(() => 0);

// 事前BAN登録（1時間有効の例）
banManager.ban("uTargetMid1", {
  reason: "迷惑行為",
  squareChatMid: "cSquareChatMid",
  ttlMs: 60 * 60 * 1000,
});

// 即時キック＋BAN登録
await banManager.kickAndBan({
  squareChatMid: "cSquareChatMid",
  sessionId: "sLiveTalkSessionId",
  memberMid: "uTargetMid2",
  reason: "荒らし行為",
});

// イベント検知時の自動キック
const detachAutoEnforce = banManager.attachAutoEnforce({
  squareChatMid: "cSquareChatMid",
  sessionId: "sLiveTalkSessionId",
  onEnforced: ({ memberMid }) => {
    console.log(`BAN対象ユーザーを自動キックしました: ${memberMid}`);
  },
});

// クリーンアップ
detachAutoEnforce();
await banManager.flushAutoSave();
await liveTalk.dispose();
