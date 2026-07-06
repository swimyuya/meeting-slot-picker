/**
 * provider / イベント source → UI 表現 (短縮ラベル・バー色・タイトル prefix) の一元管理。
 *
 * spec.displayName は Apple だけ "Apple Calendar" と長く、UI では "Apple" 表記を
 * 使うため、spec 直結にせず短縮ラベルをここで定義する (Google/Outlook は spec と同値)。
 */

import { GOOGLE_SPEC, MICROSOFT_SPEC, type ProviderId } from "../auth/providers";

/** source 未指定イベントの既定 provider (旧 Google 専用版のデータ互換)。 */
export const DEFAULT_EVENT_SOURCE: ProviderId = "google";

/** UI 表示用の短い provider 名 ("Google" / "Outlook" / "Apple")。 */
export function providerShortLabel(provider: ProviderId): string {
  if (provider === "microsoft") return MICROSOFT_SPEC.displayName;
  if (provider === "apple") return "Apple";
  return GOOGLE_SPEC.displayName;
}

/** イベント表記の provider prefix。Google は無印 (既定 provider のため)。 */
export function eventSourcePrefix(source: ProviderId | undefined): string {
  if (source === "microsoft" || source === "apple") {
    return `${providerShortLabel(source)}: `;
  }
  return "";
}

/** イベントバーの色クラス (Google=グレー / Outlook=水色 / Apple=ピンク)。左アクセント + 淡色地。 */
export function eventBarColorClasses(source: ProviderId | undefined): string {
  if (source === "microsoft") {
    return "border-l-sky-400 bg-sky-100/85 text-sky-950 dark:border-l-sky-500 dark:bg-sky-500/15 dark:text-sky-100";
  }
  if (source === "apple") {
    return "border-l-pink-400 bg-pink-100/85 text-pink-950 dark:border-l-pink-500 dark:bg-pink-500/15 dark:text-pink-100";
  }
  return "border-l-zinc-400 bg-zinc-200/70 text-zinc-800 dark:border-l-zinc-500 dark:bg-zinc-600/40 dark:text-zinc-100";
}
