/**
 * useTauriMenubar (メニューバー常駐挙動) の検証。
 * jsdom では実フォーカスイベントが起きないため、onFocusChanged のコールバックを
 * 直接発火して pin する。特に「OAuth 連携中 (connecting) は blur で隠さない」は
 * 誤送 hide が起きると連携が必ず失敗する重要ガード。
 */

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

const hide = vi.fn().mockResolvedValue(undefined);
let focusHandler: ((event: { payload: boolean }) => void) | undefined;
const onFocusChanged = vi.fn(
  async (cb: (event: { payload: boolean }) => void): Promise<() => void> => {
    focusHandler = cb;
    return () => {
      focusHandler = undefined;
    };
  },
);
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide, onFocusChanged }),
}));

import { useTauriMenubar } from "../hooks/useTauriMenubar";

async function renderMenubar(connecting: boolean, onFocus = vi.fn()) {
  const utils = renderHook(
    (props: { connecting: boolean; onFocus: () => void }) => useTauriMenubar(props),
    { initialProps: { connecting, onFocus } },
  );
  await waitFor(() => expect(onFocusChanged).toHaveBeenCalled());
  return { ...utils, onFocus };
}

beforeEach(() => {
  vi.clearAllMocks();
  focusHandler = undefined;
});

describe("useTauriMenubar", () => {
  it("Escape キーでウィンドウを隠す", async () => {
    await renderMenubar(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await waitFor(() => expect(hide).toHaveBeenCalled());
  });

  it("フォーカス取得で onFocus を呼ぶ (hide しない)", async () => {
    const { onFocus } = await renderMenubar(false);
    act(() => focusHandler!({ payload: true }));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
  });

  it("フォーカス喪失 (非連携中) でウィンドウを隠す", async () => {
    await renderMenubar(false);
    act(() => focusHandler!({ payload: false }));
    await waitFor(() => expect(hide).toHaveBeenCalled());
  });

  it("OAuth 連携中はフォーカス喪失でも隠さない", async () => {
    await renderMenubar(true);
    act(() => focusHandler!({ payload: false }));
    // 非同期 hide が仮に走るなら拾えるよう1tick待ってから確認
    await new Promise((r) => setTimeout(r, 10));
    expect(hide).not.toHaveBeenCalled();
  });

  it("connecting が true → false に変わったら blur で隠すようになる", async () => {
    const onFocus = vi.fn();
    const { rerender } = await renderMenubar(true, onFocus);
    rerender({ connecting: false, onFocus });
    act(() => focusHandler!({ payload: false }));
    await waitFor(() => expect(hide).toHaveBeenCalled());
  });
});
