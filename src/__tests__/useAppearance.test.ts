/**
 * useAppearance (外観: 自動/ライト/ダーク) の検証。
 * <html> の dark クラスと colorScheme、auto 時の OS 追従、キャッシュ書き込みを pin する。
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPEARANCE_CACHE_KEY, type Appearance } from "../lib/appearance-boot";
import { useAppearance } from "../hooks/useAppearance";

type Listener = (e: { matches: boolean }) => void;

function fakeMql(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    fire(next: boolean) {
      mql.matches = next;
      for (const cb of listeners) cb({ matches: next });
    },
  };
  return mql;
}

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root().classList.remove("dark");
  root().style.colorScheme = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  root().classList.remove("dark");
});

describe("useAppearance", () => {
  it("dark 指定で dark クラスと colorScheme を強制適用する", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => fakeMql(false)));
    renderHook(() => useAppearance("dark"));
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().style.colorScheme).toBe("dark");
  });

  it("light 指定は OS がダークでもライトに固定する", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => fakeMql(true)));
    renderHook(() => useAppearance("light"));
    expect(root().classList.contains("dark")).toBe(false);
    expect(root().style.colorScheme).toBe("light");
  });

  it("auto は OS 外観に追従し、変更イベントにも反応する", () => {
    const mql = fakeMql(false);
    vi.stubGlobal("matchMedia", vi.fn(() => mql));
    renderHook(() => useAppearance("auto"));
    expect(root().classList.contains("dark")).toBe(false);
    act(() => mql.fire(true));
    expect(root().classList.contains("dark")).toBe(true);
    act(() => mql.fire(false));
    expect(root().classList.contains("dark")).toBe(false);
  });

  it("設定値を localStorage にキャッシュする (起動時ちらつき防止用)", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => fakeMql(false)));
    renderHook(() => useAppearance("dark"));
    expect(localStorage.getItem(APPEARANCE_CACHE_KEY)).toBe("dark");
  });

  it("dark → light の切替でクラスが外れる", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => fakeMql(false)));
    const { rerender } = renderHook((props: { a: Appearance }) => useAppearance(props.a), {
      initialProps: { a: "dark" as Appearance },
    });
    expect(root().classList.contains("dark")).toBe(true);
    rerender({ a: "light" });
    expect(root().classList.contains("dark")).toBe(false);
  });
});
