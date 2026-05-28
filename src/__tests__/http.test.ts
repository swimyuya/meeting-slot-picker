import { afterEach, describe, expect, it, vi } from "vitest";
import { httpFetch } from "../lib/http";

afterEach(() => vi.restoreAllMocks());

describe("httpFetch", () => {
  it("非 Tauri 環境では globalThis.fetch に委譲する", async () => {
    const res = new Response("ok");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res);
    const out = await httpFetch("https://example.com", { method: "GET" });
    expect(spy).toHaveBeenCalledWith("https://example.com", { method: "GET" });
    expect(out).toBe(res);
  });
});
