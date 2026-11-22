/**
 * SquareExtensions 共通ユーティリティ
 */

import { SquareValidationError } from "./errors.ts";
import type {
  LogLevel,
  SquareFeature,
  SquareExtensionOptions,
} from "./types.ts";

export function requireString(
  value: unknown,
  fieldName: string,
  feature: SquareFeature,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SquareValidationError(
      feature,
      `${fieldName} must be a non-empty string.`,
      { fieldName, value },
    );
  }

  return value;
}

export function requirePositiveInteger(
  value: unknown,
  fieldName: string,
  feature: SquareFeature,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new SquareValidationError(
      feature,
      `${fieldName} must be a positive integer.`,
      { fieldName, value },
    );
  }

  return value;
}

export function log(
  options: SquareExtensionOptions,
  level: LogLevel,
  message: string,
  detail?: unknown,
): void {
  if (level === "debug" && !options.debug) return;

  if (options.logger) {
    options.logger(level, message, detail);
    return;
  }

  const prefix = `[SquareExtensions][${level.toUpperCase()}]`;

  switch (level) {
    case "debug":
      console.debug(prefix, message, detail ?? "");
      break;
    case "info":
      console.info(prefix, message, detail ?? "");
      break;
    case "warn":
      console.warn(prefix, message, detail ?? "");
      break;
    case "error":
      console.error(prefix, message, detail ?? "");
      break;
  }
}

export function getTimestamp(): number {
  return Date.now();
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred.";
}
