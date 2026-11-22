/**
 * SquareExtensions エラー管理
 */

import type { SquareFeature } from "./types.ts";

export class SquareExtensionError extends Error {
  readonly feature: SquareFeature;
  readonly code: string;
  readonly detail?: unknown;

  constructor(
    feature: SquareFeature,
    code: string,
    message: string,
    detail?: unknown,
  ) {
    super(message);
    this.name = "SquareExtensionError";
    this.feature = feature;
    this.code = code;
    this.detail = detail;
  }
}

export class SquareApiError extends SquareExtensionError {
  constructor(feature: SquareFeature, message: string, detail?: unknown) {
    super(feature, "API_ERROR", message, detail);
    this.name = "SquareApiError";
  }
}

export class SquareValidationError extends SquareExtensionError {
  constructor(feature: SquareFeature, message: string, detail?: unknown) {
    super(feature, "VALIDATION_ERROR", message, detail);
    this.name = "SquareValidationError";
  }
}

export class SquareNotInitializedError extends SquareExtensionError {
  constructor(feature: SquareFeature) {
    super(feature, "NOT_INITIALIZED", `${feature} has not been initialized.`);
    this.name = "SquareNotInitializedError";
  }
}
