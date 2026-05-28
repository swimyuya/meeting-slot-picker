import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSelection } from "../hooks/useSelection";

describe("useSelection", () => {
  it("toggleOne で選択/解除する", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggleOne("a"));
    expect(result.current.selection.has("a")).toBe(true);
    act(() => result.current.toggleOne("a"));
    expect(result.current.selection.has("a")).toBe(false);
  });

  it("onCellDown(add) からの onCellEnter で範囲追加する", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.onCellDown("a", false));
    act(() => result.current.onCellEnter("b"));
    act(() => result.current.onCellEnter("c"));
    expect([...result.current.selection].sort()).toEqual(["a", "b", "c"]);
  });

  it("選択済み起点の onCellDown(remove) ドラッグで解除する", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.onCellDown("a", false));
    act(() => result.current.onCellEnter("b"));
    act(() => result.current.onCellDown("a", true)); // remove ドラッグ開始
    act(() => result.current.onCellEnter("b"));
    expect(result.current.selection.size).toBe(0);
  });

  it("clearAll で全解除する", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.onCellDown("a", false));
    act(() => result.current.clearAll());
    expect(result.current.selection.size).toBe(0);
  });

  it("window pointerup 後はドラッグが終了し onCellEnter は無視される", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.onCellDown("a", false));
    act(() => {
      window.dispatchEvent(new Event("pointerup"));
    });
    act(() => result.current.onCellEnter("b"));
    expect(result.current.selection.has("a")).toBe(true);
    expect(result.current.selection.has("b")).toBe(false);
  });
});
