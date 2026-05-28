/** クリップボードへの書き込み。Tauri では plugin-clipboard-manager、それ以外は Web API。 */

import { isTauri } from "./tauri";

export async function copyText(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return;
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}
