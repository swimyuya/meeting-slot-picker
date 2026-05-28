import "@testing-library/jest-dom/vitest";
// jsdom には IndexedDB 実装が無いので polyfill を入れる (storage-web / secrets が依存)。
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";
import { resetStorageWebForTests } from "../lib/storage-web";

/**
 * 各テストの前に IndexedDB を空にする (secrets / storage-web 関連の状態が
 * テスト間で漏れないように)。
 *
 * 1. キャッシュした dbPromise の接続を close
 * 2. fake-indexeddb の DB を delete
 */
beforeEach(async () => {
  await resetStorageWebForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("meeting-slot-picker");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});
