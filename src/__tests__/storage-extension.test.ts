/**
 * storage-extension の薄ラッパー検証。
 * chrome.storage.local をインメモリ Map で偽装する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSecretExtension,
  getSecretExtension,
  setSecretExtension,
} from "../lib/storage-extension";

function createFakeChromeStorage() {
  const store = new Map<string, unknown>();
  return {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const k of arr) {
            if (store.has(k)) out[k] = store.get(k);
          }
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) store.delete(k);
        }),
      },
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("chrome", createFakeChromeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage-extension", () => {
  it("set した値を get できる", async () => {
    await setSecretExtension("k", "v");
    expect(await getSecretExtension("k")).toBe("v");
  });

  it("未保存なら null", async () => {
    expect(await getSecretExtension("nokey")).toBeNull();
  });

  it("delete で消える", async () => {
    await setSecretExtension("k", "v");
    await deleteSecretExtension("k");
    expect(await getSecretExtension("k")).toBeNull();
  });

  it("chrome.storage が無いと throw する", async () => {
    vi.stubGlobal("chrome", undefined);
    await expect(setSecretExtension("k", "v")).rejects.toThrow(/chrome.storage/);
  });
});
