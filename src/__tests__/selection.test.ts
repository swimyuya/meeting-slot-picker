import { describe, expect, it } from "vitest";
import {
  addKeys,
  clear,
  EMPTY_SELECTION,
  isSelected,
  removeKeys,
  toggle,
} from "../domain/selection";

describe("selection (immutable set ops)", () => {
  it("toggle は新しい Set を返し、元を変更しない", () => {
    const a = EMPTY_SELECTION;
    const b = toggle(a, "k1");
    expect(b).not.toBe(a);
    expect(isSelected(b, "k1")).toBe(true);
    expect(isSelected(a, "k1")).toBe(false); // 元は不変
  });

  it("toggle は既存キーを外す", () => {
    const b = toggle(toggle(EMPTY_SELECTION, "k1"), "k1");
    expect(isSelected(b, "k1")).toBe(false);
  });

  it("addKeys / removeKeys は新 Set を返す", () => {
    const a = addKeys(EMPTY_SELECTION, ["k1", "k2", "k3"]);
    expect([...a].sort()).toEqual(["k1", "k2", "k3"]);
    const b = removeKeys(a, ["k2"]);
    expect(b).not.toBe(a);
    expect([...b].sort()).toEqual(["k1", "k3"]);
    expect(a.has("k2")).toBe(true); // 元は不変
  });

  it("clear は空の Set を返す", () => {
    expect(clear().size).toBe(0);
  });
});
