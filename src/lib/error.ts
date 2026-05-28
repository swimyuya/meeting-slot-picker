/** unknown を表示用メッセージに変換する。 */
export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
