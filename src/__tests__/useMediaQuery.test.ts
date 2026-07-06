/**
 * useMediaQuery の検証。jsdom の matchMedia は制御できないため、
 * リスナー発火可能なフェイク MQL を差し込んで購読/解除/フォールバックを pin する。
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "../hooks/useMediaQuery";

type Listener = (e: { matches: boolean }) => void;

function createMql(initial: boolean, opts: { legacy?: boolean } = {}) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: opts.legacy
      ? undefined
      : (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: opts.legacy
      ? undefined
      : (_: string, cb: Listener) => listeners.delete(cb),
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    fire(next: boolean) {
      mql.matches = next;
      for (const cb of listeners) cb({ matches: next });
    },
    listenerCount: () => listeners.size,
  };
  return mql;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("初期値は matchMedia(query).matches を返す", () => {
    const mql = createMql(true);
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("change イベントで値が更新される", () => {
    const mql = createMql(false);
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(false);
    act(() => mql.fire(true));
    expect(result.current).toBe(true);
  });

  it("unmount でリスナーを解除する", () => {
    const mql = createMql(false);
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(mql.listenerCount()).toBe(1);
    unmount();
    expect(mql.listenerCount()).toBe(0);
  });

  it("addEventListener 非対応 (旧 Safari) は addListener にフォールバックする", () => {
    const mql = createMql(false, { legacy: true });
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    const { result, unmount } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(mql.listenerCount()).toBe(1);
    act(() => mql.fire(true));
    expect(result.current).toBe(true);
    unmount();
    expect(mql.listenerCount()).toBe(0);
  });
});
