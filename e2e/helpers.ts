import type { Page } from "@playwright/test";

/**
 * ページ読み込み前に refresh_token を IndexedDB に種まきして連携済み状態にする。
 * Web 版は secrets を IndexedDB (DB: meeting-slot-picker, store: secrets) に保存する。
 */
export async function seedConnected(page: Page): Promise<void> {
  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("meeting-slot-picker", 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("secrets")) {
          db.createObjectStore("secrets");
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("secrets", "readwrite");
        tx.objectStore("secrets").put("e2e-refresh-token", "google_refresh_token");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  });
}
