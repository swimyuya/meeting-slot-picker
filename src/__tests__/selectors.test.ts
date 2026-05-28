import { describe, expect, it } from "vitest";
import { collectSelectedSlots } from "../domain/selectors";
import { buildSlotGrid, type GridOptions } from "../domain/slots";
import { fromJst } from "../lib/time";

const opts: GridOptions = { startHour: 9, endHour: 11, daysAhead: 1, weekdaysOnly: false };

describe("collectSelectedSlots", () => {
  it("選択キーに対応する枠をグリッド順 (時系列) で返す", () => {
    const cols = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), opts);
    const k0 = cols[0].slots[0].key;
    const k2 = cols[0].slots[2].key;
    const sel = new Set([k2, k0]); // 入力順は逆
    const picked = collectSelectedSlots(cols, sel);
    expect(picked.map((s) => s.key)).toEqual([k0, k2]);
  });

  it("選択なしは空配列", () => {
    const cols = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), opts);
    expect(collectSelectedSlots(cols, new Set())).toEqual([]);
  });
});
