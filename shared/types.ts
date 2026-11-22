/**
 * SquareExtensions 共通型定義
 */

export type SquareFeature = "live-talk" | "thread";

export interface SquareExtensionOptions {
  debug?: boolean;
  logger?: (level: LogLevel, message: string, detail?: unknown) => void;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface SquareOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SquareExtensionEvent<T = unknown> {
  feature: SquareFeature;
  eventName: string;
  timestamp: number;
  data: T;
}

export interface SquareMemberInfo {
  mid: string;
  displayName?: string;
  revision?: number;
}

export interface SquareChatInfo {
  chatMid: string;
  squareMid?: string;
}

export interface SquareExtension {
  readonly name: SquareFeature;
  readonly version: string;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}
