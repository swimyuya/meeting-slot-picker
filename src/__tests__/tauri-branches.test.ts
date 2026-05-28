/** Tauri ランタイム分岐 (isTauri()=true) を、プラグインをモックして検証する。 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const writeText = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText }));

const pluginFetch = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: pluginFetch }));

afterEach(() => vi.clearAllMocks());

describe("Tauri 分岐", () => {
  it("secrets は invoke 経由で Keychain コマンドを呼ぶ", async () => {
    const { getSecret, setSecret, deleteSecret } = await import("../lib/secrets");
    await setSecret("k", "v");
    expect(invoke).toHaveBeenCalledWith("secret_set", { key: "k", value: "v" });
    invoke.mockResolvedValueOnce("stored");
    expect(await getSecret("k")).toBe("stored");
    await deleteSecret("k");
    expect(invoke).toHaveBeenCalledWith("secret_delete", { key: "k" });
  });

  it("clipboard は plugin-clipboard-manager.writeText を呼ぶ", async () => {
    const { copyText } = await import("../lib/clipboard");
    await copyText("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("httpFetch は plugin-http の fetch を呼ぶ", async () => {
    const { httpFetch } = await import("../lib/http");
    const res = new Response("ok");
    pluginFetch.mockResolvedValue(res);
    const out = await httpFetch("https://example.com");
    expect(pluginFetch).toHaveBeenCalledWith("https://example.com", undefined);
    expect(out).toBe(res);
  });
});
