import type { ProviderId } from "../auth/providers";

/** Google Calendar freeBusy が返す busy 区間 (ISO 文字列)。 */
export interface BusySlot {
  start: string;
  end: string;
}

/**
 * カレンダーの予定 (Google Calendar / Microsoft Graph 共通形式)。
 * Pro 版では `source` で出元 provider を識別 (UI 色分け・tooltip に使用)。
 */
export interface CalendarEvent {
  readonly id: string;
  readonly summary: string;
  readonly start: string; // ISO 文字列 (allDay の場合は当日 JST 00:00)
  readonly end: string;
  readonly allDay: boolean;
  readonly source?: ProviderId;
}
