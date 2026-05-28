/** グリッドと選択集合から、選択された Slot を抽出する純粋関数。 */

import type { Selection } from "./selection";
import type { DayColumn, Slot } from "./slots";

/** 選択されている枠を、時系列 (日→行) 順で返す。 */
export function collectSelectedSlots(
  columns: readonly DayColumn[],
  selection: Selection,
): Slot[] {
  const out: Slot[] = [];
  for (const col of columns) {
    for (const slot of col.slots) {
      if (selection.has(slot.key)) out.push(slot);
    }
  }
  return out;
}
