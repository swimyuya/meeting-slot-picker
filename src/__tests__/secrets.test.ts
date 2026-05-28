import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteSecret,
  getRefreshToken,
  getSecret,
  setRefreshToken,
  setSecret,
} from "../lib/secrets";

beforeEach(() => localStorage.clear());

describe("secrets (localStorage fallback)", () => {
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

  it("refresh_token ラッパーが機能する", async () => {
    await setRefreshToken("rt123");
    expect(await getRefreshToken()).toBe("rt123");
  });
});
