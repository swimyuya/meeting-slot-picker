/**
 * Chrome 拡張機能 (Manifest V3) 用の secret 保存。
 * chrome.storage.local は origin 単位で隔離され、ブラウザ間で同期しない (sync は別)。
 * macOS Keychain / IndexedDB と同等の役割。
 *
 * chrome.storage は型安全な Promise API (Chrome 88+) を使う。
 */

interface ChromeStorageLike {
  storage: {
    local: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
  };
}

function getChromeStorage(): ChromeStorageLike {
  const c = (globalThis as { chrome?: unknown }).chrome as ChromeStorageLike | undefined;
  if (!c?.storage?.local) {
    throw new Error("chrome.storage.local is not available (not running as extension)");
  }
  return c;
}

export async function setSecretExtension(key: string, value: string): Promise<void> {
  await getChromeStorage().storage.local.set({ [key]: value });
}

export async function getSecretExtension(key: string): Promise<string | null> {
  const obj = await getChromeStorage().storage.local.get(key);
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

export async function deleteSecretExtension(key: string): Promise<void> {
  await getChromeStorage().storage.local.remove(key);
}
