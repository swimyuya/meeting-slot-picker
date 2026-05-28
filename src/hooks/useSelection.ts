import { useCallback, useEffect, useRef, useState } from "react";
import {
  addKeys,
  clear,
  EMPTY_SELECTION,
  removeKeys,
  toggle,
  type Selection,
} from "../domain/selection";

type DragMode = "add" | "remove";

/** 枠選択の状態と、クリック/ドラッグ操作ハンドラを提供するフック (全てイミュータブル更新)。 */
export function useSelection() {
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const dragMode = useRef<DragMode | null>(null);

  // ドラッグ終了をウィンドウ全体で拾う (グリッド外で離した場合に備える)。
  useEffect(() => {
    const end = () => {
      dragMode.current = null;
    };
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, []);

  const toggleOne = useCallback((key: string) => {
    setSelection((s) => toggle(s, key));
  }, []);

  const onCellDown = useCallback((key: string, isSelected: boolean) => {
    const mode: DragMode = isSelected ? "remove" : "add";
    dragMode.current = mode;
    setSelection((s) => (mode === "add" ? addKeys(s, [key]) : removeKeys(s, [key])));
  }, []);

  const onCellEnter = useCallback((key: string) => {
    const mode = dragMode.current;
    if (!mode) return;
    setSelection((s) => (mode === "add" ? addKeys(s, [key]) : removeKeys(s, [key])));
  }, []);

  const clearAll = useCallback(() => setSelection(clear()), []);

  return { selection, toggleOne, onCellDown, onCellEnter, clearAll };
}
