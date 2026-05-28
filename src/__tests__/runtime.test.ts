/**
 * isTauri / isExtension / isWebRuntime の検出ロジック検証。
 * 各形態を vi.stubGlobal で偽装する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isExtension, isTauri, isWebRuntime } from "../lib/tauri";

beforeEach(() => {
  // jsdom 既定: chrome も __TAURI_INTERNALS__ も無い (= Web ランタイム)
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isExtension", () => {
  it("chrome.runtime.id が無ければ false", () => {
    expect(isExtension()).toBe(false);
  });

  it("chrome.runtime.id があれば true", () => {
    vi.stubGlobal("chrome", { runtime: { id: "abcd1234" } });
    expect(isExtension()).toBe(true);
  });
});

describe("isTauri", () => {
  it("__TAURI_INTERNALS__ が無ければ false", () => {
    expect(isTauri()).toBe(false);
  });

  it("__TAURI_INTERNALS__ があれば true", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });
    try {
      expect(isTauri()).toBe(true);
    } finally {
      delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }
  });
});

describe("isWebRuntime", () => {
  it("Tauri でも Extension でもなければ true", () => {
    expect(isWebRuntime()).toBe(true);
  });

  it("Extension なら false", () => {
    vi.stubGlobal("chrome", { runtime: { id: "abcd1234" } });
    expect(isWebRuntime()).toBe(false);
  });
});
