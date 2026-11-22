import type {
  SquareExtension,
  SquareExtensionOptions,
} from "./types.ts";

import type { SquareExtensionContext } from "./context.ts";

import {
  log,
} from "./utils.ts";

import {
  SquareNotInitializedError,
} from "./errors.ts";

/**
 * SquareExtensions 共通基底クラス
 */
export abstract class SquareExtensionBase<TClient>
  implements SquareExtension {

  abstract readonly name: SquareExtension["name"];
  abstract readonly version: string;

  protected readonly client: TClient;
  protected readonly options: SquareExtensionOptions;

  private initialized = false;

  constructor(context: SquareExtensionContext<TClient>) {
    this.client = context.client;
    this.options = context.options;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.onInitialize();

    this.initialized = true;

    log(
      this.options,
      "info",
      `${this.name} initialized.`,
    );
  }

  async dispose(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.onDispose();
    } finally {
      this.initialized = false;

      log(
        this.options,
        "info",
        `${this.name} disposed.`,
      );
    }
  }

  protected assertInitialized(): void {
    if (!this.initialized) {
      throw new SquareNotInitializedError(this.name);
    }
  }

  protected abstract onInitialize(): Promise<void>;

  protected abstract onDispose(): Promise<void>;
}
