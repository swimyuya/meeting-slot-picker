import { describe, expect, it } from "vitest";
import {
  deleteRefreshToken,
  deleteSecret,
  getFirstConnectedAt,
  getRefreshToken,
  getSecret,
  getUserEmail,
  setFirstConnectedAtIfMissing,
  setRefreshToken,
  setSecret,
  setUserEmail,
} from "../lib/secrets";

// IndexedDB クリアは setup.ts の global beforeEach に集約

describe("secrets (IndexedDB) — provider-aware", () => {
  it("未保存なら null を返す", async () => {
    expect(await getSecret("k")).toBeNull();
  });

  it("set した値を get できる", async () => {
    await setSecret("k", "v");
    expect(await getSecret("k")).toBe("v");
  });

  it("delete で消える", async () => {
    await setSecret("k", "v");
    await deleteSecret("k");
    expect(await getSecret("k")).toBeNull();
  });

  it("Google / Microsoft の refresh_token は独立に保存される", async () => {
    await setRefreshToken("google", "google-rt");
    await setRefreshToken("microsoft", "ms-rt");
    expect(await getRefreshToken("google")).toBe("google-rt");
    expect(await getRefreshToken("microsoft")).toBe("ms-rt");
    await deleteRefreshToken("google");
    expect(await getRefreshToken("google")).toBeNull();
    expect(await getRefreshToken("microsoft")).toBe("ms-rt");
  });
});

describe("secrets identity (将来のサブスク用)", () => {
  it("user email を保存・取得できる", async () => {
    await setUserEmail("u@example.com");
    expect(await getUserEmail()).toBe("u@example.com");
  });

  it("first_connected_at は既に値があれば上書きしない", async () => {
    await setFirstConnectedAtIfMissing("2026-01-01T00:00:00.000Z");
    await setFirstConnectedAtIfMissing("2026-12-31T00:00:00.000Z");
    expect(await getFirstConnectedAt()).toBe("2026-01-01T00:00:00.000Z");
  });
});
