/**
 * useShortcut (グローバルショートカット動的登録) の検証。
 * plugin-global-shortcut / invoke をモックし、登録・重複解除・押下時の
 * toggle_window 呼び出し・spec 変更時の付け替え・エラー表面化を pin する。
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

const isRegistered = vi.fn(async (_spec: string) => false);
const register = vi.fn(
  async (_spec: string, _cb: (event: { state: string }) => void) => undefined,
);
const unregister = vi.fn(async (_spec: string) => undefined);
vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  isRegistered: (spec: string) => isRegistered(spec),
  register: (spec: string, cb: (event: { state: string }) => void) => register(spec, cb),
  unregister: (spec: string) => unregister(spec),
}));

const invoke = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

import { useShortcut } from "../hooks/useShortcut";

beforeEach(() => {
  vi.clearAllMocks();
  isRegistered.mockResolvedValue(false);
});

describe("useShortcut", () => {
  it("spec を register し、押下 (Pressed) で toggle_window を invoke する", async () => {
    const { result } = renderHook(() => useShortcut("CmdOrControl+Shift+U"));
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("CmdOrControl+Shift+U", expect.any(Function)),
    );
    expect(result.current.error).toBeNull();

    const handler = register.mock.calls[0][1];
    handler({ state: "Pressed" });
    expect(invoke).toHaveBeenCalledWith("toggle_window");
    invoke.mockClear();
    handler({ state: "Released" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("登録済みなら一度 unregister してから register する (重複防止)", async () => {
    isRegistered.mockResolvedValue(true);
    renderHook(() => useShortcut("Control+Shift+KeyU"));
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(unregister).toHaveBeenCalledWith("Control+Shift+KeyU");
    expect(unregister.mock.invocationCallOrder[0]).toBeLessThan(
      register.mock.invocationCallOrder[0],
    );
  });

  it("spec 変更で旧 spec を unregister し新 spec を register する", async () => {
    const { rerender } = renderHook(({ spec }) => useShortcut(spec), {
      initialProps: { spec: "Control+Shift+KeyU" },
    });
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("Control+Shift+KeyU", expect.any(Function)),
    );

    rerender({ spec: "Alt+Shift+KeyP" });
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("Alt+Shift+KeyP", expect.any(Function)),
    );
    expect(unregister).toHaveBeenCalledWith("Control+Shift+KeyU");
  });

  it("unmount で unregister する", async () => {
    const { unmount } = renderHook(() => useShortcut("Control+Shift+KeyU"));
    await waitFor(() => expect(register).toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(unregister).toHaveBeenCalledWith("Control+Shift+KeyU"));
  });

  it("register 失敗はエラーとして表面化する", async () => {
    register.mockRejectedValueOnce(new Error("shortcut conflict"));
    const { result } = renderHook(() => useShortcut("Control+Shift+KeyU"));
    await waitFor(() => expect(result.current.error).toBe("shortcut conflict"));
  });

  it("spec が空なら何も登録しない", async () => {
    const { result } = renderHook(() => useShortcut(""));
    await new Promise((r) => setTimeout(r, 10));
    expect(register).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
