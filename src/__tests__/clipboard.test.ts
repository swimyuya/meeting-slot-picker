import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../lib/clipboard";

describe("copyText", () => {
  afterEach(() => {
    // @ts-expect-error テスト後にクリーンアップ
    delete navigator.clipboard;
  });

  it("非 Tauri 環境では navigator.clipboard.writeText に委譲する", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await copyText("5/23（水）10:00-11:00");
    expect(writeText).toHaveBeenCalledWith("5/23（水）10:00-11:00");
  });
});
