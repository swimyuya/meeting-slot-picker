/**
 * SlotCell のタッチ操作分離テスト。
 *
 * 制約: jsdom には PointerEvent コンストラクタが無く、fireEvent.pointer* で
 * 渡した pointerType は実際のイベントに反映されない (undefined になる)。
 * そのため「タッチタイプとして扱ったときの分岐」の完全シミュレーションは不可。
 *
 * ここでは jsdom で確実に検証できるレイヤだけ抑え、実機 iPhone Safari での
 * 挙動 (縦スクロール時に誤選択しない・タップで選択する) は手動 E2E で確認する。
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SlotCell } from "../components/SlotCell";
import type { Slot } from "../domain/slots";

function makeSlot(): Slot {
  return {
    key: "2026-05-28#0",
    dayISO: "2026-05-28",
    index: 0,
    start: new Date("2026-05-28T09:00:00+09:00"),
    end: new Date("2026-05-28T09:30:00+09:00"),
    busy: false,
    events: [],
    labelEvents: [],
  };
}

describe("SlotCell (デスクトップ既存挙動)", () => {
  it("pointerDown (pointerType 未指定 = デスクトップ扱い) で即時 onDown", () => {
    const onDown = vi.fn();
    render(<SlotCell slot={makeSlot()} selected={false} onDown={onDown} onEnter={vi.fn()} />);
    fireEvent.pointerDown(screen.getByRole("button"));
    expect(onDown).toHaveBeenCalledWith("2026-05-28#0", false);
  });

  it("pointerEnter で onEnter (ドラッグ選択用)", () => {
    const onEnter = vi.fn();
    render(<SlotCell slot={makeSlot()} selected={false} onDown={vi.fn()} onEnter={onEnter} />);
    fireEvent.pointerEnter(screen.getByRole("button"));
    expect(onEnter).toHaveBeenCalledWith("2026-05-28#0");
  });

  it("CSS の touch-action: pan-y pinch-zoom が設定されている (縦スクロール + 2本指ズームをブラウザに任せる)", () => {
    render(<SlotCell slot={makeSlot()} selected={false} onDown={vi.fn()} onEnter={vi.fn()} />);
    const cell = screen.getByRole("button");
    expect(cell.style.touchAction).toBe("pan-y pinch-zoom");
  });
});
