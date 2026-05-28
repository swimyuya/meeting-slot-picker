/**
 * IndexedDB を使った Web 用 secret 保存。
 * - macOS Keychain の代替 (PWA / ブラウザ環境)
 * - origin 単位で隔離、PWA アンインストール / ブラウザストレージクリアで消える
 * - 純粋なテキスト保存 (暗号化なし)。client_secret はサーバ側のみなので、
 *   refresh_token 単体ではこのアプリの権限内 (calendar.readonly) でしか使えない
 *
 * Apple ITP: 7日間使われないと iOS Safari がストレージをクリアする可能性。
 * 再連携で復旧する。
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "meeting-slot-picker";
const STORE = "secrets";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

/** lazy にデータベースを開く。SSR / IndexedDB 非対応では throw する。 */
function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** テスト用: キャッシュした dbPromise をクリアし、開いている DB 接続も close する。 */
export async function resetStorageWebForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      /* ignore close error */
    }
  }
  dbPromise = null;
}

export async function setSecretWeb(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.put(STORE, value, key);
}

export async function getSecretWeb(key: string): Promise<string | null> {
  const db = await getDb();
  const value = (await db.get(STORE, key)) as string | undefined;
  return value ?? null;
}

export async function deleteSecretWeb(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, key);
}
