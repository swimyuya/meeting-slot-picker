import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useConfig } from "../hooks/useConfig";
import { DEFAULT_CONFIG, loadConfig } from "../lib/config";

beforeEach(() => localStorage.clear());

describe("useConfig", () => {
  it("既定値を読み込む", async () => {
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it("update で状態を更新し永続化する", async () => {
    const { result } = renderHook(() => useConfig());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.update({ ...DEFAULT_CONFIG, startHour: 7 });
    });
    expect(result.current.config.startHour).toBe(7);
    expect((await loadConfig()).startHour).toBe(7);
  });
});
