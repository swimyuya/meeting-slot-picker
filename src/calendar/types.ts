/** Google Calendar freeBusy が返す busy 区間 (ISO 文字列)。 */
export interface BusySlot {
  start: string;
  end: string;
}

/** Google Calendar events.list が返す予定 (タイトル付き)。 */
export interface CalendarEvent {
  readonly id: string;
  readonly summary: string;
  readonly start: string; // ISO 文字列 (allDay の場合は当日 JST 00:00)
  readonly end: string;
  readonly allDay: boolean;
}
