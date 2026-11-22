/**
 * @evex/linejs Client と SquareExtensions の統合利用サンプル
 * 実行時は環境に合わせてログイン処理・対象 MID を設定してください。
 */

import { Client } from "jsr:@evex/linejs@3.4.2";
import { BaseClient } from "jsr:@evex/linejs@3.4.2/base";
import type { ClientInit } from "jsr:@evex/linejs@3.4.2/base";
import {
  createSquareExtensionContext,
  LiveTalkManager,
  SquareExtensionError,
  SquareThreadExtension,
} from "../mod.ts";

async function main() {
  const base = new BaseClient({} as ClientInit);
  const client = new Client(base);

  const ctx = createSquareExtensionContext(client, {
    debug: true,
  });

  const liveTalk = new LiveTalkManager(ctx, {
    defaultEventLimit: 50,
    pollIntervalMs: 3000,
  });

  const thread = new SquareThreadExtension(ctx, {
    defaultFetchLimit: 100,
  });

  await liveTalk.initialize();
  await thread.initialize();

  const unsubTitle = liveTalk.onEvent("title_updated", (ev) => {
    console.info("[LiveTalk] タイトル更新:", ev.payload);
  });

  const unsubThread = thread.onThreadEvent((ev, meta) => {
    console.info("[Thread] イベント受信:", {
      threadMid: meta.threadMid,
      type: ev.type,
    });
  });

  await thread.startMonitoring({});

  try {
    console.info("SquareExtensions 初期化完了:", {
      liveTalkInitialized: liveTalk.isInitialized,
      threadInitialized: thread.isInitialized,
    });
  } catch (err) {
    if (err instanceof SquareExtensionError) {
      console.error(`[${err.feature}/${err.code}] ${err.message}`, err.detail);
    } else {
      throw err;
    }
  } finally {
    unsubTitle();
    unsubThread();
    await thread.dispose();
    await liveTalk.dispose();
  }
}

if (import.meta.main) {
  await main();
}
