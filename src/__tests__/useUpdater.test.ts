/**
 * useUpdater (Tauri 自動アップデート) の検証。
 * plugin-updater / plugin-process をモックし、起動 3 秒後のチェック・
 * applyUpdate の download+relaunch・エラー表面化・dismiss を pin する。
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

const check = vi.fn();
vi.mock("@tauri-apps/plugin-updater", () => ({ check: () => check() }));

const relaunch = vi.fn(async () => undefined);
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: () => relaunch() }));

import { useUpdater } from "../hooks/useUpdater";

beforeEach(() => {
  vi.clearAllMocks();
  check.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useUpdater (起動時チェック)", () => {
  it("起動 3 秒後に check し、新版があれば available に保持する", async () => {
    vi.useFakeTimers();
    check.mockResolvedValue({ available: true, version: "0.2.0", body: "notes" });
    const { result } = renderHook(() => useUpdater());
    expect(result.current.available).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(result.current.available).toEqual({ version: "0.2.0", body: "notes" });
  });

  it("新版が無ければ available は null のまま", async () => {
    vi.useFakeTimers();
    check.mockResolvedValue({ available: false });
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(result.current.available).toBeNull();
  });

  it("チェック失敗はエラーとして表面化する", async () => {
    vi.useFakeTimers();
    check.mockRejectedValue(new Error("updater endpoint 404"));
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(result.current.error).toBe("updater endpoint 404");
  });
});

describe("useUpdater (applyUpdate / dismiss)", () => {
  it("applyUpdate は downloadAndInstall → relaunch を実行する", async () => {
    const downloadAndInstall = vi.fn(async () => undefined);
    check.mockResolvedValue({ available: true, version: "0.2.0", downloadAndInstall });
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.applyUpdate();
    });
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it("applyUpdate 時に新版が消えていたら available を null に戻す", async () => {
    check.mockResolvedValue(null);
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.applyUpdate();
    });
    expect(relaunch).not.toHaveBeenCalled();
    expect(result.current.available).toBeNull();
  });

  it("applyUpdate 失敗はエラー表面化し busy を解除する", async () => {
    check.mockRejectedValue(new Error("download failed"));
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.applyUpdate();
    });
    await waitFor(() => expect(result.current.error).toBe("download failed"));
    expect(result.current.busy).toBe(false);
  });

  it("dismiss で available を消す", async () => {
    vi.useFakeTimers();
    check.mockResolvedValue({ available: true, version: "0.2.0" });
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(result.current.available).not.toBeNull();
    act(() => result.current.dismiss());
    expect(result.current.available).toBeNull();
  });
});
