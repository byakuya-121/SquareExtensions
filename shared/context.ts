import type { SquareExtensionOptions } from "./types.ts";

/**
 * LINEJS Clientを拡張機能間で共有するためのコンテキスト
 */
export interface SquareExtensionContext<TClient> {
  readonly client: TClient;
  readonly options: SquareExtensionOptions;
}

export function createSquareExtensionContext<TClient>(
  client: TClient,
  options: SquareExtensionOptions = {},
): SquareExtensionContext<TClient> {
  return Object.freeze({
    client,
    options,
  });
}
