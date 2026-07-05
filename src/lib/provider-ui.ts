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

/** イベントバーの色クラス (Google=グレー / Outlook=水色 / Apple=ピンク)。 */
export function eventBarColorClasses(source: ProviderId | undefined): string {
  if (source === "microsoft") return "border-sky-400/40 bg-sky-200/55";
  if (source === "apple") return "border-pink-400/40 bg-pink-200/55";
  return "border-gray-400/40 bg-gray-300/55";
}
