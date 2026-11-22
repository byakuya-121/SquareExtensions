# SquareExtensions

`@evex/linejs` 向けの LiveTalk 管理・BAN 制御および Square Thread 拡張モジュール群です。

## 主な機能・モジュール

- **`LiveTalkManager`**: LiveTalk セッションの取得・参加、イベントの取得と購読、参加者のキックなどライフサイクル全般を管理します。
- **`LiveTalkBanManager`**:
  - BAN リストの登録・解除・参照
  - 有効期限（`ttlMs` / `expiresAt`）付き BAN の管理と期限切れの自動扱い
  - JSON ファイルへの永続化および永続化キューによる自動保存（`saveToFile` / `loadFromFile` / `autoSaveFilePath`）
  - イベント検知と連動した自動キック（`attachAutoEnforce`）および即時キック＆BAN（`kickAndBan`）
- **`SquareThreadExtension`**: Square スレッド情報の取得、参加・退出、スレッド単位のイベントフィルタリングと監視を提供します。

## インストール（JSR / Deno）

JSR から `@square-extensions/livetalk-ban` を利用できます（またはローカルリポジトリから直接インポートします）。

```ts
import {
  createSquareExtensionContext,
  LiveTalkBanManager,
  LiveTalkManager,
} from "jsr:@square-extensions/livetalk-ban";
```

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

// 既存のBANリストを読み込み（存在しない場合は0件として続行）
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

// イベント検知時の自動キックを有効化
const detachAutoEnforce = banManager.attachAutoEnforce({
  squareChatMid: "cSquareChatMid",
  sessionId: "sLiveTalkSessionId",
  onEnforced: ({ memberMid }) => {
    console.log(`BAN対象ユーザーを自動キックしました: ${memberMid}`);
  },
});

// 終了時のクリーンアップ
detachAutoEnforce();
await banManager.flushAutoSave();
await liveTalk.dispose();
```

## 開発・テスト

```bash
deno task check
deno task test
```

## ライセンス

MIT License（詳細は `LICENSE` を参照）
