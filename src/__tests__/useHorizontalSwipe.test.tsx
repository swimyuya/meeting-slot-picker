/**
 * useHorizontalSwipe (モバイルの日付スワイプ) の検証。
 * フックは要素へ生 addEventListener するため、プロパティを載せた素の Event を
 * dispatch して threshold / verticalTolerance / pointerType の各判定を pin する。
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHorizontalSwipe } from "../hooks/useHorizontalSwipe";

function Harness({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const ref = useHorizontalSwipe<HTMLDivElement>({ onSwipeLeft: onLeft, onSwipeRight: onRight });
  return <div data-testid="area" ref={ref} />;
}

function firePointer(
  el: Element,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: { x: number; y: number; pointerType?: string },
) {
  const ev = new Event(type, { bubbles: true }) as Event & {
    pointerType: string;
    clientX: number;
    clientY: number;
  };
  ev.pointerType = init.pointerType ?? "touch";
  ev.clientX = init.x;
  ev.clientY = init.y;
  el.dispatchEvent(ev);
}

function setup() {
  const onLeft = vi.fn();
  const onRight = vi.fn();
  render(<Harness onLeft={onLeft} onRight={onRight} />);
  return { area: screen.getByTestId("area"), onLeft, onRight };
}

describe("useHorizontalSwipe", () => {
  it("右へ threshold (50px) 以上で onSwipeRight", () => {
    const { area, onLeft, onRight } = setup();
    firePointer(area, "pointerdown", { x: 100, y: 100 });
    firePointer(area, "pointerup", { x: 180, y: 105 });
    expect(onRight).toHaveBeenCalledTimes(1);
    expect(onLeft).not.toHaveBeenCalled();
  });

  it("左へ threshold 以上で onSwipeLeft", () => {
    const { area, onLeft, onRight } = setup();
    firePointer(area, "pointerdown", { x: 200, y: 100 });
    firePointer(area, "pointerup", { x: 120, y: 100 });
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(onRight).not.toHaveBeenCalled();
  });

  it("threshold 未満の移動では発火しない", () => {
    const { area, onLeft, onRight } = setup();
    firePointer(area, "pointerdown", { x: 100, y: 100 });
    firePointer(area, "pointerup", { x: 140, y: 100 });
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  it("縦移動が verticalTolerance (40px) を超えたら縦スクロール扱いで発火しない", () => {
    const { area, onLeft, onRight } = setup();
    firePointer(area, "pointerdown", { x: 100, y: 100 });
    firePointer(area, "pointermove", { x: 130, y: 160 });
    firePointer(area, "pointerup", { x: 220, y: 160 });
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  it("マウス (pointerType=mouse) のドラッグはスワイプ扱いしない", () => {
    const { area, onLeft, onRight } = setup();
    firePointer(area, "pointerdown", { x: 100, y: 100, pointerType: "mouse" });
    firePointer(area, "pointerup", { x: 300, y: 100, pointerType: "mouse" });
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  it("pointercancel 後の pointerup では発火しない", () => {
    const { area, onLeft, onRight } = setup();
    firePointer(area, "pointerdown", { x: 100, y: 100 });
    firePointer(area, "pointercancel", { x: 100, y: 100 });
    firePointer(area, "pointerup", { x: 300, y: 100 });
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });
});
