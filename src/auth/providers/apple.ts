/**
 * Apple Calendar (iCloud CalDAV) provider 仕様。
 *
 * Apple は OAuth 用のカレンダー API を公開していないため、
 * CalDAV プロトコル + アプリ用パスワード で連携する。
 *
 * 必須前提: ユーザーの Apple ID で **2 要素認証が有効** になっていること。
 *           無効だと appleid.apple.com でアプリ用パスワードを発行できない。
 */

import type { AppleCredentialSpec } from "./types";

export const APPLE_SPEC: AppleCredentialSpec = {
  kind: "apple-caldav",
  displayName: "Apple Calendar",
  caldavBaseUrl: "https://caldav.icloud.com",
  appPasswordHelpUrl: "https://appleid.apple.com/",
};
